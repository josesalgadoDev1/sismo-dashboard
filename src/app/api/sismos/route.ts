import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minMag = searchParams.get("minMag");
  const maxMag = searchParams.get("maxMag");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const maxDist = searchParams.get("maxDist");
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  let whereClause = " WHERE 1=1";
  const params: any[] = [];
  let paramIndex = 1;

  if (minMag) {
    whereClause += ` AND magnitud >= $${paramIndex++}`;
    params.push(parseFloat(minMag));
  }
  if (maxMag) {
    whereClause += ` AND magnitud <= $${paramIndex++}`;
    params.push(parseFloat(maxMag));
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

  try {
    // Get total count for pagination
    const countRes = await pool.query(`SELECT COUNT(*) FROM alertas_sismicas ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    // Get paginated data
    const query = `
      SELECT 
        id, 
        TO_CHAR(fecha_sismo, 'YYYY-MM-DD"T"HH24:MI:SS') as fecha_sismo,
        magnitud, 
        profundidad, 
        ubicacion, 
        distancia_km, 
        nivel_alerta, 
        TO_CHAR(fecha_notificacion, 'YYYY-MM-DD"T"HH24:MI:SS') as fecha_notificacion,
        sismo_hash 
      FROM alertas_sismicas 
      ${whereClause} 
      ORDER BY alertas_sismicas.fecha_sismo DESC 
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    const dataRes = await pool.query(query, [...params, limit, offset]);

    return NextResponse.json({
      data: dataRes.rows,
      total,
      limit,
      offset
    });
  } catch (err: any) {
    console.error("Database error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
