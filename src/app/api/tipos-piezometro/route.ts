import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiAuth } from "@/lib/auth/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await pool.query(
      `SELECT id, nombre, created_at FROM tipos_piezometro ORDER BY nombre ASC`
    );
    return NextResponse.json({ tipos: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
