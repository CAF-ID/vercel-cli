import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { deleteWorkspace, readWorkspace, writeWorkspace } from "@/lib/blob";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const path = req.nextUrl.searchParams.get("path") || "";
    const content = await readWorkspace(path);
    return new NextResponse(content, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (e) { return new NextResponse(e instanceof Error ? e.message : "Read failed", { status: 404 }); }
}
export async function PUT(req: NextRequest) {
  if (!await isAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { path, content } = await req.json();
    if (typeof content !== "string" || content.length > 1_000_000) return NextResponse.json({ error: "Invalid content (max 1 MB)" }, { status: 413 });
    await writeWorkspace(path, content);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Write failed" }, { status: 400 }); }
}
export async function DELETE(req: NextRequest) {
  if (!await isAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await deleteWorkspace(req.nextUrl.searchParams.get("path") || "");
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Delete failed" }, { status: 400 }); }
}
