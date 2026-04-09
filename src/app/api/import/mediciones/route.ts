import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiAuth } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

interface RecordInput {
  identificador: string;
  fecha_lectura: string; // ISO string
  presion_bar: number | null;
}

export async function POST(req: NextRequest) {
  const auth = await apiAuth(["admin"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const records: RecordInput[] = body.records || [];

    if (records.length === 0) {
      return NextResponse.json({ inserted: 0, skipped: 0, not_found: [] });
    }

    // Get unique identificadores
    const ids = [...new Set(records.map((r) => r.identificador))];

    // Look up piezometro IDs
    const lookup = await pool.query(
      `SELECT id, identificador FROM piezometros WHERE identificador = ANY($1) AND archivado = false`,
      [ids]
    );

    const idMap: Record<string, number> = {};
    lookup.rows.forEach((row) => {
      idMap[row.identificador] = row.id;
    });

    const notFound = ids.filter((id) => !idMap[id]);

    // Filter valid records
    const valid = records.filter((r) => idMap[r.identificador] && r.fecha_lectura);

    if (valid.length === 0) {
      return NextResponse.json({ inserted: 0, skipped: 0, not_found: notFound });
    }

    // Bulk insert in batches to avoid PostgreSQL parameter limit (~65535 / 3 cols = ~21000 rows)
    const BATCH_SIZE = 5000;
    let inserted = 0;
    for (let start = 0; start < valid.length; start += BATCH_SIZE) {
      const batch = valid.slice(start, start + BATCH_SIZE);
      const values: any[] = [];
      const placeholders: string[] = [];
      let i = 1;
      for (const r of batch) {
        placeholders.push(`($${i}, $${i + 1}, $${i + 2})`);
        values.push(idMap[r.identificador], r.fecha_lectura, r.presion_bar ?? null);
        i += 3;
      }
      const result = await pool.query(
        `INSERT INTO mediciones_piezometros (piezometro_id, fecha_lectura, presion_bar)
         VALUES ${placeholders.join(", ")}
         ON CONFLICT (piezometro_id, fecha_lectura) DO NOTHING`,
        values
      );
      inserted += result.rowCount ?? 0;
    }

    const skipped = valid.length - inserted;

    return NextResponse.json({ inserted, skipped, not_found: notFound });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
