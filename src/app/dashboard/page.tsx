"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  Map as MapIcon,
  Filter,
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
  Clock,
  Crosshair,
  Mountain,
  BarChart3,
  Info,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";

// Loading placeholder (must be defined before dynamic imports)
function LoadingBox() {
  return (
    <div className="loading-container">
      <div className="loading-spinner" />
      <span className="loading-text">Cargando...</span>
    </div>
  );
}

// Client-only components — ssr:false prevents 'window is not defined'
const SismoMap = dynamic(() => import("../components/SismoMap"), {
  ssr: false,
  loading: () => <LoadingBox />,
});
const TrendChart = dynamic(() => import("../components/TrendChart"), {
  ssr: false,
  loading: () => <LoadingBox />,
});

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

interface StatsData {
  kpi: {
    total: number;
    maxMagnitud: number;
    minDistancia: number;
    maxProfundidad: number;
    ultimoEvento: string | null;
    escalaMax: string;
  };
  alertCounts: Record<string, number>;
  trend: Array<{ fecha: string; cantidad: number; max_magnitud: number }>;
}

export default function DashboardPage() {
  const [sismos, setSismos] = useState<Sismo[]>([]);
  const [allSismosForMap, setAllSismosForMap] = useState<Sismo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const limit = 10;

  const [filters, setFilters] = useState({
    minMag: "",
    maxDist: "",
    startDate: "",
    endDate: "",
    estado: "",
  });

  const fetchIdRef = useRef(0);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.minMag) params.append("minMag", filters.minMag);
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);
    if (filters.maxDist) params.append("maxDist", filters.maxDist);
    if (filters.estado) params.append("estado", filters.estado);
    return params;
  }, [filters]);

  const fetchAllData = useCallback(async (pageNum: number) => {
    const id = ++fetchIdRef.current;
    setLoading(true);
    const params = buildParams();

    const statsPromise = fetch(`/api/sismos/stats?${params.toString()}`).then(r => r.json());
    const listParams = new URLSearchParams(params);
    listParams.append("limit", limit.toString());
    listParams.append("offset", ((pageNum - 1) * limit).toString());
    const listPromise = fetch(`/api/sismos?${listParams.toString()}`).then(r => r.json());

    const mapParams = new URLSearchParams(params);
    mapParams.append("limit", "500");
    const mapPromise = fetch(`/api/sismos?${mapParams.toString()}`).then(r => r.json());

    try {
      const [statsRes, listRes, mapRes] = await Promise.all([statsPromise, listPromise, mapPromise]);
      if (id !== fetchIdRef.current) return; // Stale request, discard

      if (!statsRes.error) setStats(statsRes);
      if (listRes.data) {
        setSismos(listRes.data);
        setTotal(listRes.total);
      }
      if (mapRes.data) setAllSismosForMap(mapRes.data);

    } catch (err) {
      console.error("Data fetch error:", err);
    } finally {
      if (id === fetchIdRef.current) setLoading(false);
    }
  }, [buildParams]);

  // On mount
  useEffect(() => {
    setMounted(true);
    fetchAllData(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On filter change — reset to page 1 and refetch everything
  useEffect(() => {
    if (!mounted) return;
    setPage(1);
    fetchAllData(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(total / limit)) return;
    setPage(newPage);
    const id = ++fetchIdRef.current;
    setLoading(true);
    const params = buildParams();
    params.append("limit", limit.toString());
    params.append("offset", ((newPage - 1) * limit).toString());
    try {
      const res = await fetch(`/api/sismos?${params.toString()}`);
      const result = await res.json();
      if (id !== fetchIdRef.current) return;
      if (result.data) setSismos(result.data);
    } catch (err) {
      console.error("Page fetch error:", err);
    } finally {
      if (id === fetchIdRef.current) setLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters({ minMag: "", maxDist: "", startDate: "", endDate: "", estado: "" });
  };

  const fetchFullData = async () => {
    const params = buildParams();
    params.append("limit", "2000");
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
    ws['!cols'] = [
      { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sismos");
    XLSX.writeFile(wb, "Reporte_Sismos_Collahuasi.xlsx");
  };

  const exportKMZ = async () => {
    const allData = await fetchFullData();
    if (allData.length === 0) return;

    const radiusKM = filters.maxDist ? parseFloat(filters.maxDist) : null;
    const centerLat = -20.940803;
    const centerLon = -68.603681;
    const rangeMeters = radiusKM ? radiusKM * 1000 * 2.5 : 50000;

    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Sismos Collahuasi</name>
    <LookAt>
      <longitude>${centerLon}</longitude>
      <latitude>${centerLat}</latitude>
      <altitude>0</altitude>
      <heading>0</heading>
      <tilt>0</tilt>
      <range>${rangeMeters}</range>
      <altitudeMode>relativeToGround</altitudeMode>
    </LookAt>
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
    </Style>
    <Style id="mina">
      <IconStyle>
        <scale>1.5</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/pal3/icon21.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="radar-style">
      <LineStyle><color>ccff0000</color><width>2</width></LineStyle>
      <PolyStyle><color>22ff0000</color></PolyStyle>
    </Style>`;

    if (radiusKM) {
      let circleCoords = "";
      for (let i = 0; i <= 360; i += 5) {
        const rad = i * Math.PI / 180;
        const dLat = (radiusKM / 111.32) * Math.sin(rad);
        const dLon = (radiusKM / (111.32 * Math.cos(centerLat * Math.PI / 180))) * Math.cos(rad);
        circleCoords += `${centerLon + dLon},${centerLat + dLat},0 `;
      }
      kml += `
    <Placemark>
      <name>Radio Filtro (${radiusKM} km)</name>
      <description>Área de escaneo actual desde Mina Collahuasi</description>
      <styleUrl>#radar-style</styleUrl>
      <Polygon>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs><LinearRing><coordinates>${circleCoords.trim()}</coordinates></LinearRing></outerBoundaryIs>
      </Polygon>
    </Placemark>`;
    }

    kml += `
    <Placemark>
      <name>Mina Collahuasi</name>
      <styleUrl>#mina</styleUrl>
      <Point><coordinates>${centerLon},${centerLat},0</coordinates></Point>
    </Placemark>`;

    allData.forEach((s: Sismo) => {
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
      <Point><coordinates>${lon},${lat},0</coordinates></Point>
    </Placemark>`;
    });

    kml += `\n  </Document>\n</kml>`;

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

  const totalPages = Math.ceil(total / limit);
  const statsTrend = useMemo(() => stats?.trend || [], [stats]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("es-CL", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch { return dateStr; }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-content">
        <section className="kpi-strip">
          <KPICard icon={<Clock size={20} />} label="Último Evento" value={stats?.kpi.ultimoEvento ? formatDate(stats.kpi.ultimoEvento) : "—"} color="blue" />
          <KPICard icon={<Zap size={20} />} label="Magnitud Máxima" value={stats?.kpi.maxMagnitud !== undefined ? Number(stats.kpi.maxMagnitud).toFixed(1) : "—"} unit={stats?.kpi.escalaMax || "ML"} color="red" />
          <KPICard icon={<Crosshair size={20} />} label="Distancia Mínima" value={stats?.kpi.minDistancia !== undefined ? Number(stats.kpi.minDistancia).toFixed(0) : "—"} unit="km" color="green" />
          <KPICard icon={<Mountain size={20} />} label="Profundidad Máxima" value={stats?.kpi.maxProfundidad !== undefined ? Number(stats.kpi.maxProfundidad).toFixed(0) : "—"} unit="km" color="orange" />
        </section>

        <section className="alert-strip">
          <AlertBox label="Normal" count={stats?.alertCounts.NORMAL ?? 0} type="normal" />
          <AlertBox label="Advertencia" count={stats?.alertCounts.ADVERTENCIA ?? 0} type="advertencia" />
          <AlertBox label="Alerta" count={stats?.alertCounts.ALERTA ?? 0} type="alerta" />
          <AlertBox label="Alarma" count={stats?.alertCounts.ALARMA ?? 0} type="alarma" />
          <AlertBox label="Total" count={stats?.kpi.total ?? 0} type="total" />
        </section>

        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-section-title"><Filter size={14} /> Filtros</div>
            <div className="filter-group">
              <label>Estado</label>
              <select value={filters.estado} onChange={(e) => setFilters({ ...filters, estado: e.target.value })}>
                <option value="">Todos</option>
                <option value="NORMAL">Normal</option>
                <option value="ADVERTENCIA">Advertencia</option>
                <option value="ALERTA">Alerta</option>
                <option value="ALARMA">Alarma</option>
              </select>
            </div>
            <div className="filter-group">
              <label><Calendar size={14} style={{ marginRight: 4 }} /> Fecha Inicio</label>
              <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
            </div>
            <div className="filter-group">
              <label><Calendar size={14} style={{ marginRight: 4 }} /> Fecha Fin</label>
              <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
            </div>
            <FilterSlider label="Magnitud Mínima" value={filters.minMag || "0"} min="0" max="9" step="0.5" onChange={(v: string) => setFilters({...filters, minMag: v === "0" ? "" : v})} />
            <FilterSlider label="Distancia Máx." value={filters.maxDist || "500"} min="0" max="500" step="10" onChange={(v: string) => setFilters({...filters, maxDist: v === "500" ? "" : v})} />
          </div>

          <div className="export-section" style={{ marginTop: "0.5rem" }}>
            <button className="btn-export" onClick={exportExcel} disabled={total === 0}><TableIcon size={14} /> EXCEL</button>
            <button className="btn-export" onClick={exportKMZ} disabled={total === 0}><Globe size={14} /> KMZ</button>
          </div>

          <button className="btn-filter secondary" onClick={resetFilters}><RotateCcw size={14} /> Limpiar Filtros</button>
        </aside>

        <div className="main-area">
          <section className="detail-panel">
            <div className="detail-header">
              <h2><Activity size={16} /> Detalle de Sismos</h2>
              <span className="detail-count">{total} eventos</span>
            </div>
            <div className="detail-list">
              {loading ? <LoadingBox /> : sismos.map((s, i) => <SismoSmallCard key={s.id} s={s} index={i} formatDate={formatDate} />)}
            </div>
            {totalPages > 1 && <Pagination page={page} total={totalPages} onChange={handlePageChange} />}
          </section>

          <section className="map-panel">
            <div className="map-header"><h2><Globe size={16} /> Georeferenciación</h2></div>
            <div className="map-container">
              <SismoMap sismos={allSismosForMap} />
            </div>
          </section>

          <section className="trend-panel">
            <div className="trend-header"><h2><BarChart3 size={16} /> Tendencia Temporal</h2></div>
            <div className="trend-chart">
              {statsTrend.length > 0 ? <TrendChart data={statsTrend} /> : <LoadingBox />}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// Subcomponents for cleaner render
function KPICard({ icon, label, value, unit, color }: any) {
  return (
    <div className="kpi-card">
      <div className={`kpi-icon ${color}`}>{icon}</div>
      <div className="kpi-info">
        <span className="kpi-label">{label}</span>
        <span className="kpi-value">{value} <span className="kpi-unit">{unit}</span></span>
      </div>
    </div>
  );
}

function AlertBox({ label, count, type }: any) {
  const getActiveClass = () => {
    if (count === 0) return "";
    if (type === "advertencia") return "active-warning";
    if (type === "alerta") return "active-alert";
    if (type === "alarma") return "active-alarm";
    return "";
  };

  return (
    <div className={`alert-counter ${type} ${getActiveClass()}`}>
      <span className="alert-label">{label}</span>
      <span className="alert-count">{count}</span>
    </div>
  );
}

function FilterSlider({ label, value, min, max, step, onChange }: any) {
  return (
    <div className="filter-group">
      <div className="filter-header-row">
        <label>{label}</label>
        <span className="filter-value-badge">{value}</span>
      </div>
      <div className="range-container">
        <input 
          type="range" 
          min={min} 
          max={max} 
          step={step} 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          className="custom-range"
        />
        <div className="range-limits">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
}

function SismoSmallCard({ s, index, formatDate }: { s: Sismo; index: number; formatDate: any }) {
  const getMagClass = (m: number) => m >= 6 ? "high" : m >= 5 ? "mid" : m >= 4 ? "warning" : "low";
  const getAlertClass = (n: string) => n.toLowerCase();

  return (
    <div className="sismo-card" style={{ animationDelay: `${index * 0.03}s` }}>
      <div className={`sismo-mag ${getMagClass(s.magnitud)}`}>{Number(s.magnitud).toFixed(1)}</div>
      <div className="sismo-body">
        <span className="sismo-location">{s.ubicacion}</span>
        <div className="sismo-meta">
          <span className="sismo-meta-item scale-badge">{s.escala}</span>
          <span className="sismo-meta-item">{formatDate(s.fecha_sismo)}</span>
          <span className="sismo-meta-item">| {s.profundidad}km profunda</span>
        </div>
      </div>
      <span className={`sismo-alert-badge ${getAlertClass(s.nivel_alerta)}`}>{s.nivel_alerta}</span>
    </div>
  );
}



function Pagination({ page, total, onChange }: any) {
  return (
    <div className="pagination">
      <div className="pagination-controls">
        <button className="btn-nav" onClick={() => onChange(1)} disabled={page === 1} title="Ir al inicio">
          <ChevronsLeft size={16} />
        </button>
        <button className="btn-nav" onClick={() => onChange(page - 1)} disabled={page === 1} title="Página anterior">
          <ChevronLeft size={16} />
        </button>
      </div>
      
      <span className="pagination-info">Pág. <strong>{page}</strong> de {total}</span>
      
      <div className="pagination-controls">
        <button className="btn-nav" onClick={() => onChange(page + 1)} disabled={page === total} title="Página siguiente">
          <ChevronRight size={16} />
        </button>
        <button className="btn-nav" onClick={() => onChange(total)} disabled={page === total} title="Ir al final">
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}
