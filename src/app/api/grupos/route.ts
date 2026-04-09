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
      `SELECT id, nombre, descripcion, publicado, created_at
       FROM grupos_instrumentacion
       ORDER BY nombre ASC`
    );
    return NextResponse.json({ grupos: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await apiAuth(["admin"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { nombre, descripcion, publicado } = body;
    if (!nombre) {
      return NextResponse.json({ error: "nombre es requerido" }, { status: 400 });
    }
    const result = await pool.query(
      `INSERT INTO grupos_instrumentacion (nombre, descripcion, publicado)
       VALUES ($1, $2, COALESCE($3, true))
       RETURNING id, nombre, descripcion, publicado, created_at`,
      [nombre, descripcion || null, publicado]
    );
    return NextResponse.json({ grupo: result.rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
