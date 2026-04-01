import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { validateToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const authError = validateToken(request);
  if (authError) return authError;

  try {
    const query = `
      SELECT
        id,
        TO_CHAR(fecha_sismo, 'YYYY-MM-DD"T"HH24:MI:SS') as fecha_sismo,
        magnitud, escala, profundidad, ubicacion,
        latitud, longitud, distancia_km, nivel_alerta,
        TO_CHAR(fecha_notificacion AT TIME ZONE 'UTC' AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD"T"HH24:MI:SS') as fecha_notificacion,
        sismo_hash
      FROM alertas_sismicas
      WHERE sismo_hash NOT LIKE 'MOCK-%'
        AND fecha_sismo >= NOW() - INTERVAL '24 hours'
      ORDER BY magnitud DESC
      LIMIT 1
    `;

    const result = await pool.query(query);

    return NextResponse.json({
      sismo: result.rows[0] || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
