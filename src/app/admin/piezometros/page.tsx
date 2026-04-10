"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import {
  Plus, Pencil, Archive, X, Droplet, Upload,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";

interface Grupo { id: number; nombre: string; }
interface Tipo { id: number; nombre: string; }

type SistemaCoord = "LOCAL" | "UTM" | "GEOGRAFICA";

interface Piezometro {
  id: number;
  grupo_id: number;
  tipo_id: number;
  identificador: string;
  latitud: string | null;
  longitud: string | null;
  sistema_coordenada: SistemaCoord | null;
  coord_este: string | null;
  coord_norte: string | null;
  zona_utm: string | null;
  cota_instalacion: string | null;
  umbral_advertencia: string | null;
  umbral_alerta: string | null;
  umbral_alarma: string | null;
  ascenso_cm_semana: string | null;
  ascenso_historico: string | null;
  archivado: boolean;
  grupo_nombre: string;
  tipo_nombre: string;
}

const emptyForm = {
  grupo_id: "",
  tipo_id: "",
  identificador: "",
  sistema_coordenada: "GEOGRAFICA" as SistemaCoord,
  coord_este: "",
  coord_norte: "",
  zona_utm: "19S",
  cota_instalacion: "",
  umbral_advertencia: "",
  umbral_alerta: "",
  umbral_alarma: "",
  ascenso_cm_semana: "",
  ascenso_historico: "",
};

interface ImportRecord {
  identificador: string;
  fecha_lectura: string;
  presion_bar: number | null;
}

interface ImportPreview {
  identificadores: string[];
  totalRows: number;
  records: ImportRecord[];
  fileType: "FO" | "CV";
}

function excelSerialToDateStr(serial: number): string {
  const d = new Date((serial - 25569) * 86400 * 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function parseSheet_FO(sheet: XLSX.WorkSheet): ImportRecord[] {
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });
  // Row 0 = column headers (TIMESTAMP, RECORD, DAS_Batt, PA_1, PA_2, ...)
  // Row 1 = units (TS, RN, Volts, Bar, Bar, ...)
  // Row 2 = aggregation type (Smp)
  // Row 3+ = data
  const headers: string[] = (data[0] as any[]) || [];
  const units: string[] = (data[1] as any[]) || [];
  const records: ImportRecord[] = [];

  // Only include columns whose unit is "Bar" or "BAR" and header is a piezometer name
  // (skip RECORD, DAS_Batt, DAS_Temp, BAROM, SM2_T, etc.)
  const EXCLUDED_HEADERS = new Set(["RECORD", "DAS_Batt", "DAS_LiBat", "DAS_Temp", "BAROM", "SM2_T"]);
  const piezCols: number[] = [];
  for (let col = 1; col < headers.length; col++) {
    const unit = String(units[col] || "").trim().toLowerCase();
    const header = String(headers[col] || "").trim();
    if (unit === "bar" && !EXCLUDED_HEADERS.has(header)) piezCols.push(col);
  }

  for (let i = 3; i < data.length; i++) {
    const row: any[] = data[i] as any[];
    if (!row || !row[0]) continue;
    const timestamp = String(row[0]).trim();
    if (!timestamp) continue;
    for (const col of piezCols) {
      const identificador = String(headers[col] || "").trim();
      if (!identificador) continue;
      const val = row[col];
      const presion = val !== null && val !== "" && String(val) !== "NAN" && !isNaN(Number(val)) ? Number(val) : null;
      records.push({ identificador, fecha_lectura: timestamp, presion_bar: presion });
    }
  }
  return records;
}

