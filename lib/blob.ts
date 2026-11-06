import { del, get, list, put } from "@vercel/blob";

const PREFIX = "vtx-data/workspace/";
export function toBlobPath(path: string) {
  if (typeof path !== "string" || path.length > 900) throw new Error("Invalid path");
  const clean = path.replace(/^\/+/, "");
  const parts = clean.split("/");
  if (parts.some(p => !p || p === "." || p === ".." || p.includes("\\") || p.includes("\0"))) throw new Error("Invalid path");
  if (parts[0] !== "workspace") throw new Error("Access outside /workspace is denied");
  return PREFIX + parts.slice(1).join("/");
}
export async function listWorkspace(prefix = "workspace/") {
  const safe = prefix.replace(/^\/+/, "");
  if (safe !== "workspace/" && !safe.startsWith("workspace/")) throw new Error("Access outside /workspace is denied");
  const result = await list({ prefix: PREFIX + safe.slice("workspace/".length), limit: 1000 });
  return result.blobs.map(b => ({
    pathname: "/workspace/" + b.pathname.slice(PREFIX.length),
    size: b.size,
    uploadedAt: b.uploadedAt.toISOString(),
    url: b.url
  }));
}
export async function readWorkspace(path: string) {
  const pathname = toBlobPath(path);
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200) throw new Error("File not found");
  return new Response(result.stream).text();
}
export async function writeWorkspace(path: string, content: string | Blob) {
  const pathname = toBlobPath(path);
  const blob = await put(pathname, content, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/octet-stream" });
  return blob;
}
export async function deleteWorkspace(path: string) {
  await del(toBlobPath(path));
}
