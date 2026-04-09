import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiAuth } from "@/lib/auth/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await pool.query(`
      SELECT
        p.id, p.grupo_id, p.tipo_id, p.identificador,
        p.latitud, p.longitud, p.cota_instalacion,
        p.umbral_advertencia, p.umbral_alerta, p.umbral_alarma,
        g.nombre AS grupo_nombre,
        t.nombre AS tipo_nombre,
        stats.primera_fecha,
        stats.ultima_fecha,
        stats.total_registros,
        m.nivel_piez AS ultimo_nivel,
        m.offset_m AS ultimo_offset,
        m.presion_bar AS ultima_presion,
        CASE
          WHEN m.nivel_piez IS NULL AND p.cota_instalacion IS NOT NULL
               AND p.umbral_advertencia IS NOT NULL
            THEN 0
          WHEN m.nivel_piez IS NOT NULL AND p.cota_instalacion IS NOT NULL
            THEN ROUND((p.cota_instalacion - m.nivel_piez)::numeric, 2)
          ELSE NULL
        END AS diferencia_m,
        CASE
          WHEN m.nivel_piez IS NULL THEN 'NORMAL'
          WHEN p.umbral_alarma IS NOT NULL AND m.nivel_piez >= p.umbral_alarma THEN 'ALARMA'
          WHEN p.umbral_alerta IS NOT NULL AND m.nivel_piez >= p.umbral_alerta THEN 'ALERTA'
          WHEN p.umbral_advertencia IS NOT NULL AND m.nivel_piez >= p.umbral_advertencia THEN 'ADVERTENCIA'
          ELSE 'NORMAL'
        END AS nivel_alerta
      FROM piezometros p
      LEFT JOIN grupos_instrumentacion g ON g.id = p.grupo_id
      LEFT JOIN tipos_piezometro t ON t.id = p.tipo_id
      LEFT JOIN LATERAL (
        SELECT fecha_lectura, nivel_piez, offset_m, presion_bar
        FROM mediciones_piezometros
        WHERE piezometro_id = p.id
        ORDER BY fecha_lectura DESC
        LIMIT 1
      ) m ON true
      LEFT JOIN LATERAL (
        SELECT
          MIN(fecha_lectura) AS primera_fecha,
          MAX(fecha_lectura) AS ultima_fecha,
          COUNT(*)::int AS total_registros
        FROM mediciones_piezometros
        WHERE piezometro_id = p.id
      ) stats ON true
      WHERE p.archivado = false
      ORDER BY g.nombre, p.identificador ASC
    `);
    return NextResponse.json({ count: result.rows.length, piezometros: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
