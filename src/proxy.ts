import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Proxy (antes "middleware" en Next.js 15 y anteriores).
 *
 * Corre en el Edge runtime en cada request que matchea el `config.matcher`
 * de abajo. Hace checks OPTIMISTAS: solo valida que la cookie de sesión
 * exista y el JWT esté firmado correctamente. La autorización real
 * (rol admin vs operador, que el usuario siga activo en BD, etc.) se hace
 * dentro de los Route Handlers usando `apiAuth()` de `@/lib/auth/api`.
 *
 * Por qué NO usar `@/lib/auth/session` acá:
 *   - ese archivo importa `next/headers` y `server-only`, que no funcionan
 *     en el runtime del proxy.
 *   - ese archivo asume cookies() del request handler; acá las cookies
 *     vienen del NextRequest.
 */

const SESSION_COOKIE = "sismo_session";

// Rutas UI protegidas (requieren sesión). Las rutas públicas / y /dashboard
// quedan fuera del matcher, así que ni siquiera pasan por acá.
const PROTECTED_UI_PREFIXES = ["/capas", "/admin"];

// APIs protegidas (solo consumidas por /capas y /admin). Los endpoints
// públicos (/api/sismos, /api/n8n, /api/auth/me) NO están acá.
const PROTECTED_API_PREFIXES = [
  "/api/piezometros",
  "/api/mediciones",
  "/api/grupos",
  "/api/tipos-piezometro",
  "/api/import",
];

function getEncodedKey(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

async function hasValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const key = getEncodedKey();
  if (!key) return false;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    const expiresAt =
      typeof payload.expiresAt === "number" ? payload.expiresAt : 0;
    if (expiresAt && expiresAt < Date.now()) return false;
    return typeof payload.userId === "number";
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  const isProtectedUi = PROTECTED_UI_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const isProtectedApi = PROTECTED_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!isProtectedUi && !isProtectedApi) {
    return NextResponse.next();
  }

  const ok = await hasValidSession(token);
  if (ok) {
    return NextResponse.next();
  }

  // APIs protegidas responden 401 JSON, no redirect.
  if (isProtectedApi) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  // UI protegida → redirect a /login conservando la ruta original.
  const loginUrl = new URL("/login", request.nextUrl);
  if (pathname && pathname !== "/") {
    loginUrl.searchParams.set("next", pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/capas/:path*",
    "/admin/:path*",
    "/api/piezometros/:path*",
    "/api/mediciones/:path*",
    "/api/grupos/:path*",
    "/api/tipos-piezometro/:path*",
    "/api/import/:path*",
  ],
};
