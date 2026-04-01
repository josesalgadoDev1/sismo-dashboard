import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET() {
  try {
    const query = `
      SELECT
        COUNT(*) as total,
        MAX(magnitud) as max_magnitud,
        MIN(magnitud) as min_magnitud,
        ROUND(AVG(magnitud)::numeric, 1) as avg_magnitud,
        MIN(distancia_km) as min_distancia_km,
        COUNT(*) FILTER (WHERE nivel_alerta = 'NORMAL') as normal,
        COUNT(*) FILTER (WHERE nivel_alerta = 'ADVERTENCIA') as advertencia,
        COUNT(*) FILTER (WHERE nivel_alerta = 'ALERTA') as alerta,
        COUNT(*) FILTER (WHERE nivel_alerta = 'ALARMA') as alarma
      FROM alertas_sismicas
      WHERE sismo_hash NOT LIKE 'MOCK-%'
        AND fecha_sismo >= (NOW() AT TIME ZONE 'America/Santiago')::date
    `;

    const result = await pool.query(query);
    const row = result.rows[0];

    return NextResponse.json({
      fecha: new Date().toLocaleDateString("es-CL", { timeZone: "America/Santiago" }),
      total: parseInt(row.total, 10),
      max_magnitud: row.max_magnitud ? parseFloat(row.max_magnitud) : null,
      min_magnitud: row.min_magnitud ? parseFloat(row.min_magnitud) : null,
      avg_magnitud: row.avg_magnitud ? parseFloat(row.avg_magnitud) : null,
      min_distancia_km: row.min_distancia_km ? parseFloat(row.min_distancia_km) : null,
      alertas: {
        normal: parseInt(row.normal, 10),
        advertencia: parseInt(row.advertencia, 10),
        alerta: parseInt(row.alerta, 10),
        alarma: parseInt(row.alarma, 10),
      },
    });
  } catch (err: any) {
    console.error("Resumen error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
