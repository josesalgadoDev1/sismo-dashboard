"use server";

import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
import type { Rol, AuthMethod } from "@/lib/auth/types";

export interface LoginState {
  error?: string;
}

interface UsuarioRow {
  id: number;
  email: string;
  password_hash: string | null;
  nombre: string;
  rol: Rol;
  activo: boolean;
  auth_method: AuthMethod;
}

export async function loginAction(
  _prev: LoginState | undefined,
  formData: FormData
): Promise<LoginState> {
  const emailRaw = formData.get("email");
  const passwordRaw = formData.get("password");

  if (typeof emailRaw !== "string" || typeof passwordRaw !== "string") {
    return { error: "Datos inválidos." };
  }

  const email = emailRaw.trim().toLowerCase();
  const password = passwordRaw;

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios." };
  }

  let user: UsuarioRow | undefined;
  try {
    const result = await pool.query<UsuarioRow>(
      `SELECT id, email, password_hash, nombre, rol, activo, auth_method
         FROM usuarios
        WHERE LOWER(email) = $1
        LIMIT 1`,
      [email]
    );
    user = result.rows[0];
  } catch (err) {
    console.error("[loginAction] DB error:", err);
    return { error: "Error del servidor. Intenta nuevamente." };
  }

  // Mensaje genérico para no revelar si el usuario existe.
  const generic = "Credenciales inválidas.";

  if (!user || !user.activo) {
    return { error: generic };
  }

  // Los usuarios SSO no pueden entrar por el formulario de contraseña.
  if (user.auth_method !== "password" || !user.password_hash) {
    return {
      error:
        "Este usuario debe ingresar a través del SSO corporativo de Collahuasi.",
    };
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return { error: generic };
  }

  await createSession({
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    authMethod: user.auth_method,
  });

  // Actualiza último login (best-effort, no bloquea el flujo).
  pool
    .query("UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1", [user.id])
    .catch((e) => console.error("[loginAction] ultimo_login update:", e));

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
