import "server-only";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { SessionPayload, SessionUser } from "./types";

const SESSION_COOKIE = "sismo_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 horas

function getEncodedKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET no está definido o es muy corto (mínimo 32 caracteres)."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getEncodedKey());
}

export async function decryptSession(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getEncodedKey(), {
      algorithms: ["HS256"],
    });
    const p = payload as unknown as SessionPayload;
    if (
      typeof p.userId !== "number" ||
      typeof p.email !== "string" ||
      typeof p.rol !== "string"
    ) {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser): Promise<void> {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const token = await encryptSession({
    userId: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    authMethod: user.authMethod,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Lee y valida la sesión actual desde la cookie. Devuelve null si no hay
 * sesión o si está expirada/inválida. Usar en Server Components, Route
 * Handlers y Server Actions. NO usar en el proxy (el proxy lee la cookie
 * directamente con `request.cookies`).
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await decryptSession(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) return null;
  return session;
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("No autenticado", 401);
  }
  return session;
}

export async function requireRole(
  roles: Array<SessionPayload["rol"]>
): Promise<SessionPayload> {
  const session = await requireAuth();
  if (!roles.includes(session.rol)) {
    throw new AuthError("No autorizado", 403);
  }
  return session;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
