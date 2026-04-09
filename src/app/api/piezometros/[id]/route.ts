import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiAuth } from "@/lib/auth/api";
import { resolvePiezoCoords, SistemaCoordenada } from "@/lib/coords";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  try {
    const result = await pool.query(
      `SELECT
         p.*, g.nombre AS grupo_nombre, t.nombre AS tipo_nombre
       FROM piezometros p
       LEFT JOIN grupos_instrumentacion g ON g.id = p.grupo_id
       LEFT JOIN tipos_piezometro t ON t.id = p.tipo_id
       WHERE p.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json({ piezometro: result.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await apiAuth(["admin"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  try {
    const body = await request.json();
    const {
      grupo_id,
      tipo_id,
      identificador,
      sistema_coordenada,
      coord_este,
      coord_norte,
      zona_utm,
      cota_instalacion,
      umbral_advertencia,
      umbral_alerta,
      umbral_alarma,
      ascenso_cm_semana,
      ascenso_historico,
      archivado,
    } = body;

    const sistema: SistemaCoordenada = sistema_coordenada || "GEOGRAFICA";
    const resolved = resolvePiezoCoords({
      sistema,
      este: coord_este ?? null,
      norte: coord_norte ?? null,
      zonaUtm: zona_utm,
    });

    const result = await pool.query(
      `UPDATE piezometros SET
         grupo_id = COALESCE($1, grupo_id),
         tipo_id = COALESCE($2, tipo_id),
         identificador = COALESCE($3, identificador),
         sistema_coordenada = $4,
         coord_este = $5,
         coord_norte = $6,
         zona_utm = $7,
         latitud = $8,
         longitud = $9,
         cota_instalacion = $10,
         umbral_advertencia = $11,
         umbral_alerta = $12,
         umbral_alarma = $13,
         ascenso_cm_semana = $14,
         ascenso_historico = $15,
         archivado = COALESCE($16, archivado),
         updated_at = NOW()
       WHERE id = $17
       RETURNING *`,
      [
        grupo_id ?? null,
        tipo_id ?? null,
        identificador ?? null,
        resolved.sistema,
        resolved.coord_este,
        resolved.coord_norte,
        resolved.zona_utm,
        resolved.latitud,
        resolved.longitud,
        cota_instalacion ?? null,
        umbral_advertencia ?? null,
        umbral_alerta ?? null,
        umbral_alarma ?? null,
        ascenso_cm_semana ?? null,
        ascenso_historico ?? null,
        archivado ?? null,
        id,
      ]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json({ piezometro: result.rows[0] });
  } catch (err: any) {
    if (err.code === "23505") {
      return NextResponse.json(
        { error: "Ya existe un piezómetro con ese identificador en el grupo" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await apiAuth(["admin"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  try {
    const result = await pool.query(
      `UPDATE piezometros SET archivado = true, updated_at = NOW()
       WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
