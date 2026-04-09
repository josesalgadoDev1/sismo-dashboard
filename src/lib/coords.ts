/**
 * Conversiones entre sistemas de coordenadas para piezómetros.
 *
 * Sistemas soportados:
 *  - GEOGRAFICA: WGS84 lat/lon (lo que consume Leaflet directamente).
 *  - UTM:        WGS84 UTM. Para Collahuasi la zona es 19S; dejamos 18S y
 *                20S habilitadas por si algún día se agregan sitios vecinos.
 *  - LOCAL:      Sistema Local Collahuasi (SLC). Transformación afín tomada
 *                del conversor oficial de Collahuasi (levantamiento láser
 *                aerotransportado, GeoExploraciones 2009). Se encadena
 *                SLC → WGS84 UTM 19S → lat/lon.
 *
 * Implementamos UTM ↔ lat/lon a mano (fórmulas USGS) en vez de usar proj4,
 * porque proj4 resuelve sus "adapters" dinámicamente y el bundler de
 * Next 16 / Turbopack rompe esa inicialización ("adapterFn is not a
 * function"). Las fórmulas USGS son deterministas y tienen precisión
 * submilimétrica dentro de una zona UTM.
 */

export type SistemaCoordenada = "LOCAL" | "UTM" | "GEOGRAFICA";

export const DEFAULT_UTM_ZONE = "19S";

// Zonas UTM del hemisferio sur que nos interesan (norte de Chile).
const VALID_UTM_ZONES = new Set(["18S", "19S", "20S"]);

export function isValidUtmZone(zona: string): boolean {
  return VALID_UTM_ZONES.has(zona);
}

// Constantes del elipsoide WGS84.
const WGS84_A = 6378137;                    // semi-eje mayor (m)
const WGS84_F = 1 / 298.257223563;          // aplanamiento
const UTM_K0 = 0.9996;                      // factor de escala UTM
const E2 = WGS84_F * (2 - WGS84_F);         // excentricidad^2
const E4 = E2 * E2;
const E6 = E4 * E2;
const EP2 = E2 / (1 - E2);                  // segunda excentricidad^2
const DEG = Math.PI / 180;

function zoneNumber(zona: string): number {
  return parseInt(zona.slice(0, -1), 10);
}

function zoneIsSouth(zona: string): boolean {
  return zona.slice(-1).toUpperCase() === "S";
}

function centralMeridianRad(zoneNum: number): number {
  // Meridiano central de la zona UTM en radianes.
  return ((zoneNum - 1) * 6 - 180 + 3) * DEG;
}

/**
 * UTM → WGS84 lat/lon. Implementación directa de las fórmulas USGS
 * (Snyder, "Map Projections — A Working Manual", 1987, §8).
 * Precisión ~mm dentro de la zona.
 */
export function utmToLatLon(
  este: number,
  norte: number,
  zona: string = DEFAULT_UTM_ZONE
): { lat: number; lon: number } {
  if (!isValidUtmZone(zona)) {
    throw new Error(`Zona UTM no soportada: ${zona}`);
  }
  const zoneNum = zoneNumber(zona);
  const south = zoneIsSouth(zona);

  const x = este - 500000;
  const y = south ? norte - 10000000 : norte;

  const lon0 = centralMeridianRad(zoneNum);

  const M = y / UTM_K0;
  const mu = M / (WGS84_A * (1 - E2 / 4 - 3 * E4 / 64 - 5 * E6 / 256));

  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const e1_2 = e1 * e1;
  const e1_3 = e1_2 * e1;
  const e1_4 = e1_2 * e1_2;

  const phi1 =
    mu +
    (3 * e1 / 2 - 27 * e1_3 / 32) * Math.sin(2 * mu) +
    (21 * e1_2 / 16 - 55 * e1_4 / 32) * Math.sin(4 * mu) +
    (151 * e1_3 / 96) * Math.sin(6 * mu) +
    (1097 * e1_4 / 512) * Math.sin(8 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);

  const N1 = WGS84_A / Math.sqrt(1 - E2 * sinPhi1 * sinPhi1);
  const T1 = tanPhi1 * tanPhi1;
  const T1_2 = T1 * T1;
  const C1 = EP2 * cosPhi1 * cosPhi1;
  const C1_2 = C1 * C1;
  const R1 = (WGS84_A * (1 - E2)) / Math.pow(1 - E2 * sinPhi1 * sinPhi1, 1.5);
  const D = x / (N1 * UTM_K0);
  const D2 = D * D;
  const D3 = D2 * D;
  const D4 = D2 * D2;
  const D5 = D4 * D;
  const D6 = D4 * D2;

  const latRad =
    phi1 -
    ((N1 * tanPhi1) / R1) *
      (D2 / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1_2 - 9 * EP2) * D4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1_2 - 252 * EP2 - 3 * C1_2) * D6) / 720);

  const lonRad =
    lon0 +
    (D -
      ((1 + 2 * T1 + C1) * D3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1_2 + 8 * EP2 + 24 * T1_2) * D5) / 120) /
      cosPhi1;

  return { lat: latRad / DEG, lon: lonRad / DEG };
}

