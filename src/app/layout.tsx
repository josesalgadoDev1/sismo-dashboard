import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import { getSession } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/types";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Monitoreo Sísmico — Collahuasi",
  description: "Sistema de monitoreo sísmico en tiempo real — Collahuasi",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const user: SessionUser | null = session
    ? {
        id: session.userId,
        email: session.email,
        nombre: session.nombre,
        rol: session.rol,
        authMethod: session.authMethod,
      }
    : null;

  return (
    <html lang="es" className={inter.variable}>
      <body>
        <Navbar user={user} />
        {children}
      </body>
    </html>
  );
}