function parseSheet_CV(sheet: XLSX.WorkSheet): ImportRecord[] {
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });
  // Row 7 (index 7) = piezometer names repeated across pairs
  // Row 8 (index 8) = headers: Fecha, Presión Leida, Fecha, Presión Leida...
  // Row 10+ = data
  const nameRow: any[] = (data[7] as any[]) || [];
  const records: ImportRecord[] = [];

  // Find pairs: piezometer names in row 7 at columns 0, 2, 4, 6...
  // Structure: each piezometer occupies 2 columns:
  //   Row 7:  [PP1-PCV] [null]    [PP5-PCV] [null]    [SG2-PCV] [null]    ...
  //   Row 8:  [Fecha]   [Presión] [Fecha]   [Presión] [Fecha]   [Presión] ...
  //   Row 10+: [date]   [value]   [date]    [value]   [date]    [value]   ...
  // So: dateCol = col, presCol = col + 1
  const pairs: Array<{ name: string; dateCol: number; presCol: number }> = [];
  for (let col = 0; col < nameRow.length; col++) {
    const rawName = nameRow[col] ? String(nameRow[col]).trim() : "";
    // Valid piezometer names must contain at least one letter (skip numbers, dates, etc.)
    if (rawName && /[a-zA-Z]/.test(rawName) && rawName !== "Fecha" && !rawName.includes("Presión") && rawName !== "null") {
      // Strip -PCV suffix so PP1-PCV → PP1, SG2-PCV → SG2, etc.
      const name = rawName.replace(/-PCV$/i, "");
      if (col + 1 < nameRow.length) {
        pairs.push({ name, dateCol: col, presCol: col + 1 });
      }
    }
  }

  for (let i = 10; i < data.length; i++) {
    const row: any[] = data[i] as any[];
    if (!row) continue;
    for (const pair of pairs) {
      const dateVal = row[pair.dateCol];
      const presVal = row[pair.presCol];
      if (dateVal === null || dateVal === undefined || dateVal === "") continue;
      let dateStr = "";
      if (typeof dateVal === "number") {
        dateStr = excelSerialToDateStr(dateVal);
      } else {
        const s = String(dateVal).trim();
        if (!s) continue;
        const parsed = new Date(s);
        if (isNaN(parsed.getTime())) continue;
        const pad = (n: number) => n.toString().padStart(2, "0");
        dateStr = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
      }
      const presion = presVal !== null && presVal !== "" && !isNaN(Number(presVal)) ? Number(presVal) : null;
      records.push({ identificador: pair.name, fecha_lectura: dateStr, presion_bar: presion });
    }
  }
  return records;
}

function detectSheetType(sheet: XLSX.WorkSheet): "FO" | "CV" {
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });
  // FO: row 0 has TIMESTAMP/Columna1, row 1 has "Bar"/"BAR" as units
  // CV: row 7 has piezometer names with -PCV suffix, row 8 has "Fecha" / "Presión Leida"
  const row1: any[] = (data[1] as any[]) || [];
  if (row1.some((v) => String(v || "").trim().toLowerCase() === "bar")) return "FO";
  // Check row 8 for CV headers
  const row8: any[] = (data[8] as any[]) || [];
  if (row8.some((v) => String(v || "").includes("Presión"))) return "CV";
  // Fallback: check if row 0 has TIMESTAMP-like header
  const row0: any[] = (data[0] as any[]) || [];
  if (row0.some((v) => String(v || "").toUpperCase().includes("TIMESTAMP"))) return "FO";
  return "CV";
}

