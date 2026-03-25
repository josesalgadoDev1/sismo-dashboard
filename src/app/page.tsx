"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Map as MapIcon,
  Filter,
  Download,
  FileText,
  Table as TableIcon,
  Globe,
  Calendar,
  Zap,
  Navigation,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  Sun,
  Moon
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";

interface Sismo {
  id: number;
  fecha_sismo: string;
  magnitud: number;
  profundidad: number;
  ubicacion: string;
  distancia_km: number;
  nivel_alerta: string;
  fecha_notificacion: string;
  latitud: string;
  longitud: string;
  escala: string;
}

export default function Home() {
  const [sismos, setSismos] = useState<Sismo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const limit = 10;

  useEffect(() => {
    // Restaurar tema si está guardado en localStorage
    const savedTheme = localStorage.getItem("sismo-theme");
    if (savedTheme === "dark") {
      setTheme("dark");
      document.body.classList.add("dark-mode");
    } else if (savedTheme === "light") {
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

  const [filters, setFilters] = useState({
    minMag: "",
    maxMag: "",
    startDate: "",
    endDate: "",
    maxDist: "",
  });

  const fetchSismos = async (p = page) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.minMag) params.append("minMag", filters.minMag);
    if (filters.maxMag) params.append("maxMag", filters.maxMag);
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);
    if (filters.maxDist) params.append("maxDist", filters.maxDist);
    params.append("limit", limit.toString());
    params.append("offset", ((p - 1) * limit).toString());

    try {
      const res = await fetch(`/api/sismos?${params.toString()}`);
      const result = await res.json();
      if (result.data) {
        setSismos(result.data);
        setTotal(result.total);
      } else {
        setSismos([]);
        setTotal(0);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchSismos(1);
    setPage(1);
  }, [filters]);

  useEffect(() => {
    fetchSismos(page);
  }, [page]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= Math.ceil(total / limit)) {
      setPage(newPage);
    }
  };

  const resetFilters = () => {
    setFilters({
      minMag: "",
      maxMag: "",
      startDate: "",
      endDate: "",
      maxDist: "",
    });
    setPage(1);
  };

  const fetchFullData = async () => {
    const params = new URLSearchParams();
    if (filters.minMag) params.append("minMag", filters.minMag);
    if (filters.maxMag) params.append("maxMag", filters.maxMag);
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);
    if (filters.maxDist) params.append("maxDist", filters.maxDist);
    params.append("limit", "2000"); // Límite alto para exportación completa

    try {
      const res = await fetch(`/api/sismos?${params.toString()}`);
      const result = await res.json();
      return result.data || [];
    } catch (err) {
      console.error("Export fetch error:", err);
      return [];
    }
  };

  const exportExcel = async () => {
    const allData = await fetchFullData();
    if (allData.length === 0) return;

    // Preparar datos con cabeceras bonitas
    const dataToExport = allData.map((s: Sismo) => ({
      "Fecha Sismo": new Date(s.fecha_sismo).toLocaleString("es-CL"),
      "Magnitud": `${Number(s.magnitud).toFixed(1)} ${s.escala?.toUpperCase() === 'MW' ? 'Mw' : 'Ml(Richter)'}`,
      "Profundidad (km)": s.profundidad,
      "Ubicación": s.ubicacion,
      "Latitud": s.latitud || "-",
      "Longitud": s.longitud || "-",
      "Distancia a Collahuasi (km)": s.distancia_km,
      "Nivel de Alerta": s.nivel_alerta,
      "Fecha Notificación": new Date(s.fecha_notificacion).toLocaleString("es-CL")
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);

    // Auto-size columnas (aproximado)
    const colWidths = [
      { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 40 }, { wch: 25 }, { wch: 15 }, { wch: 20 }
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sismos");
    XLSX.writeFile(wb, "Reporte_Sismos_Collahuasi.xlsx");
  };

  const exportCSV = async () => {
    const allData = await fetchFullData();
    if (allData.length === 0) return;

    const dataToExport = allData.map((s: Sismo) => ({
      "Fecha": new Date(s.fecha_sismo).toLocaleString("es-CL"),
      "Magnitud": `${Number(s.magnitud).toFixed(1)} ${s.escala?.toUpperCase() === 'MW' ? 'Mw' : 'Ml (Richter)'}`,
      "Nivel": s.nivel_alerta,
      "Ubicacion": s.ubicacion,
      "Latitud": s.latitud || "-",
      "Longitud": s.longitud || "-"
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Reporte_Sismos.csv");
    link.click();
  };

  const exportPDF = async () => {
    const allData = await fetchFullData();
    if (allData.length === 0) return;

    const doc = new jsPDF() as any;

    // Colores corporativos
    const primaryColor: [number, number, number] = [59, 130, 246]; // #3b82f6

    // Título y Header
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text("REPORTE DE MONITOREO SÍSMICO", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text("Área de Influencia: Mina Doña Inés de Collahuasi", 14, 28);
    doc.text(`Generado el: ${new Date().toLocaleString("es-CL")}`, 14, 34);

    // Línea decorativa
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(1);
    doc.line(14, 38, 196, 38);

    const tableData = allData.map((s: Sismo) => [
      new Date(s.fecha_sismo).toLocaleString("es-CL"),
      `${Number(s.magnitud).toFixed(1)} ${s.escala?.toUpperCase() === 'MW' ? 'Mw' : 'Ml(Richter)'}`,
      `${s.profundidad} km`,
      `${s.latitud || '-'}, ${s.longitud || '-'}`,
      `${s.distancia_km} km`,
      s.nivel_alerta
    ]);

    autoTable(doc, {
      head: [['Fecha', 'Mag', 'Prof', 'Coordenadas', 'Dist', 'Nivel']],
      body: tableData,
      startY: 45,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255] as [number, number, number],
        fontStyle: 'bold'
      },
      alternateRowStyles: { fillColor: [245, 247, 250] as [number, number, number] },
      columnStyles: {
        5: { fontStyle: 'bold' }
      },
      didDrawCell: (data: any) => {
        // Pintar la celda de Nivel según el valor
        if (data.section === 'body' && data.column.index === 5) {
          const level = data.cell.raw;
          if (level === 'ALARMA') doc.setTextColor(255, 0, 0); // #ff0000
          else if (level === 'ALERTA') doc.setTextColor(255, 140, 0); // #ff8c00
          else if (level === 'ADVERTENCIA') doc.setTextColor(255, 215, 0); // #ffd700
          else doc.setTextColor(76, 175, 80); // #4caf50
        }
      }
    });

    doc.save(`Reporte_Sismos_Collahuasi_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportKMZ = async () => {
    const allData = await fetchFullData();
    if (allData.length === 0) return;

    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Sismos Collahuasi</name>
    <Style id="alarma">
      <IconStyle><Icon><href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href></Icon></IconStyle>
    </Style>
    <Style id="alerta">
      <IconStyle><Icon><href>http://maps.google.com/mapfiles/kml/paddle/orange-circle.png</href></Icon></IconStyle>
    </Style>
    <Style id="advertencia">
      <IconStyle><Icon><href>http://maps.google.com/mapfiles/kml/paddle/ylw-circle.png</href></Icon></IconStyle>
    </Style>
    <Style id="normal">
      <IconStyle><Icon><href>http://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href></Icon></IconStyle>
    </Style>`;

    allData.forEach((s: Sismo) => {
      // Use real coordinates if they exist, otherwise fallback to random mock locations
      const lat = s.latitud ? parseFloat(s.latitud) : -20.98 + (Math.random() - 0.5) * 0.5;
      const lon = s.longitud ? parseFloat(s.longitud) : -68.66 + (Math.random() - 0.5) * 0.5;

      let style = '#normal';
      if (s.nivel_alerta === 'ALARMA') style = '#alarma';
      else if (s.nivel_alerta === 'ALERTA') style = '#alerta';
      else if (s.nivel_alerta === 'ADVERTENCIA') style = '#advertencia';

      kml += `
    <Placemark>
      <name>M ${Number(s.magnitud).toFixed(1)} - ${s.nivel_alerta}</name>
      <description><![CDATA[
        <div style="font-family: Arial; padding: 10px;">
          <h3 style="color: #3b82f6;">Sismo Detectado</h3>
          <p><b>Fecha:</b> ${new Date(s.fecha_sismo).toLocaleString("es-CL")}</p>
          <p><b>Ubicación:</b> ${s.ubicacion}</p>
          <p><b>Magnitud:</b> ${s.magnitud}</p>
          <p><b>Distancia:</b> ${s.distancia_km} km</p>
        </div>
      ]]></description>
      <styleUrl>${style}</styleUrl>
      <Point>
        <coordinates>${lon},${lat},0</coordinates> 
      </Point>
    </Placemark>`;
    });

    kml += `
  </Document>
</kml>`;

    try {
      const zip = new JSZip();
      zip.file("doc.kml", kml);
      const content = await zip.generateAsync({ type: "blob" });

      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "Sismos_Collahuasi.kmz");
      link.click();
    } catch (err) {
      console.error("Error generating KMZ:", err);
    }
  };

  const getMagColor = (mag: any) => {
    const val = Number(mag);
    if (val >= 6.0) return "magnitude-high";
    if (val >= 5.0) return "magnitude-mid";
    return "magnitude-low";
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <main className="container animate-fade-in">
      <header style={{ position: 'relative', marginBottom: '1rem' }}>
        <div style={{ position: 'absolute', right: 0, top: 0 }}>
          {mounted && (
            <button
              className="btn-icon"
              onClick={toggleTheme}
              title={theme === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
              style={{ borderRadius: '50%' }}
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <Activity size={32} color="#3b82f6" />
          <h1>Monitoreo Sísmico Collahuasi</h1>
        </div>
        <p className="subtitle">Sistema de Monitoreo Sísmico de Alta Precisión</p>
      </header>

      <section className="glass-card filters-section">
        <div className="filter-group">
          <label><Calendar size={14} style={{ marginRight: 4 }} /> Fecha Inicio</label>
          <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
        </div>
        <div className="filter-group">
          <label><Calendar size={14} style={{ marginRight: 4 }} /> Fecha Fin</label>
          <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
        </div>
        <div className="filter-group">
          <label><Zap size={14} style={{ marginRight: 4 }} /> Mag. Mínima</label>
          <input type="number" step="0.1" value={filters.minMag} onChange={(e) => setFilters({ ...filters, minMag: e.target.value })} placeholder="3.0" />
        </div>
        <div className="filter-group">
          <label>Distancia Máx (km)</label>
          <div className="input-with-icon">
            <Navigation size={18} />
            <input 
              type="number" 
              placeholder="300" 
              value={filters.maxDist} 
              onChange={(e) => setFilters({...filters, maxDist: e.target.value})}
            />
          </div>
        </div>
        <div className="filter-group" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: '0.5rem' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => fetchSismos(1)}>
            <Filter size={18} /> Filtrar
          </button>
          <button className="btn btn-secondary" style={{ padding: '0.8rem' }} title="Limpiar Filtros" onClick={resetFilters}>
            <RotateCcw size={18} />
          </button>
        </div>
      </section>

      {mounted && (
        <div className="export-buttons">
          <button className="btn btn-secondary" onClick={exportExcel} disabled={sismos.length === 0}><TableIcon size={18} /> Exportar Excel</button>
          <button className="btn btn-secondary" onClick={exportCSV} disabled={sismos.length === 0}><FileText size={18} /> Exportar CSV</button>
          <button className="btn btn-secondary" onClick={exportPDF} disabled={sismos.length === 0}><FileText size={18} /> Exportar PDF</button>
          <button className="btn btn-secondary" onClick={exportKMZ} disabled={sismos.length === 0}><Globe size={18} /> Google Earth</button>
        </div>
      )}

      <section className="earthquake-list">
        {loading ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="animate-pulse" style={{ fontSize: '1.2rem', color: '#3b82f6' }}>Conectando con base de datos...</div>
          </div>
        ) : sismos.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '1.2rem', color: '#94a3b8' }}>No se encontraron registros para estos filtros.</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '1rem', padding: '0 1rem', display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem' }}>
              <span>Mostrando {sismos.length} de {total} sismos</span>
              <span>Página {page} de {totalPages}</span>
            </div>
            {sismos.map((s, i) => (
              <div key={s.id} className="glass-card earthquake-item" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className={`magnitude-badge ${getMagColor(s.magnitud)}`}>
                  {Number(s.magnitud).toFixed(1)}
                </div>
                <div>
                  <div style={{fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.4rem'}}>{s.ubicacion}</div>
                  <div style={{display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap'}}>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      color: 'var(--accent)', 
                      background: 'var(--btn-bg)', 
                      padding: '2px 8px', 
                      borderRadius: '6px',
                      border: '1px solid var(--card-border)'
                    }}>
                      {s.escala?.toUpperCase() === 'MW' ? 'Mw' : 'Ml Richter'}
                    </span>
                    <span style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>
                      {new Date(s.fecha_sismo).toLocaleString("es-CL")}
                    </span>
                    {s.latitud && s.longitud && (
                      <span style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px'}}>
                        📍 {s.latitud}, {s.longitud}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Profundidad</div>
                  <div style={{ fontWeight: 600 }}>{s.profundidad} km</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Distancia</div>
                  <div style={{ fontWeight: 600, color: '#3b82f6' }}>{Number(s.distancia_km).toFixed(0)} km</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    background: s.nivel_alerta === 'ALARMA' ? 'rgba(255, 0, 0, 0.15)' :
                      s.nivel_alerta === 'ALERTA' ? 'rgba(255, 140, 0, 0.15)' :
                        s.nivel_alerta === 'ADVERTENCIA' ? 'rgba(255, 215, 0, 0.15)' : 'rgba(76, 175, 80, 0.15)',
                    color: s.nivel_alerta === 'ALARMA' ? '#ff0000' :
                      s.nivel_alerta === 'ALERTA' ? '#ff8c00' :
                        s.nivel_alerta === 'ADVERTENCIA' ? '#ffc107' : '#4caf50',
                    border: `1px solid ${s.nivel_alerta === 'ALARMA' ? '#ff0000' :
                      s.nivel_alerta === 'ALERTA' ? '#ff8c00' :
                        s.nivel_alerta === 'ADVERTENCIA' ? '#ffc107' : '#4caf50'}`
                  }}>
                    {s.nivel_alerta}
                  </span>
                </div>
              </div>
            ))}

            <div className="pagination">
              <button
                className="btn-icon"
                onClick={() => handlePageChange(1)}
                disabled={page === 1}
                title="Ir a la primera página"
              >
                <ChevronsLeft size={20} />
              </button>

              <button
                className="btn-icon"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                title="Anterior"
              >
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
                      <button
                        key={p}
                        className={`btn-page ${page === p ? 'active' : ''}`}
                        onClick={() => handlePageChange(p)}
                      >
                        {p}
                      </button>
                    );
                    return acc;
                  }, [])}
              </div>

              <button
                className="btn-icon"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                title="Siguiente"
              >
                <ChevronRight size={20} />
              </button>

              <button
                className="btn-icon"
                onClick={() => handlePageChange(totalPages)}
                disabled={page === totalPages}
                title="Ir a la última página"
              >
                <ChevronsRight size={20} />
              </button>
            </div>
          </>
        )}
      </section>

      <footer style={{ marginTop: '4rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>Sistema de Alerta Sísmica Collahuasi</div>
        &copy; 2026 Powered by Dares Tech Industrial Solutions
      </footer>
    </main>
  );
}
