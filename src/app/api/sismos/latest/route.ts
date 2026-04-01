import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");
  const minutes = searchParams.get("minutes");

  try {
    let query: string;
    let params: any[] = [];

    const selectFields = `
          id,
          TO_CHAR(fecha_sismo, 'YYYY-MM-DD"T"HH24:MI:SS') as fecha_sismo,
          magnitud,
          escala,
          profundidad,
          ubicacion,
          latitud,
          longitud,
          distancia_km,
          nivel_alerta,
          TO_CHAR(fecha_notificacion AT TIME ZONE 'UTC' AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD"T"HH24:MI:SS') as fecha_notificacion,
          sismo_hash`;

    if (minutes) {
      // Devuelve sismos registrados en los últimos N minutos
      query = `
        SELECT ${selectFields}
        FROM alertas_sismicas
        WHERE sismo_hash NOT LIKE 'MOCK-%'
          AND fecha_notificacion >= NOW() - INTERVAL '${parseInt(minutes, 10)} minutes'
        ORDER BY fecha_sismo DESC
      `;
    } else if (since) {
      // Devuelve sismos nuevos desde la fecha indicada
      query = `
        SELECT ${selectFields}
        FROM alertas_sismicas
        WHERE sismo_hash NOT LIKE 'MOCK-%'
          AND fecha_sismo > $1
        ORDER BY fecha_sismo DESC
      `;
      params = [new Date(since)];
    } else {
      // Devuelve solo el último sismo registrado
      query = `
        SELECT ${selectFields}
        FROM alertas_sismicas
        WHERE sismo_hash NOT LIKE 'MOCK-%'
        ORDER BY fecha_sismo DESC
        LIMIT 1
      `;
    }

    const result = await pool.query(query, params);

    if (minutes || since) {
      return NextResponse.json({
        count: result.rows.length,
        sismos: result.rows,
      });
    }

    return NextResponse.json({
      sismo: result.rows[0] || null,
    });
  } catch (err: any) {
    console.error("Latest sismo error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
