"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface PiezometroMapItem {
  id: number;
  identificador: string;
  latitud: string | null;
  longitud: string | null;
  cota_instalacion: string | null;
  grupo_nombre: string;
  tipo_nombre: string;
  primera_fecha: string | null;
  ultima_fecha: string | null;
  total_registros: number | null;
  ultimo_nivel: string | null;
  ultimo_offset: string | null;
  ultima_presion: string | null;
  primera_presion: string | null;
  diferencia_m: string | null;
  nivel_alerta: "ALARMA" | "ALERTA" | "ADVERTENCIA" | "NORMAL" | "SIN_DATO";
  umbral_advertencia: string | null;
  umbral_alerta: string | null;
  umbral_alarma: string | null;
}

interface Props {
  piezometros: PiezometroMapItem[];
  center: [number, number];
  visible: boolean;
  showLabels?: boolean;
  onPiezoSelect?: (p: PiezometroMapItem) => void;
}

function alertColor(n: string) {
  switch (n) {
    case "ALARMA": return "#ef4444";
    case "ALERTA": return "#f97316";
    case "ADVERTENCIA": return "#eab308";
    case "NORMAL": return "#22c55e";
    default: return "#94a3b8";
  }
}

export default function PiezometroMap({ piezometros, center, visible, showLabels = true, onPiezoSelect }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom: 14,
      // Permitimos llegar a 22 pero los tiles reales se sirven hasta 19
      // (ver `maxNativeZoom` en las capas). Leaflet escala los del 19
      // cuando pasamos ese nivel, así no aparece "Map data not available".
      maxZoom: 22,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    });

    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri",
        maxNativeZoom: 17,
        maxZoom: 22,
        crossOrigin: "anonymous",
      }
    ).addTo(map);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      {
        maxNativeZoom: 17,
        maxZoom: 22,
        opacity: 0.6,
        crossOrigin: "anonymous",
      }
    ).addTo(map);

    const centerIcon = L.divIcon({
      html: `<div style="width:14px;height:14px;background:rgba(59,130,246,0.9);border:2px solid white;border-radius:50%;box-shadow:0 0 10px rgba(59,130,246,0.6);"></div>`,
      className: "",
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    L.marker(center, { icon: centerIcon })
      .addTo(map)
      .bindPopup(`<div class="map-popup"><h4>Tranque Sentina</h4><p>Centro de referencia</p></div>`);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (!visible) return;

    const valid = piezometros.filter((p) => p.latitud && p.longitud);
    valid.forEach((p) => {
      const lat = parseFloat(p.latitud as string);
      const lon = parseFloat(p.longitud as string);
      const color = alertColor(p.nivel_alerta);

      const marker = L.circleMarker([lat, lon], {
        radius: 5,
        fillColor: color,
        color: color,
        weight: 2,
        opacity: 1,
        fillOpacity: 1,
      });

      // Click derecho → abrir panel detalle
      marker.on("contextmenu", (e) => {
        L.DomEvent.preventDefault(e as any);
        onPiezoSelect?.(p);
      });

      // Click izquierdo → también abre el panel (más intuitivo en mobile)
      marker.on("click", () => {
        onPiezoSelect?.(p);
      });

      marker.addTo(layer);

      if (showLabels) {
        const label = L.marker([lat, lon], {
          icon: L.divIcon({
            html: `<div style="
              color:white;
              font-size:10px;
              font-weight:700;
              text-shadow:0 0 3px #000,0 0 3px #000,0 0 3px #000;
              white-space:nowrap;
              transform:translate(8px,-18px);
              pointer-events:none;
            ">${p.identificador}</div>`,
            className: "",
            iconSize: [0, 0],
          }),
          interactive: false,
        });
        label.addTo(layer);
      }
    });

    if (valid.length > 0 && layer.getLayers().length > 0) {
      const bounds = L.latLngBounds(valid.map((p) => [parseFloat(p.latitud!), parseFloat(p.longitud!)] as [number, number]));
      bounds.extend(center);
      map.fitBounds(bounds, { padding: [40, 40], animate: true, maxZoom: 16 });
    }
  }, [piezometros, visible, showLabels, onPiezoSelect]);

  // Wrapper extra: React solo gestiona el div externo. Leaflet manipula el interno.
  // Evita "Failed to execute 'removeChild' on 'Node'" al desmontar (React vs Leaflet
  // compitiendo por limpiar los hijos del contenedor).
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
