import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { get } from "@vercel/blob";
import { toBlobPath } from "@/lib/blob";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  if (!await isAuthenticated()) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const path = req.nextUrl.searchParams.get("path") || "";
    const blob = await get(toBlobPath(path), { access: "private" });
    if (!blob || blob.statusCode !== 200) return new NextResponse("Not found", { status: 404 });
    const filename = path.split("/").pop() || "download";
    return new NextResponse(blob.stream, { headers: { "Content-Type": blob.blob.contentType || "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (e) { return new NextResponse(e instanceof Error ? e.message : "Download failed", { status: 400 }); }
}
