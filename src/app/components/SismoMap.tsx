"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Sismo {
  id: number;
  ubicacion: string;
  magnitud: number;
  profundidad: number;
  distancia_km: number;
  nivel_alerta: string;
  fecha_sismo: string;
  latitud: string;
  longitud: string;
  escala: string;
}

interface SismoMapProps {
  sismos: Sismo[];
  radiusKm?: number | null;
}

const COLLAHUASI_CENTER: [number, number] = [-20.940803, -68.603681];

function getAlertColor(nivel: string): string {
  switch (nivel) {
    case "ALARMA": return "#ef4444";
    case "ALERTA": return "#f97316";
    case "ADVERTENCIA": return "#eab308";
    default: return "#10b981";
  }
}

function getMagRadius(mag: number): number {
  const val = Number(mag);
  if (val >= 7) return 14;
  if (val >= 6) return 12;
  if (val >= 5) return 10;
  if (val >= 4) return 8;
  return 6;
}

export default function SismoMap({ sismos, radiusKm }: SismoMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const radiusLayerRef = useRef<L.Circle | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: COLLAHUASI_CENTER,
      zoom: 8,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
    });

    // Use Esri satellite tiles
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri",
        maxZoom: 18,
        crossOrigin: "anonymous",
      }
    ).addTo(map);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 18,
        opacity: 0.7,
        crossOrigin: "anonymous",
      }
    ).addTo(map);

    // Mine marker
    const mineIcon = L.divIcon({
      html: `<div style="
        width: 28px; height: 28px;
        background: rgba(59,130,246,0.9);
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 20px rgba(59,130,246,0.5);
      "></div>`,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    L.marker(COLLAHUASI_CENTER, { icon: mineIcon })
      .addTo(map)
      .bindPopup(`
        <div class="map-popup">
          <h4>Mina Collahuasi</h4>
          <p><strong>Centro de referencia</strong></p>
        </div>
      `);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Radius Circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove previous radius
    if (radiusLayerRef.current) {
      map.removeLayer(radiusLayerRef.current);
      radiusLayerRef.current = null;
    }

    if (radiusKm && radiusKm > 0 && radiusKm <= 600) {
      const circle = L.circle(COLLAHUASI_CENTER, {
        radius: radiusKm * 1000,
        color: "#ef4444",
        weight: 3,
        opacity: 0.9,
        fillColor: "#ef4444",
        fillOpacity: 0.15,
        dashArray: "10, 8",
      });
      circle.bindPopup(`<div class="map-popup"><h4>Radio de Filtro</h4><p><strong>${radiusKm} km</strong> desde Mina Collahuasi</p></div>`);
      circle.addTo(map);
      radiusLayerRef.current = circle;
    }
  }, [radiusKm]);

  // Update Markers
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (sismos.length === 0) return;

    sismos.forEach((s) => {
      const lat = s.latitud ? parseFloat(s.latitud) : null;
      const lon = s.longitud ? parseFloat(s.longitud) : null;
      if (!lat || !lon) return;

      const color = getAlertColor(s.nivel_alerta);
      const radius = getMagRadius(s.magnitud);

      const marker = L.circleMarker([lat, lon], {
        radius: radius,
        fillColor: color,
        color: color,
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.5,
      });

      const escalaLabel = s.escala?.toUpperCase() === "MW" ? "Mw" : "ML";
      marker.bindPopup(`
        <div class="map-popup">
          <h4>M ${Number(s.magnitud).toFixed(1)} — ${s.nivel_alerta}</h4>
          <p><strong>Ubicación:</strong> ${s.ubicacion}</p>
          <p><strong>Fecha:</strong> ${new Date(s.fecha_sismo).toLocaleString("es-CL", { timeZone: "America/Santiago" })}</p>
          <p><strong>Profundidad:</strong> ${s.profundidad} km</p>
        </div>
      `);
      
      marker.addTo(layer);
    });

    // Bring radius circle to front if it exists
    if (radiusLayerRef.current) {
      radiusLayerRef.current.bringToFront();
    }

    // Handle bounds
    const validSismos = sismos.filter(s => s.latitud && s.longitud);
    if (validSismos.length > 0) {
      const bounds = L.latLngBounds(
        validSismos.map(s => [parseFloat(s.latitud), parseFloat(s.longitud)] as [number, number])
      );
      bounds.extend(COLLAHUASI_CENTER);
      map.fitBounds(bounds, { padding: [30, 30], animate: true });
    }
  }, [sismos]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", minHeight: "400px" }}
    />
  );
}
