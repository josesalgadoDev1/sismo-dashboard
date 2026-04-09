"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { LogIn } from "lucide-react";

const initialState: LoginState = {};

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState
  );

  return (
    <form action={formAction} className="login-form">
      <div className="login-field">
        <label htmlFor="email">Email corporativo</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="usuario@collahuasi.cl"
          required
        />
      </div>

      <div className="login-field">
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state?.error && <div className="login-error">{state.error}</div>}

      <button type="submit" className="login-submit" disabled={pending}>
        <LogIn size={16} />
        <span>{pending ? "Ingresando..." : "Ingresar"}</span>
      </button>

      <p className="login-hint">
        Próximamente el acceso se hará con tu cuenta corporativa de Collahuasi
        (SSO).
      </p>
    </form>
  );
}
