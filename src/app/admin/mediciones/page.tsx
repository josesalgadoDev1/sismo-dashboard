"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList, Plus,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";

interface Piezometro { id: number; identificador: string; grupo_nombre: string; cota_instalacion: string | null; }
interface Medicion {
  id: number;
  piezometro_id: number;
  fecha_lectura: string;
  cota_instalacion: string | null;
  nivel_piez: string | null;
  offset_m: string | null;
  presion_bar: string | null;
}

const todayLocal = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function AdminMedicionesPage() {
  const [piezometros, setPiezometros] = useState<Piezometro[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [mediciones, setMediciones] = useState<Medicion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = 10;

  const [form, setForm] = useState({
    fecha_lectura: todayLocal(),
    cota_instalacion: "",
    nivel_piez: "",
    offset_m: "",
    presion_bar: "",
  });

  const loadPiezometros = async () => {
    const r = await fetch("/api/piezometros?limit=200").then((r) => r.json());
    setPiezometros(r.piezometros || []);
  };

  const loadMediciones = async (pid: string, p = 1) => {
    if (!pid) { setMediciones([]); setTotal(0); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("piezometro_id", pid);
      params.append("limit", limit.toString());
      params.append("offset", ((p - 1) * limit).toString());
      const r = await fetch(`/api/mediciones?${params.toString()}`).then((r) => r.json());
      setMediciones(r.mediciones || []);
      setTotal(r.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPiezometros(); }, []);

  useEffect(() => {
    setPage(1);
    loadMediciones(selected, 1);
  }, [selected]);

  useEffect(() => {
    loadMediciones(selected, page);
  }, [page]);

  // Prefill cota_instalacion del piezómetro seleccionado
  useEffect(() => {
    if (!selected) return;
    const p = piezometros.find((x) => String(x.id) === selected);
    if (p?.cota_instalacion && !form.cota_instalacion) {
      setForm((f) => ({ ...f, cota_instalacion: p.cota_instalacion as string }));
    }
  }, [selected, piezometros]);

  const handlePageChange = (newPage: number) => {
    const totalPages = Math.ceil(total / limit);
    if (newPage >= 1 && newPage <= totalPages) setPage(newPage);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) { setError("Selecciona un piezómetro"); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        piezometro_id: Number(selected),
        fecha_lectura: form.fecha_lectura,
        cota_instalacion: form.cota_instalacion ? Number(form.cota_instalacion) : null,
        nivel_piez: form.nivel_piez ? Number(form.nivel_piez) : null,
        offset_m: form.offset_m ? Number(form.offset_m) : null,
        presion_bar: form.presion_bar ? Number(form.presion_bar) : null,
      };
      const res = await fetch("/api/mediciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setForm({ ...form, fecha_lectura: todayLocal(), nivel_piez: "", offset_m: "", presion_bar: "" });
      setPage(1);
      await loadMediciones(selected, 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const totalPages = Math.ceil(total / limit);

  return (
    <main className="container animate-fade-in">
      <header style={{ marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ClipboardList size={22} /> Admin — Mediciones Piezómetros
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Registro manual de lecturas
        </p>
      </header>

      <section className="glass-card" style={{ marginBottom: "1rem" }}>
        <div className="filter-group" style={{ maxWidth: 480 }}>
          <label>Piezómetro</label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Selecciona un piezómetro…</option>
            {piezometros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.grupo_nombre} — {p.identificador}
              </option>
            ))}
          </select>
        </div>
      </section>

      {selected && (
        <>
          <section className="glass-card" style={{ marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Plus size={16} /> Nueva medición
            </h2>

            {error && (
              <div style={{ padding: "0.6rem 0.8rem", marginBottom: "1rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#ef4444", fontSize: "0.85rem" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", alignItems: "end" }}>
              <div className="filter-group">
                <label>Fecha lectura *</label>
                <input type="datetime-local" required value={form.fecha_lectura} onChange={field("fecha_lectura")} />
              </div>
              <div className="filter-group">
                <label>Cota instalación (m)</label>
                <input type="number" step="any" value={form.cota_instalacion} onChange={field("cota_instalacion")} />
              </div>
              <div className="filter-group">
                <label>Nivel piez. (m)</label>
                <input type="number" step="any" value={form.nivel_piez} onChange={field("nivel_piez")} />
              </div>
              <div className="filter-group">
                <label>Offset (m)</label>
                <input type="number" step="any" value={form.offset_m} onChange={field("offset_m")} />
              </div>
              <div className="filter-group">
                <label>Presión (bar)</label>
                <input type="number" step="any" value={form.presion_bar} onChange={field("presion_bar")} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Guardando…" : "Agregar"}
              </button>
            </form>
          </section>

          <section className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Cargando…</div>
            ) : mediciones.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Sin mediciones registradas.</div>
            ) : (
              <>
                <div style={{ padding: "0.8rem 1rem", display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.85rem", borderBottom: "1px solid var(--card-border)" }}>
                  <span>Mostrando {mediciones.length} de {total} mediciones</span>
                  <span>Página {page} de {totalPages}</span>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                      <tr style={{ background: "var(--panel-header-bg)", textAlign: "left" }}>
                        <th style={thStyle}>Fecha lectura</th>
                        <th style={thStyle}>Cota inst.</th>
                        <th style={thStyle}>Nivel piez.</th>
                        <th style={thStyle}>Offset</th>
                        <th style={thStyle}>Presión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mediciones.map((m) => (
                        <tr key={m.id} style={{ borderTop: "1px solid var(--card-border)" }}>
                          <td style={tdStyle}>
                            {new Date(m.fecha_lectura).toLocaleString("es-CL", { timeZone: "America/Santiago" })}
                          </td>
                          <td style={tdStyle}>{m.cota_instalacion ?? "—"}</td>
                          <td style={tdStyle}>{m.nivel_piez ?? "—"}</td>
                          <td style={tdStyle}>{m.offset_m ?? "—"}</td>
                          <td style={tdStyle}>{m.presion_bar ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="pagination">
                    <button className="btn-icon" onClick={() => handlePageChange(1)} disabled={page === 1} title="Ir a la primera página">
                      <ChevronsLeft size={20} />
                    </button>
                    <button className="btn-icon" onClick={() => handlePageChange(page - 1)} disabled={page === 1} title="Anterior">
                      <ChevronLeft size={20} />
                    </button>
                    <div className="pagination-numbers">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(page - p) <= 1)
                        .reduce((acc: any[], p, i, arr) => {
                          if (i > 0 && p - arr[i - 1] > 1) {
                            acc.push(<span key={`ellipsis-${p}`} className="pagination-ellipsis">...</span>);
                          }
                          acc.push(
                            <button key={p} className={`btn-page ${page === p ? "active" : ""}`} onClick={() => handlePageChange(p)}>
                              {p}
                            </button>
                          );
                          return acc;
                        }, [])}
                    </div>
                    <button className="btn-icon" onClick={() => handlePageChange(page + 1)} disabled={page === totalPages} title="Siguiente">
                      <ChevronRight size={20} />
                    </button>
                    <button className="btn-icon" onClick={() => handlePageChange(totalPages)} disabled={page === totalPages} title="Ir a la última página">
                      <ChevronsRight size={20} />
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}

const thStyle: React.CSSProperties = { padding: "0.75rem 1rem", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.03em" };
const tdStyle: React.CSSProperties = { padding: "0.75rem 1rem" };
