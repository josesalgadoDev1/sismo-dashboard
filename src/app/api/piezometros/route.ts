import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiAuth } from "@/lib/auth/api";
import { resolvePiezoCoords, SistemaCoordenada } from "@/lib/coords";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const grupoId = searchParams.get("grupo_id");
  const includeArchived = searchParams.get("include_archived") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  try {
    const conditions: string[] = [];
    const params: any[] = [];

    if (!includeArchived) {
      conditions.push("p.archivado = false");
    }
    if (grupoId) {
      params.push(grupoId);
      conditions.push(`p.grupo_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM piezometros p ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Paginated data
    const dataParams = [...params];
    dataParams.push(limit);
    dataParams.push(offset);

    const result = await pool.query(
      `SELECT
         p.id, p.grupo_id, p.tipo_id, p.identificador,
         p.latitud, p.longitud, p.cota_instalacion,
         p.sistema_coordenada, p.coord_este, p.coord_norte, p.zona_utm,
         p.umbral_advertencia, p.umbral_alerta, p.umbral_alarma,
         p.ascenso_cm_semana, p.ascenso_historico, p.archivado,
         p.created_at, p.updated_at,
         g.nombre AS grupo_nombre,
         t.nombre AS tipo_nombre
       FROM piezometros p
       LEFT JOIN grupos_instrumentacion g ON g.id = p.grupo_id
       LEFT JOIN tipos_piezometro t ON t.id = p.tipo_id
       ${where}
       ORDER BY g.nombre, p.identificador ASC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );
    return NextResponse.json({ total, count: result.rows.length, piezometros: result.rows });
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
    } = body;

    if (!grupo_id || !tipo_id || !identificador) {
      return NextResponse.json(
        { error: "grupo_id, tipo_id e identificador son requeridos" },
        { status: 400 }
      );
    }

    const sistema: SistemaCoordenada = sistema_coordenada || "GEOGRAFICA";
    const resolved = resolvePiezoCoords({
      sistema,
      este: coord_este ?? null,
      norte: coord_norte ?? null,
      zonaUtm: zona_utm,
    });

    const result = await pool.query(
      `INSERT INTO piezometros
         (grupo_id, tipo_id, identificador,
          sistema_coordenada, coord_este, coord_norte, zona_utm,
          latitud, longitud, cota_instalacion,
          umbral_advertencia, umbral_alerta, umbral_alarma,
          ascenso_cm_semana, ascenso_historico)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        grupo_id,
        tipo_id,
        identificador,
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
      ]
    );
    return NextResponse.json({ piezometro: result.rows[0] }, { status: 201 });
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
