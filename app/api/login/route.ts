import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}));
  const expected = process.env.VTX_PASSWORD;
  if (!expected || typeof password !== "string" || password.length > 500 || password !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await createSession();
  return NextResponse.json({ ok: true });
}
