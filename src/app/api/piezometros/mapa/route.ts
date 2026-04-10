import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiAuth } from "@/lib/auth/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    // Fórmula del nivel piezométrico (Excel "Cntrl diario Piezometros"):
    //   nivel_piez (m.s.n.m.) = (presion_bar * 10.2) + cota_instalacion
    // donde 10.2 es el factor estándar bar → m.c.a. La "diferencia" que se
    // muestra en el panel es la altura de la columna de agua sobre el
    // sensor (= presion_bar * 10.2 = nivel_piez - cota_instalacion).
    //
    // Si en algún momento un sensor empieza a reportar nivel_piez explícito
    // (mediciones_piezometros.nivel_piez NO NULL), ese valor manda; si no,
    // se deriva al vuelo desde presion_bar.
    const result = await pool.query(`
      WITH base AS (
        SELECT
          p.id, p.grupo_id, p.tipo_id, p.identificador,
          p.latitud, p.longitud, p.cota_instalacion,
          p.umbral_advertencia, p.umbral_alerta, p.umbral_alarma,
          g.nombre AS grupo_nombre,
          t.nombre AS tipo_nombre,
          stats.primera_fecha,
          stats.ultima_fecha,
          stats.total_registros,
          m.offset_m AS ultimo_offset,
          m.presion_bar AS ultima_presion,
          m_first.presion_bar AS primera_presion,
          COALESCE(
            m.nivel_piez,
            CASE
              WHEN m.presion_bar IS NOT NULL AND p.cota_instalacion IS NOT NULL
                THEN ROUND((m.presion_bar * 10.2 + p.cota_instalacion)::numeric, 3)
              ELSE NULL
            END
          ) AS ultimo_nivel,
          CASE
            WHEN m.presion_bar IS NOT NULL
              THEN ROUND((m.presion_bar * 10.2)::numeric, 3)
            ELSE NULL
          END AS diferencia_m
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
          SELECT presion_bar
          FROM mediciones_piezometros
          WHERE piezometro_id = p.id
          ORDER BY fecha_lectura ASC
          LIMIT 1
        ) m_first ON true
        LEFT JOIN LATERAL (
          SELECT
            MIN(fecha_lectura) AS primera_fecha,
            MAX(fecha_lectura) AS ultima_fecha,
            COUNT(*)::int AS total_registros
          FROM mediciones_piezometros
          WHERE piezometro_id = p.id
        ) stats ON true
        WHERE p.archivado = false
      )
      SELECT
        *,
        CASE
          WHEN ultimo_nivel IS NULL THEN 'SIN_DATO'
          WHEN umbral_alarma IS NOT NULL AND ultimo_nivel >= umbral_alarma THEN 'ALARMA'
          WHEN umbral_alerta IS NOT NULL AND ultimo_nivel >= umbral_alerta THEN 'ALERTA'
          WHEN umbral_advertencia IS NOT NULL AND ultimo_nivel >= umbral_advertencia THEN 'ADVERTENCIA'
          ELSE 'NORMAL'
        END AS nivel_alerta
      FROM base
      ORDER BY grupo_nombre, identificador ASC
    `);
    return NextResponse.json({ count: result.rows.length, piezometros: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
