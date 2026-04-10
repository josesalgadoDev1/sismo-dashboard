"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Layers, Eye, EyeOff, ChevronDown, ChevronRight, ChevronLeft,
  Droplet, Tag, X,
  Mountain, Ruler, ShieldAlert, Waves, Activity, Truck,
} from "lucide-react";
import type { PiezometroMapItem } from "../components/PiezometroMap";
import { latLonToUtm, latLonToSlc } from "@/lib/coords";

const PiezometroMap = dynamic(() => import("../components/PiezometroMap"), { ssr: false });

type CoordTab = "GEO" | "UTM" | "MINA";

const SENTINA_CENTER: [number, number] = [-20.940803, -68.603681];

interface CapaConfig {
  id: string;
  categoriaId: string;
  nombre: string;
  subtitulo: string;
  visible: boolean;
}

interface CategoriaConfig {
  id: string;
  nombre: string;
  icon: React.ReactNode;
  expanded: boolean;
}

const INITIAL_CATEGORIAS: CategoriaConfig[] = [
  { id: "instrumentacion", nombre: "Instrumentación", icon: <Droplet size={16} />, expanded: false },
  { id: "deformaciones", nombre: "Deformaciones", icon: <Mountain size={16} />, expanded: false },
  { id: "topografia", nombre: "Topografía", icon: <Ruler size={16} />, expanded: false },
  { id: "ejes_muro", nombre: "Ejes de muro", icon: <Ruler size={16} />, expanded: false },
  { id: "control_op", nombre: "Control operacional", icon: <ShieldAlert size={16} />, expanded: false },
  { id: "batimetria", nombre: "Batimetría", icon: <Waves size={16} />, expanded: false },
  { id: "sismos", nombre: "Sismos", icon: <Activity size={16} />, expanded: false },
  { id: "planes_carga", nombre: "Planes de carga", icon: <Truck size={16} />, expanded: false },
];

const INITIAL_CAPAS: CapaConfig[] = [
  { id: "piezometros", categoriaId: "instrumentacion", nombre: "Piezómetros", subtitulo: "Piezómetro", visible: false },
];

const ALERT_COLORS: Record<string, string> = {
  ALARMA: "#ef4444",
  ALERTA: "#f97316",
  ADVERTENCIA: "#eab308",
  NORMAL: "#22c55e",
  SIN_DATO: "#94a3b8",
};

function formatDateShort(d: string | null) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    return date.toLocaleDateString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric" })
      + "\n" + date.toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return d; }
}

