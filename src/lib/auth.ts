import { NextResponse } from "next/server";

const N8N_API_TOKEN = process.env.N8N_API_TOKEN;

export function validateToken(request: Request): NextResponse | null {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Token requerido" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];

  if (token !== N8N_API_TOKEN) {
    return NextResponse.json({ error: "Token inválido" }, { status: 403 });
  }

  return null; // Token válido
}
