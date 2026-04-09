"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  List,
  LayoutDashboard,
  Sun,
  Moon,
  Activity,
  Gauge,
  Settings,
  ChevronDown,
  Droplet,
  ClipboardList,
  LogOut,
  LogIn,
  UserCircle2,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/auth/types";

type MenuKey = "sismos" | "capas" | "admin" | null;
type Rol = SessionUser["rol"];

interface MenuItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface MenuSection {
  key: Exclude<MenuKey, null>;
  label: string;
  icon: React.ReactNode;
  items: MenuItem[];
  // Si se omite, la sección es pública.
  allowedRoles?: Rol[];
}

const MENU: MenuSection[] = [
  {
    key: "sismos",
    label: "Sismos",
    icon: <Activity size={16} />,
    items: [
      { href: "/", label: "Listado", icon: <List size={14} /> },
      { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={14} /> },
    ],
  },
  {
    key: "capas",
    label: "Capas",
    icon: <Gauge size={16} />,
    allowedRoles: ["admin", "operador"],
    items: [
      { href: "/capas", label: "Mapa de Capas", icon: <Droplet size={14} /> },
    ],
  },
  {
    key: "admin",
    label: "Admin",
    icon: <Settings size={16} />,
    allowedRoles: ["admin"],
    items: [
      { href: "/admin/piezometros", label: "Piezómetros", icon: <Droplet size={14} /> },
      { href: "/admin/mediciones", label: "Mediciones", icon: <ClipboardList size={14} /> },
    ],
  },
];

interface NavbarProps {
  user: SessionUser | null;
}

export default function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [mounted, setMounted] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Oculto en la página de login para que no se vea doble header.
  const isLoginPage = pathname === "/login";

  const visibleMenu = MENU.filter((section) => {
    if (!section.allowedRoles) return true;
    if (!user) return false;
    return section.allowedRoles.includes(user.rol);
  });

  // En modo público (sin sesión) mostramos enlaces planos como en prod:
  // no hay agrupaciones, solo los items públicos directos.
  const publicFlatItems = user
    ? []
    : MENU.filter((s) => !s.allowedRoles).flatMap((s) => s.items);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("sismo-theme", newTheme);
    if (newTheme === "dark") document.body.classList.add("dark-mode");
    else document.body.classList.remove("dark-mode");
  };

  const isSectionActive = (section: MenuSection) =>
    section.items.some(
      (it) => pathname === it.href || (it.href !== "/" && pathname?.startsWith(it.href))
    );

  if (isLoginPage) return null;

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
            <span className="navbar-title">Monitoreo Collahuasi</span>
            <span className="navbar-subtitle">Plataforma Tim</span>
          </div>
        </Link>

        <div className="navbar-links" ref={menuRef}>
          {user ? (
            visibleMenu.map((section) => (
              <div key={section.key} className="navbar-dropdown">
                <button
                  type="button"
                  className={`navbar-link navbar-link-btn ${isSectionActive(section) ? "active" : ""}`}
                  onClick={() =>
                    setOpenMenu(openMenu === section.key ? null : section.key)
                  }
                >
                  {section.icon}
                  <span>{section.label}</span>
                  <ChevronDown
                    size={14}
                    style={{
                      transition: "transform 0.2s ease",
                      transform: openMenu === section.key ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                </button>
                {openMenu === section.key && (
                  <div className="navbar-dropdown-menu">
                    {section.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`navbar-dropdown-item ${pathname === item.href ? "active" : ""}`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            publicFlatItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`navbar-link ${pathname === item.href ? "active" : ""}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="navbar-right">
        <div className="navbar-status">
          <span className="status-dot" />
          <span className="status-text">En línea</span>
        </div>

        {user ? (
          <>
            <div className="navbar-user" title={user.email}>
              <UserCircle2 size={16} />
              <span className="navbar-user-name">{user.nombre}</span>
              <span className={`navbar-user-role ${user.rol}`}>{user.rol}</span>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="navbar-logout-btn" title="Cerrar sesión">
                <LogOut size={14} />
                <span className="navbar-logout-label">Salir</span>
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className="navbar-login-btn" title="Ingresar">
            <LogIn size={14} />
            <span className="navbar-login-label">Ingresar</span>
          </Link>
        )}

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
