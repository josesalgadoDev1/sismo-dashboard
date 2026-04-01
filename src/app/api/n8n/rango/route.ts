import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { validateToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const authError = validateToken(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  if (!desde || !hasta) {
    return NextResponse.json(
      { error: "Parámetros 'desde' y 'hasta' requeridos (formato YYYY-MM-DD)" },
      { status: 400 }
    );
  }

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
        AND fecha_sismo >= $1
        AND fecha_sismo < ($2::date + INTERVAL '1 day')
      ORDER BY fecha_sismo DESC
    `;

    const result = await pool.query(query, [desde, hasta]);

    return NextResponse.json({
      count: result.rows.length,
      sismos: result.rows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