export default function CapasPage() {
  const [piezometros, setPiezometros] = useState<PiezometroMapItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaConfig[]>(INITIAL_CATEGORIAS);
  const [capas, setCapas] = useState<CapaConfig[]>(INITIAL_CAPAS);
  const [showLabels, setShowLabels] = useState(true);
  // Inicial = true para coincidir con SSR; en mobile lo cerramos tras montar.
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  }, []);

  // Panel flotante
  const [selectedPiezo, setSelectedPiezo] = useState<PiezometroMapItem | null>(null);
  const [coordTab, setCoordTab] = useState<CoordTab>("GEO");
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const capaPiezometros = capas.find((c) => c.id === "piezometros");
  const piezometrosVisibles = capaPiezometros?.visible ?? false;

  useEffect(() => {
    if (!piezometrosVisibles) return;
    if (piezometros.length > 0) return;
    setLoading(true);
    fetch("/api/piezometros/mapa")
      .then((r) => r.json())
      .then((data) => setPiezometros(data.piezometros || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [piezometrosVisibles]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALARMA: 0, ALERTA: 0, ADVERTENCIA: 0, NORMAL: 0, SIN_DATO: 0 };
    piezometros.forEach((p) => { c[p.nivel_alerta] = (c[p.nivel_alerta] || 0) + 1; });
    return c;
  }, [piezometros]);

  const toggleCategoria = (id: string) =>
    setCategorias((prev) => prev.map((c) => (c.id === id ? { ...c, expanded: !c.expanded } : c)));

  const toggleCapa = (id: string) =>
    setCapas((prev) => prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));

  const hasCapas = (catId: string) => capas.some((c) => c.categoriaId === catId);

  // Selección de piezómetro: abrir o actualizar panel
  const handlePiezoSelect = useCallback((p: PiezometroMapItem) => {
    setSelectedPiezo(p);
    // En mobile el panel es un sheet (CSS). En desktop, posicionar a la derecha.
    if (!selectedPiezo && typeof window !== "undefined") {
      const isMobile = window.innerWidth <= 640;
      if (isMobile) {
        // Cerrar el sidebar para que el sheet sea visible
        setSidebarOpen(false);
      } else {
        setPanelPos({ x: Math.max(16, window.innerWidth - 360), y: 60 });
      }
    }
  }, [selectedPiezo]);

  // Drag handlers
  const onDragStart = (e: React.MouseEvent) => {
    dragging.current = true;
    dragOffset.current = { x: e.clientX - panelPos.x, y: e.clientY - panelPos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPanelPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const alertColorName = selectedPiezo ? ALERT_COLORS[selectedPiezo.nivel_alerta] : "";

  // Coordenadas en los tres sistemas (GEO / UTM 19S / Mina). Solo se calcula
  // cuando cambia el piezómetro seleccionado, no en cada render del drag.
  type CoordSet = {
    a: { label: string; value: string };
    b: { label: string; value: string };
    extra?: string;
  };
  const coordSets = useMemo<Record<CoordTab, CoordSet> | null>(() => {
    if (!selectedPiezo || selectedPiezo.latitud == null || selectedPiezo.longitud == null) {
      return null;
    }
    const lat = Number(selectedPiezo.latitud);
    const lon = Number(selectedPiezo.longitud);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    try {
      const utm = latLonToUtm(lat, lon, "19S");
      const slc = latLonToSlc(lat, lon);
      return {
        GEO: { a: { label: "Lat. [°]", value: lat.toFixed(6) }, b: { label: "Lon. [°]", value: lon.toFixed(6) } },
        UTM: { a: { label: "Este [m]", value: utm.este.toFixed(2) }, b: { label: "Norte [m]", value: utm.norte.toFixed(2) }, extra: "Zona 19S" },
        MINA: { a: { label: "Este [m]", value: slc.este.toFixed(2) }, b: { label: "Norte [m]", value: slc.norte.toFixed(2) }, extra: "SLC" },
      };
    } catch {
      return null;
    }
  }, [selectedPiezo]);

  return (
    <main className="capas-layout">
      {/* Barra de iconos lateral */}
      <div className="capas-toolbar">
        <button
          type="button"
          className={`capas-toolbar-btn ${sidebarOpen ? "active" : ""}`}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title="Capas"
        >
          <Layers size={20} />
        </button>
      </div>

      {/* Panel lateral de capas */}
      <aside className={`capas-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="capas-sidebar-header">
          <Layers size={16} />
          <span>CAPAS</span>
          <button type="button" className="capas-close-btn" onClick={() => setSidebarOpen(false)} title="Cerrar">
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="capas-sidebar-body">
          {categorias.map((cat) => {
            const capasDeCategoria = capas.filter((c) => c.categoriaId === cat.id);
            const tieneCapas = hasCapas(cat.id);
            return (
              <div key={cat.id} className="capas-categoria">
                <button
                  type="button"
                  className={`capas-categoria-header ${!tieneCapas ? "sin-capas" : ""}`}
                  onClick={() => toggleCategoria(cat.id)}
                >
                  {cat.icon}
                  <span>{cat.nombre}</span>
                  {tieneCapas ? (
                    cat.expanded
                      ? <ChevronDown size={14} style={{ marginLeft: "auto" }} />
                      : <ChevronRight size={14} style={{ marginLeft: "auto" }} />
                  ) : (
                    <span className="capas-badge-soon">próx.</span>
                  )}
                </button>
                {cat.expanded && tieneCapas && (
                  <div className="capas-list">
                    {capasDeCategoria.map((capa) => (
                      <div key={capa.id} className="capas-item">
                        <div className="capas-item-info">
                          <div className="capas-item-nombre">{capa.nombre}</div>
                          <div className="capas-item-sub">{capa.subtitulo}</div>
                        </div>
                        <button
                          type="button"
                          className={`capas-eye-btn ${capa.visible ? "active" : ""}`}
                          onClick={() => toggleCapa(capa.id)}
                          title={capa.visible ? "Ocultar" : "Mostrar"}
                        >
                          {capa.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="capas-sidebar-footer">
          <label className="capas-toggle-labels">
            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
            <Tag size={13} /> Etiquetas
          </label>
        </div>
      </aside>

      {/* Mapa */}
      <div className="capas-map-wrap">
        {loading && <div className="capas-loading">Cargando datos…</div>}
        <PiezometroMap
          piezometros={piezometros}
          center={SENTINA_CENTER}
          visible={piezometrosVisibles}
          showLabels={showLabels}
          onPiezoSelect={handlePiezoSelect}
        />

        {/* Leyenda */}
        {piezometrosVisibles && !loading && piezometros.length > 0 && (
          <div className="capas-legend">
            <div className="capas-legend-title">
              <Droplet size={13} /> Piezómetros ({piezometros.length})
            </div>
            {(["ALARMA", "ALERTA", "ADVERTENCIA", "NORMAL", "SIN_DATO"] as const).map((k) => (
              counts[k] > 0 && (
                <div key={k} className="capas-legend-item">
                  <span className="capas-legend-dot" style={{ background: ALERT_COLORS[k] }} />
                  <span>{k.replace("_", " ")}</span>
                  <span className="capas-legend-count">{counts[k]}</span>
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {/* Panel flotante arrastrable */}
      {selectedPiezo && (
        <div
          className="piezo-float-panel"
          style={{ left: panelPos.x, top: panelPos.y }}
        >
          <div className="piezo-float-header" onMouseDown={onDragStart}>
            <span>PIEZÓMETROS</span>
            <button type="button" onClick={() => setSelectedPiezo(null)}><X size={14} /></button>
          </div>
          <div className="piezo-float-body">
            <div className="piezo-float-row">
              <span className="piezo-float-label">Nombre</span>
              <span className="piezo-float-value"><strong>{selectedPiezo.identificador}</strong></span>
            </div>

            <div className="piezo-float-section">INFORMACIÓN</div>
            <div className="piezo-float-row">
              <span className="piezo-float-label">Cota inst [m]</span>
              <span className="piezo-float-value">{selectedPiezo.cota_instalacion ?? "—"}</span>
            </div>
            <div className="piezo-float-row">
              <span className="piezo-float-label">Tipo</span>
              <span className="piezo-float-value">{(selectedPiezo.tipo_nombre || "—").replace("_", " ")}</span>
            </div>

            <div className="piezo-float-section">MEDICIÓN</div>
            <div className="piezo-float-row">
              <span className="piezo-float-label">Primera</span>
              <span className="piezo-float-value" style={{ whiteSpace: "pre-line" }}>{formatDateShort(selectedPiezo.primera_fecha)}</span>
            </div>
            <div className="piezo-float-row">
              <span className="piezo-float-label">Última</span>
              <span className="piezo-float-value" style={{ whiteSpace: "pre-line" }}>{formatDateShort(selectedPiezo.ultima_fecha)}</span>
            </div>
            <div className="piezo-float-row">
              <span className="piezo-float-label">Registros</span>
              <span className="piezo-float-value">{selectedPiezo.total_registros ?? "—"}</span>
            </div>
            <div className="piezo-float-row">
              <span className="piezo-float-label">Presión inicial [bar]</span>
              <span className="piezo-float-value">{selectedPiezo.primera_presion ?? "—"}</span>
            </div>
            <div className="piezo-float-row">
              <span className="piezo-float-label">Presión actual [bar]</span>
              <span className="piezo-float-value">{selectedPiezo.ultima_presion ?? "—"}</span>
            </div>
            <div className="piezo-float-row">
              <span className="piezo-float-label">Niv. Piez. [m]</span>
              <span className="piezo-float-value">{selectedPiezo.ultimo_nivel ?? "—"}</span>
            </div>
            <div className="piezo-float-row">
              <span className="piezo-float-label">Diferencia [m]</span>
              <span className="piezo-float-value">{selectedPiezo.diferencia_m ?? "—"}</span>
            </div>

            <div className="piezo-float-section">ESTADO</div>
            <div className="piezo-float-row">
              <span className="piezo-float-label">Estado</span>
              <span className="piezo-float-value" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 12, height: 12, background: alertColorName, display: "inline-block", borderRadius: 2 }} />
                <span style={{ color: alertColorName, fontWeight: 700 }}>{selectedPiezo.nivel_alerta}</span>
              </span>
            </div>
            <div className="piezo-float-row">
              <span className="piezo-float-label">U. Advert. [m]</span>
              <span className="piezo-float-value">{selectedPiezo.umbral_advertencia ?? "—"}</span>
            </div>
            <div className="piezo-float-row">
              <span className="piezo-float-label">U. Alerta [m]</span>
              <span className="piezo-float-value">{selectedPiezo.umbral_alerta ?? "—"}</span>
            </div>
            <div className="piezo-float-row">
              <span className="piezo-float-label">U. Alarma [m]</span>
              <span className="piezo-float-value">{selectedPiezo.umbral_alarma ?? "—"}</span>
            </div>

            <div className="piezo-float-section" style={{ marginTop: 6, paddingTop: 8, borderTop: "1px solid var(--card-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <span>COORDS</span>
              <div style={{ display: "flex", gap: 2, padding: 2, background: "var(--card-border)", borderRadius: 6 }}>
                {(["GEO", "UTM", "MINA"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCoordTab(t)}
                    style={{
                      padding: "2px 8px",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.4,
                      borderRadius: 4,
                      border: "none",
                      cursor: "pointer",
                      background: coordTab === t ? "var(--accent)" : "transparent",
                      color: coordTab === t ? "#fff" : "var(--text-muted)",
                      transition: "background 0.15s ease",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {coordSets ? (
              <>
                <div className="piezo-float-row">
                  <span className="piezo-float-label">{coordSets[coordTab].a.label}</span>
                  <span className="piezo-float-value">{coordSets[coordTab].a.value}</span>
                </div>
                <div className="piezo-float-row">
                  <span className="piezo-float-label">{coordSets[coordTab].b.label}</span>
                  <span className="piezo-float-value">{coordSets[coordTab].b.value}</span>
                </div>
                {coordSets[coordTab].extra && (
                  <div className="piezo-float-row">
                    <span className="piezo-float-label">Sistema</span>
                    <span className="piezo-float-value" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {coordSets[coordTab].extra}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="piezo-float-row">
                <span className="piezo-float-value" style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                  Sin coordenadas
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
