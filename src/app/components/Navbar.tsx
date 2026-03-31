"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  List,
  LayoutDashboard,
  Sun,
  Moon,
  Activity,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("sismo-theme");
    if (savedTheme === "dark") {
      setTheme("dark");
      document.body.classList.add("dark-mode");
    } else {
      setTheme("light");
      document.body.classList.remove("dark-mode");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("sismo-theme", newTheme);
    if (newTheme === "dark") document.body.classList.add("dark-mode");
    else document.body.classList.remove("dark-mode");
  };

  return (
    <nav className="app-navbar">
      <div className="navbar-left">
        <Link href="/" className="navbar-brand">
          <img
            src="/cmdic_logo.png"
            alt="Logo Collahuasi"
            className="navbar-logo"
          />
          <div className="navbar-brand-text">
            <span className="navbar-title">Monitoreo Sísmico</span>
            <span className="navbar-subtitle">Paltaforma Tim</span>
          </div>
        </Link>

        <div className="navbar-links">
          <Link
            href="/"
            className={`navbar-link ${pathname === "/" ? "active" : ""}`}
          >
            <List size={16} />
            <span>Listado</span>
          </Link>
          <Link
            href="/dashboard"
            className={`navbar-link ${pathname === "/dashboard" ? "active" : ""}`}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>

      <div className="navbar-right">
        <div className="navbar-status">
          <span className="status-dot" />
          <span className="status-text">En línea</span>
        </div>
        {mounted && (
          <button
            className="navbar-theme-btn"
            onClick={toggleTheme}
            title={theme === "dark" ? "Modo Claro" : "Modo Oscuro"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}
      </div>
    </nav>
  );
}
