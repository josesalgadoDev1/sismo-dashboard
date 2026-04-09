import { NextResponse } from "next/server";
import { AuthError, getSession } from "./session";
import type { SessionPayload } from "./types";

/**
 * Helper para Route Handlers: devuelve la sesión o un NextResponse con el
 * error HTTP adecuado. Uso:
 *
 *   const auth = await apiAuth(["admin"]);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth aquí es SessionPayload
 */
export async function apiAuth(
  allowedRoles?: Array<SessionPayload["rol"]>
): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }
  if (allowedRoles && !allowedRoles.includes(session.rol)) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 403 }
    );
  }
  return session;
}

export { AuthError };
