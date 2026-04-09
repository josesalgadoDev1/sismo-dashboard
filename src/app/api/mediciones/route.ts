import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiAuth } from "@/lib/auth/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const piezometroId = searchParams.get("piezometro_id");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 2000);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  try {
    const conditions: string[] = [];
    const params: any[] = [];

    if (piezometroId) {
      params.push(piezometroId);
      conditions.push(`piezometro_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM mediciones_piezometros ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Paginated data
    const dataParams = [...params];
    dataParams.push(limit);
    dataParams.push(offset);

    const result = await pool.query(
      `SELECT id, piezometro_id,
         TO_CHAR(fecha_lectura, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_lectura,
         cota_instalacion, nivel_piez, offset_m, presion_bar, created_at
       FROM mediciones_piezometros
       ${where}
       ORDER BY fecha_lectura DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );
    return NextResponse.json({ total, count: result.rows.length, mediciones: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await apiAuth(["admin"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      piezometro_id,
      fecha_lectura,
      cota_instalacion,
      nivel_piez,
      offset_m,
      presion_bar,
    } = body;

    if (!piezometro_id || !fecha_lectura) {
      return NextResponse.json(
        { error: "piezometro_id y fecha_lectura son requeridos" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO mediciones_piezometros
         (piezometro_id, fecha_lectura, cota_instalacion, nivel_piez, offset_m, presion_bar)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        piezometro_id,
        fecha_lectura,
        cota_instalacion ?? null,
        nivel_piez ?? null,
        offset_m ?? null,
        presion_bar ?? null,
      ]
    );
    return NextResponse.json({ medicion: result.rows[0] }, { status: 201 });
  } catch (err: any) {
    if (err.code === "23505") {
      return NextResponse.json(
        { error: "Ya existe una medición para ese piezómetro y fecha" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
