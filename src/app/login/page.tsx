import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-header">
          <img
            src="/cmdic_logo.png"
            alt="Logo Collahuasi"
            className="login-logo"
          />
          <h1>Monitoreo Collahuasi</h1>
          <p>Plataforma Tim — ingreso restringido</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
