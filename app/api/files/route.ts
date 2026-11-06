import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { listWorkspace } from "@/lib/blob";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  if (!await isAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const prefix = req.nextUrl.searchParams.get("prefix") || "workspace/";
    return NextResponse.json({ files: await listWorkspace(prefix) });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "List failed" }, { status: 400 }); }
}
