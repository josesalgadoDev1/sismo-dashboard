import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minMag = searchParams.get("minMag");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const maxDist = searchParams.get("maxDist");
  const estado = searchParams.get("estado");

  const SHOW_MOCK_DATA = false;

  let whereClause = " WHERE 1=1";
  const params: any[] = [];
  let paramIndex = 1;

  if (!SHOW_MOCK_DATA) {
    whereClause += " AND sismo_hash NOT LIKE 'MOCK-%'";
  }

  if (minMag) {
    whereClause += ` AND magnitud >= $${paramIndex++}`;
    params.push(parseFloat(minMag));
  }
  if (startDate) {
    whereClause += ` AND fecha_sismo >= $${paramIndex++}`;
    params.push(new Date(startDate));
  }
  if (endDate) {
    whereClause += ` AND fecha_sismo <= $${paramIndex++}`;
    params.push(new Date(endDate));
  }
  if (maxDist) {
    whereClause += ` AND distancia_km <= $${paramIndex++}`;
    params.push(parseInt(maxDist, 10));
  }
  if (estado) {
    whereClause += ` AND nivel_alerta = $${paramIndex++}`;
    params.push(estado);
  }

  try {
    // KPI stats (without subquery to avoid param index issues)
    const kpiQuery = `
      SELECT 
        COUNT(*) as total,
        MAX(magnitud) as max_magnitud,
        MIN(distancia_km) as min_distancia,
        MAX(profundidad) as max_profundidad,
        MAX(fecha_sismo) as ultimo_evento
      FROM alertas_sismicas ${whereClause}
    `;
    const kpiRes = await pool.query(kpiQuery, params);
    const kpi = kpiRes.rows[0];

    // Get escala for max magnitude separately
    const escalaQuery = `
      SELECT escala FROM alertas_sismicas ${whereClause}
      ORDER BY magnitud DESC LIMIT 1
    `;
    const escalaRes = await pool.query(escalaQuery, params);
    const escalaMax = escalaRes.rows[0]?.escala || 'ML';

    // Get full details of the last registered event (always absolute, ignores filters)
    const lastEventQuery = `
      SELECT id, fecha_sismo, magnitud, profundidad, ubicacion, distancia_km, nivel_alerta, escala, latitud, longitud
      FROM alertas_sismicas
      WHERE 1=1 ${!SHOW_MOCK_DATA ? "AND sismo_hash NOT LIKE 'MOCK-%'" : ""}
      ORDER BY fecha_sismo DESC LIMIT 1
    `;
    const lastEventRes = await pool.query(lastEventQuery);
    const lastEvent = lastEventRes.rows[0] || null;

    // Alert level counts
    const alertQuery = `
      SELECT
        nivel_alerta,
        COUNT(*) as count
      FROM alertas_sismicas ${whereClause}
      GROUP BY nivel_alerta
    `;
    const alertRes = await pool.query(alertQuery, params);
    const alertCounts: Record<string, number> = {
      NORMAL: 0,
      ADVERTENCIA: 0,
      ALERTA: 0,
      ALARMA: 0
    };
    alertRes.rows.forEach((row: any) => {
      alertCounts[row.nivel_alerta] = parseInt(row.count, 10);
    });

    // "Alerta — Extraordinario" según tabla TAPP del Muro Principal (WSP):
    //   Evento sísmico con magnitud ≥ 6,0 Mw en un radio ≤ 200 km a la faena.
    // Se calcula directo desde magnitud + distancia_km, NO depende del
    // nivel_alerta clasificado en ingest (que aún no usa `g`).
    const extraordinarioQuery = `
      SELECT COUNT(*)::int AS count
      FROM alertas_sismicas ${whereClause}
        AND magnitud >= 6.0
        AND distancia_km <= 200
    `;
    const extraordinarioRes = await pool.query(extraordinarioQuery, params);
    const extraordinarioCount = extraordinarioRes.rows[0]?.count ?? 0;

    // Temporal trend grouped by date with alert level breakdown
    const trendQuery = `
      SELECT
        TO_CHAR(fecha_sismo, 'DD-MM') as fecha,
        TO_CHAR(fecha_sismo, 'YYYY-MM-DD') as fecha_full,
        COUNT(*) as cantidad,
        MAX(magnitud) as max_magnitud,
        COUNT(*) FILTER (WHERE nivel_alerta = 'NORMAL') as normal,
        COUNT(*) FILTER (WHERE nivel_alerta = 'ADVERTENCIA') as advertencia,
        COUNT(*) FILTER (WHERE nivel_alerta = 'ALERTA') as alerta,
        COUNT(*) FILTER (WHERE nivel_alerta = 'ALARMA') as alarma
      FROM alertas_sismicas ${whereClause}
      GROUP BY TO_CHAR(fecha_sismo, 'DD-MM'), TO_CHAR(fecha_sismo, 'YYYY-MM-DD')
      ORDER BY fecha_full DESC
      LIMIT 10
    `;
    const trendRes = await pool.query(trendQuery, params);

    return NextResponse.json({
      kpi: {
        total: parseInt(kpi.total, 10),
        maxMagnitud: kpi.max_magnitud ? parseFloat(kpi.max_magnitud) : 0,
        minDistancia: kpi.min_distancia ? parseFloat(kpi.min_distancia) : 0,
        maxProfundidad: kpi.max_profundidad ? parseFloat(kpi.max_profundidad) : 0,
        ultimoEvento: kpi.ultimo_evento || null,
        escalaMax: escalaMax
      },
      lastEvent,
      alertCounts,
      extraordinarioCount,
      trend: trendRes.rows.reverse() // Oldest first for chart
    });
  } catch (err: any) {
    console.error("Stats DB error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
