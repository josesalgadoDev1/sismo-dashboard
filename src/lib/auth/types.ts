export type Rol = "admin" | "operador";
export type AuthMethod = "password" | "sso";

export interface SessionPayload {
  userId: number;
  email: string;
  nombre: string;
  rol: Rol;
  authMethod: AuthMethod;
  expiresAt: number; // epoch ms
  [key: string]: unknown; // jose JWTPayload compat
}

export interface SessionUser {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  authMethod: AuthMethod;
}