export default function AdminPiezometrosPage() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [items, setItems] = useState<Piezometro[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = 10;

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number; not_found: string[] } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importAbortRef = useRef<AbortController | null>(null);

  const fetchPiezometros = async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      params.append("offset", ((p - 1) * limit).toString());
      const res = await fetch(`/api/piezometros?${params.toString()}`);
      const data = await res.json();
      setItems(data.piezometros || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadRefs = async () => {
    const [g, t] = await Promise.all([
      fetch("/api/grupos").then((r) => r.json()),
      fetch("/api/tipos-piezometro").then((r) => r.json()),
    ]);
    setGrupos(g.grupos || []);
    setTipos(t.tipos || []);
  };

  useEffect(() => { loadRefs(); }, []);
  useEffect(() => { fetchPiezometros(page); }, [page]);

  const handlePageChange = (newPage: number) => {
    const totalPages = Math.ceil(total / limit);
    if (newPage >= 1 && newPage <= totalPages) setPage(newPage);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (p: Piezometro) => {
    setEditingId(p.id);
    const sistema: SistemaCoord = p.sistema_coordenada ?? "GEOGRAFICA";
    // Si el registro viejo no trae coord_este/coord_norte, caemos a lon/lat
    // (así quedan editables piezómetros creados antes de la migración).
    const este =
      p.coord_este ?? (sistema === "GEOGRAFICA" ? p.longitud ?? "" : "");
    const norte =
      p.coord_norte ?? (sistema === "GEOGRAFICA" ? p.latitud ?? "" : "");
    setForm({
      grupo_id: String(p.grupo_id),
      tipo_id: String(p.tipo_id),
      identificador: p.identificador,
      sistema_coordenada: sistema,
      coord_este: este ?? "",
      coord_norte: norte ?? "",
      zona_utm: p.zona_utm ?? "19S",
      cota_instalacion: p.cota_instalacion ?? "",
      umbral_advertencia: p.umbral_advertencia ?? "",
      umbral_alerta: p.umbral_alerta ?? "",
      umbral_alarma: p.umbral_alarma ?? "",
      ascenso_cm_semana: p.ascenso_cm_semana ?? "",
      ascenso_historico: p.ascenso_historico ?? "",
    });
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        grupo_id: Number(form.grupo_id),
        tipo_id: Number(form.tipo_id),
        identificador: form.identificador.trim(),
        sistema_coordenada: form.sistema_coordenada,
        coord_este: form.coord_este !== "" ? Number(form.coord_este) : null,
        coord_norte: form.coord_norte !== "" ? Number(form.coord_norte) : null,
        zona_utm: form.sistema_coordenada === "UTM" ? form.zona_utm : null,
        cota_instalacion: form.cota_instalacion ? Number(form.cota_instalacion) : null,
        umbral_advertencia: form.umbral_advertencia ? Number(form.umbral_advertencia) : null,
        umbral_alerta: form.umbral_alerta ? Number(form.umbral_alerta) : null,
        umbral_alarma: form.umbral_alarma ? Number(form.umbral_alarma) : null,
        ascenso_cm_semana: form.ascenso_cm_semana ? Number(form.ascenso_cm_semana) : null,
        ascenso_historico: form.ascenso_historico ? Number(form.ascenso_historico) : null,
      };
      const url = editingId ? `/api/piezometros/${editingId}` : "/api/piezometros";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setShowForm(false);
      setPage(1);
      await fetchPiezometros(1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id: number) => {
    if (!confirm("¿Archivar este piezómetro?")) return;
    await fetch(`/api/piezometros/${id}`, { method: "DELETE" });
    await fetchPiezometros(page);
  };

  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const openImport = () => {
    setImportStep("upload");
    setImportPreview(null);
    setImportResult(null);
    setImportError(null);
    setShowImport(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });

        let allRecords: ImportRecord[] = [];
        let detectedType: "FO" | "CV" = "FO";
        for (const sheetName of wb.SheetNames) {
          const sheet = wb.Sheets[sheetName];
          // Detect type per sheet (CV file can have FO-format PW sheets)
          const sheetType = detectSheetType(sheet);
          if (sheetName === wb.SheetNames[0]) detectedType = sheetType;
          const parsed = sheetType === "FO" ? parseSheet_FO(sheet) : parseSheet_CV(sheet);
          allRecords = allRecords.concat(parsed);
        }

        const uniqueIds = [...new Set(allRecords.map((r) => r.identificador))];
        setImportPreview({
          identificadores: uniqueIds,
          totalRows: allRecords.length,
          records: allRecords,
          fileType: detectedType,
        });
        setImportStep("preview");
      } catch (err: any) {
        setImportError("Error al procesar el archivo: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setImportStep("importing");
    setImportError(null);

    // Vercel corta requests > 4.5 MB en el edge proxy y mata las funciones
    // Serverless a los 10 s en plan Hobby. Con 5k records cada chunk pesa
    // ~400 KB y se inserta en una sola pasada al backend, dejando margen
    // amplio en ambos límites.
    const CHUNK_SIZE = 5_000;
    const records = importPreview.records;
    const total = Math.ceil(records.length / CHUNK_SIZE);
    setImportProgress({ done: 0, total });

    const acc = { inserted: 0, skipped: 0, not_found: new Set<string>() };

    const controller = new AbortController();
    importAbortRef.current = controller;

    try {
      for (let start = 0, idx = 0; start < records.length; start += CHUNK_SIZE, idx++) {
        const chunk = records.slice(start, start + CHUNK_SIZE);
        const res = await fetch("/api/import/mediciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: chunk }),
          signal: controller.signal,
        });
        // Lectura defensiva: si el host (Vercel) responde con texto plano
        // (413, 504, etc.) `res.json()` reventaba con "Unexpected token 'R'"
        // y enmascaraba el error real.
        const ct = res.headers.get("content-type") || "";
        const data = ct.includes("application/json")
          ? await res.json()
          : { error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
        if (!res.ok) {
          throw new Error(
            data.error ||
            `Error ${res.status} en chunk ${idx + 1}/${total}`
          );
        }
        acc.inserted += data.inserted ?? 0;
        acc.skipped += data.skipped ?? 0;
        (data.not_found ?? []).forEach((id: string) => acc.not_found.add(id));
        setImportProgress({ done: idx + 1, total });
      }
      setImportResult({
        inserted: acc.inserted,
        skipped: acc.skipped,
        not_found: Array.from(acc.not_found),
      });
      setImportStep("done");
    } catch (err: any) {
      if (err.name === "AbortError") {
        setImportError(
          `Importación cancelada. Se alcanzaron a insertar ${acc.inserted.toLocaleString()} registros antes de cancelar.`
        );
      } else {
        setImportError(err.message);
      }
      setImportStep("preview");
    } finally {
      importAbortRef.current = null;
      setImportProgress(null);
    }
  };

  const cancelImport = () => {
    importAbortRef.current?.abort();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <main className="container animate-fade-in">
      <header style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Droplet size={22} /> Admin — Piezómetros
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Gestión de piezómetros de instrumentación geotécnica
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={openImport}>
            <Upload size={16} /> Importar Mediciones
          </button>
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={18} /> Nuevo Piezómetro
          </button>
        </div>
      </header>

      <section className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Cargando…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
            No hay piezómetros registrados. Crea el primero.
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 0, padding: "0.8rem 1rem", display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.85rem", borderBottom: "1px solid var(--card-border)" }}>
              <span>Mostrando {items.length} de {total} piezómetros</span>
              <span>Página {page} de {totalPages}</span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "var(--panel-header-bg)", textAlign: "left" }}>
                    <th style={thStyle}>Identificador</th>
                    <th style={thStyle}>Grupo</th>
                    <th style={thStyle}>Tipo</th>
                    <th style={thStyle}>Lat / Lon</th>
                    <th style={thStyle}>Cota (m)</th>
                    <th style={thStyle}>Umbrales (Adv/Ale/Ala)</th>
                    <th style={thStyle}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id} style={{ borderTop: "1px solid var(--card-border)" }}>
                      <td style={tdStyle}><strong>{p.identificador}</strong></td>
                      <td style={tdStyle}>{p.grupo_nombre}</td>
                      <td style={tdStyle}>{p.tipo_nombre?.replace("_", " ")}</td>
                      <td style={tdStyle}>
                        {p.latitud && p.longitud
                          ? `${Number(p.latitud).toFixed(5)}, ${Number(p.longitud).toFixed(5)}`
                          : "—"}
                      </td>
                      <td style={tdStyle}>{p.cota_instalacion ?? "—"}</td>
                      <td style={tdStyle}>
                        {p.umbral_advertencia ?? "—"} / {p.umbral_alerta ?? "—"} / {p.umbral_alarma ?? "—"}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button className="btn-icon" title="Editar" onClick={() => openEdit(p)}>
                            <Pencil size={16} />
                          </button>
                          <button className="btn-icon" title="Archivar" onClick={() => archive(p.id)}>
                            <Archive size={16} />
                          </button>
                        </div>
                      </td>
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

      {showImport && createPortal(
        <div
          onClick={() => { if (importStep !== "importing") setShowImport(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-card"
            style={{ maxWidth: 560, width: "100%", background: "var(--panel-bg)", transform: "none", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Upload size={18} /> Importar Mediciones
              </h2>
              <button
                className="btn-icon"
                onClick={() => setShowImport(false)}
                disabled={importStep === "importing"}
                title={importStep === "importing" ? "No se puede cerrar durante la importación" : "Cerrar"}
                style={importStep === "importing" ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
              >
                <X size={18} />
              </button>
            </div>

            {importError && (
              <div style={{ padding: "0.6rem 0.8rem", marginBottom: "1rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#ef4444", fontSize: "0.85rem" }}>
                {importError}
              </div>
            )}

            {importStep === "upload" && (
              <div style={{ textAlign: "center" }}>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
                  Selecciona un archivo Excel (.xlsx) de mediciones.<br />
                  Compatible con formato <strong>CV</strong> (Cuerda Vibrante) y <strong>FO</strong> (Fibra Óptica).
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <button
                  className="btn btn-primary"
                  style={{ padding: "0.75rem 2rem", fontSize: "1rem" }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={18} /> Seleccionar archivo .xlsx
                </button>
              </div>
            )}

            {importStep === "preview" && importPreview && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.2rem" }}>
                  <div style={previewStatStyle}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Tipo detectado</span>
                    <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--accent)" }}>{importPreview.fileType}</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {importPreview.fileType === "FO" ? "Fibra Óptica" : "Cuerda Vibrante"}
                    </span>
                  </div>
                  <div style={previewStatStyle}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Registros a insertar</span>
                    <span style={{ fontSize: "1.4rem", fontWeight: 800 }}>{importPreview.totalRows.toLocaleString()}</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>filas en el archivo</span>
                  </div>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.5rem", fontWeight: 600 }}>
                    Piezómetros detectados ({importPreview.identificadores.length}):
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {importPreview.identificadores.map((id) => (
                      <span key={id} style={{
                        padding: "0.2rem 0.6rem", borderRadius: 20, fontSize: "0.78rem",
                        background: "rgba(16,185,129,0.12)", color: "#10b981",
                        border: "1px solid rgba(16,185,129,0.25)"
                      }}>{id}</span>
                    ))}
                  </div>
                </div>

                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "1.2rem" }}>
                  Los registros duplicados (mismo piezómetro + fecha) serán ignorados automáticamente.
                </p>

                <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
                  <button className="btn btn-secondary" onClick={() => { setImportStep("upload"); setImportPreview(null); }}>
                    Volver
                  </button>
                  <button className="btn btn-primary" onClick={handleImportConfirm}>
                    Confirmar importación
                  </button>
                </div>
              </div>
            )}

            {importStep === "importing" && (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <span className="btn-spinner" style={{ width: 32, height: 32, borderWidth: 3, display: "inline-block", marginBottom: "1rem" }} />
                <p style={{ color: "var(--text-muted)", marginBottom: importProgress ? "0.8rem" : 0 }}>
                  {importProgress
                    ? `Insertando lote ${importProgress.done} de ${importProgress.total}…`
                    : "Insertando registros…"}
                </p>
                {importProgress && (
                  <div style={{ maxWidth: 320, margin: "0 auto" }}>
                    <div style={{ height: 8, background: "var(--card-border)", borderRadius: 999, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round((importProgress.done / importProgress.total) * 100)}%`,
                          background: "var(--accent)",
                          transition: "width 0.2s ease",
                        }}
                      />
                    </div>
                    <p style={{ marginTop: "0.4rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {Math.round((importProgress.done / importProgress.total) * 100)}%
                    </p>
                  </div>
                )}
                <div style={{ marginTop: "1.5rem" }}>
                  <button className="btn btn-secondary" onClick={cancelImport}>
                    <X size={16} /> Cancelar importación
                  </button>
                </div>
              </div>
            )}

            {importStep === "done" && importResult && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.2rem" }}>
                  <div style={{ ...previewStatStyle, borderColor: "rgba(16,185,129,0.3)" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Insertados</span>
                    <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "#10b981" }}>{importResult.inserted.toLocaleString()}</span>
                  </div>
                  <div style={previewStatStyle}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Omitidos (duplicados)</span>
                    <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-muted)" }}>{importResult.skipped.toLocaleString()}</span>
                  </div>
                </div>
                {importResult.not_found.length > 0 && (
                  <div style={{ padding: "0.6rem 0.8rem", marginBottom: "1rem", background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 8, fontSize: "0.83rem" }}>
                    <strong style={{ color: "#eab308" }}>Piezómetros no encontrados en BD:</strong>
                    <div style={{ marginTop: "0.3rem", color: "var(--text-muted)" }}>{importResult.not_found.join(", ")}</div>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn btn-primary" onClick={() => setShowImport(false)}>Cerrar</button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {showForm && createPortal(
        <div
          onClick={() => setShowForm(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem"
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="glass-card"
            style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto", background: "var(--panel-bg)", transform: "none" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700 }}>
                {editingId ? "Editar Piezómetro" : "Nuevo Piezómetro"}
              </h2>
              <button type="button" className="btn-icon" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>

            {error && (
              <div style={{ padding: "0.6rem 0.8rem", marginBottom: "1rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#ef4444", fontSize: "0.85rem" }}>
                {error}
              </div>
            )}

            <div style={gridStyle}>
              <div className="filter-group" style={{ gridColumn: "span 2" }}>
                <label>Identificador *</label>
                <input required value={form.identificador} onChange={field("identificador")} placeholder="PZ-001" />
              </div>
              <div className="filter-group">
                <label>Grupo *</label>
                <select required value={form.grupo_id} onChange={field("grupo_id")}>
                  <option value="">Selecciona…</option>
                  {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </div>
              <div className="filter-group">
                <label>Tipo *</label>
                <select required value={form.tipo_id} onChange={field("tipo_id")}>
                  <option value="">Selecciona…</option>
                  {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre.replace("_", " ")}</option>)}
                </select>
              </div>
              <div className="filter-group" style={{ gridColumn: "span 2" }}>
                <label style={{ marginBottom: 6 }}>Ubicación geográfica</label>
                <div style={{
                  border: "1px solid var(--card-border)",
                  borderRadius: 8,
                  padding: "0.75rem 0.9rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {([
                      { v: "LOCAL",      label: "Sistema Local Collahuasi" },
                      { v: "UTM",        label: "WGS84 UTM" },
                      { v: "GEOGRAFICA", label: "Coordenadas Geográficas" },
                    ] as const).map((opt) => (
                      <label key={opt.v} style={{ display: "flex", alignItems: "center", gap: "0.55rem", cursor: "pointer", fontSize: "0.88rem", fontWeight: 500 }}>
                        <input
                          type="radio"
                          name="sistema_coordenada"
                          value={opt.v}
                          checked={form.sistema_coordenada === opt.v}
                          onChange={() => setForm({ ...form, sistema_coordenada: opt.v, coord_este: "", coord_norte: "" })}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                    {form.sistema_coordenada === "GEOGRAFICA" ? (
                      <>
                        <div className="filter-group" style={{ margin: 0 }}>
                          <label>Longitud</label>
                          <input type="number" step="any" value={form.coord_este} onChange={field("coord_este")} placeholder="-68.603681" />
                        </div>
                        <div className="filter-group" style={{ margin: 0 }}>
                          <label>Latitud</label>
                          <input type="number" step="any" value={form.coord_norte} onChange={field("coord_norte")} placeholder="-20.940803" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="filter-group" style={{ margin: 0 }}>
                          <label>Este [m]</label>
                          <input type="number" step="any" value={form.coord_este} onChange={field("coord_este")} />
                        </div>
                        <div className="filter-group" style={{ margin: 0 }}>
                          <label>Norte [m]</label>
                          <input type="number" step="any" value={form.coord_norte} onChange={field("coord_norte")} />
                        </div>
                      </>
                    )}
                  </div>

                  {form.sistema_coordenada === "UTM" && (
                    <div className="filter-group" style={{ margin: 0 }}>
                      <label>Zona UTM</label>
                      <select value={form.zona_utm} onChange={field("zona_utm")}>
                        <option value="18S">18 Sur</option>
                        <option value="19S">19 Sur (Collahuasi)</option>
                        <option value="20S">20 Sur</option>
                      </select>
                    </div>
                  )}

                  {form.sistema_coordenada === "LOCAL" && (
                    <div style={{
                      padding: "0.55rem 0.7rem",
                      background: "rgba(59,130,246,0.1)",
                      border: "1px solid rgba(59,130,246,0.3)",
                      borderRadius: 6,
                      fontSize: "0.75rem",
                      color: "var(--accent)",
                      lineHeight: 1.4,
                    }}>
                      Se aplica la transformación oficial Collahuasi (GeoExploraciones 2009, SLC → UTM 19S → WGS84) para mostrar el piezómetro en el mapa.
                    </div>
                  )}
                </div>
              </div>
              <div className="filter-group" style={{ gridColumn: "span 2" }}>
                <label>Cota instalación (m)</label>
                <input type="number" step="any" value={form.cota_instalacion} onChange={field("cota_instalacion")} />
              </div>
              <div className="filter-group">
                <label>Umbral Advertencia (m)</label>
                <input type="number" step="any" value={form.umbral_advertencia} onChange={field("umbral_advertencia")} />
              </div>
              <div className="filter-group">
                <label>Umbral Alerta (m)</label>
                <input type="number" step="any" value={form.umbral_alerta} onChange={field("umbral_alerta")} />
              </div>
              <div className="filter-group">
                <label>Umbral Alarma (m)</label>
                <input type="number" step="any" value={form.umbral_alarma} onChange={field("umbral_alarma")} />
              </div>
              <div className="filter-group">
                <label>Ascenso cm/semana</label>
                <input type="number" step="any" value={form.ascenso_cm_semana} onChange={field("ascenso_cm_semana")} />
              </div>
              <div className="filter-group" style={{ gridColumn: "span 2" }}>
                <label>Ascenso Histórico</label>
                <input type="number" step="any" value={form.ascenso_historico} onChange={field("ascenso_historico")} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end", marginTop: "1.2rem" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Guardando…" : editingId ? "Actualizar" : "Crear"}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </main>
  );
}

const thStyle: React.CSSProperties = { padding: "0.75rem 1rem", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.03em" };
const tdStyle: React.CSSProperties = { padding: "0.75rem 1rem" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" };
const previewStatStyle: React.CSSProperties = { padding: "1rem", borderRadius: 10, background: "var(--card-bg)", border: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: "0.2rem" };
