import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "vtx_session";
function secret() {
  const value = process.env.VTX_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("VTX_SESSION_SECRET must contain at least 32 characters");
  return value;
}
function sign(value: string) { return createHmac("sha256", secret()).update(value).digest("hex"); }
export async function createSession() {
  const payload = `${Date.now() + 7 * 24 * 60 * 60 * 1000}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 7 * 24 * 60 * 60 });
}
export async function isAuthenticated() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !/^\d+$/.test(payload) || Number(payload) < Date.now()) return false;
  const expected = Buffer.from(sign(payload), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function destroySession() {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
}