/**
 * Sistema Local Collahuasi (SLC) → WGS84 UTM 19S.
 *
 * Fórmulas del conversor oficial Collahuasi (GeoExploraciones 2009):
 *   E'_utm = 340.46887 + 0.99897972312 * E_slc_full + 0.00000179495 * N_slc_full
 *   N'_utm = 7467.0421 - 0.00000179495 * E_slc_full + 0.99897972312 * N_slc_full
 *
 * donde E_slc_full = E_slc + 500000 y N_slc_full = N_slc + 7600000, porque
 * el SLC se maneja en valores reducidos (sin los offsets base).
 */
export function slcToUtm(
  esteSlc: number,
  norteSlc: number
): { este: number; norte: number } {
  const eFull = esteSlc + 500000;
  const nFull = norteSlc + 7600000;
  const este = 340.46887 + 0.99897972312 * eFull + 0.00000179495 * nFull;
  const norte = 7467.0421 - 0.00000179495 * eFull + 0.99897972312 * nFull;
  return { este, norte };
}

/**
 * WGS84 UTM 19S → Sistema Local Collahuasi (SLC). Fórmulas inversas del
 * conversor oficial.
 */
export function utmToSlc(
  esteUtm: number,
  norteUtm: number
): { este: number; norte: number } {
  const eFull = -340.80322 + 1.001021319 * esteUtm - 0.00000179862 * norteUtm;
  const nFull = -7474.66965 + 0.00000179862 * esteUtm + 1.001021319 * norteUtm;
  return { este: eFull - 500000, norte: nFull - 7600000 };
}

/** Sistema Local Collahuasi → WGS84 lat/lon (SLC → UTM 19S → lat/lon). */
export function slcToLatLon(
  esteSlc: number,
  norteSlc: number
): { lat: number; lon: number } {
  const { este, norte } = slcToUtm(esteSlc, norteSlc);
  return utmToLatLon(este, norte, "19S");
}

/**
 * Resuelve las coordenadas canónicas (lat/lon para el mapa) a partir del
 * sistema elegido por el usuario. Devuelve también los valores raw que
 * deben persistirse en `coord_este` / `coord_norte` / `zona_utm`.
 */
export function resolvePiezoCoords(input: {
  sistema: SistemaCoordenada;
  este: number | null;
  norte: number | null;
  zonaUtm?: string | null;
}): {
  sistema: SistemaCoordenada;
  coord_este: number | null;
  coord_norte: number | null;
  zona_utm: string | null;
  latitud: number | null;
  longitud: number | null;
} {
  const { sistema, este, norte } = input;
  const zonaUtm = input.zonaUtm ?? null;

  if (
    este === null ||
    norte === null ||
    Number.isNaN(este) ||
    Number.isNaN(norte)
  ) {
    return {
      sistema,
      coord_este: null,
      coord_norte: null,
      zona_utm: sistema === "UTM" ? zonaUtm : null,
      latitud: null,
      longitud: null,
    };
  }

  if (sistema === "GEOGRAFICA") {
    // Convención del form: "este" = longitud, "norte" = latitud.
    return {
      sistema,
      coord_este: este,
      coord_norte: norte,
      zona_utm: null,
      latitud: norte,
      longitud: este,
    };
  }

  if (sistema === "UTM") {
    const zona = zonaUtm && isValidUtmZone(zonaUtm) ? zonaUtm : DEFAULT_UTM_ZONE;
    const { lat, lon } = utmToLatLon(este, norte, zona);
    return {
      sistema,
      coord_este: este,
      coord_norte: norte,
      zona_utm: zona,
      latitud: lat,
      longitud: lon,
    };
  }

  // LOCAL: guardamos raw + convertimos a lat/lon encadenando SLC → UTM19S → latlon.
  const { lat, lon } = slcToLatLon(este, norte);
  return {
    sistema,
    coord_este: este,
    coord_norte: norte,
    zona_utm: null,
    latitud: lat,
    longitud: lon,
  };
}
