import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { writeWorkspace } from "@/lib/blob";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  if (!await isAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    const path = form.get("path");
    if (!(file instanceof File) || typeof path !== "string") return NextResponse.json({ error: "Missing file or path" }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Max upload is 4 MB via this route" }, { status: 413 });
    await writeWorkspace(path, file);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 }); }
}
