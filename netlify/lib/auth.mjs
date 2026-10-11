// Autentificare admin: parola stă în variabila secretă ADMIN_PASSWORD (Netlify).
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";

const TTL = 12 * 60 * 60 * 1000; // sesiune 12 ore
const key = () => createHash("sha256").update("zevs-admin:" + (process.env.ADMIN_PASSWORD || "") + ":" + (process.env.ADMIN_SECRET || "")).digest();
const b64 = (b) => Buffer.from(b).toString("base64url");

export const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export function passwordOk(input) {
  const real = process.env.ADMIN_PASSWORD || "";
  if (real.length < 8) return false;
  const a = createHash("sha256").update(String(input ?? "")).digest();
  const b = createHash("sha256").update(real).digest();
  return timingSafeEqual(a, b);
}

export function makeToken() {
  const payload = b64(JSON.stringify({ exp: Date.now() + TTL }));
  const sig = b64(createHmac("sha256", key()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verify(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const h = req.headers.get("authorization") || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [payload, sig] = t.split(".");
  if (!payload || !sig) return false;
  const good = b64(createHmac("sha256", key()).update(payload).digest());
  if (good.length !== sig.length || !timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return false;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now(); } catch { return false; }
}

/** Limitează încercările greșite de parolă: max 8 la 15 minute per IP. */
export async function tooManyAttempts(ip, failed) {
  const store = getStore({ name: "zevs-admin", consistency: "strong" });
  const k = "fail-" + createHash("sha256").update(ip || "x").digest("hex").slice(0, 24);
  const now = Date.now();
  const cur = (await store.get(k, { type: "json" }).catch(() => null)) || { n: 0, t: now };
  if (now - cur.t > 15 * 60 * 1000) { cur.n = 0; cur.t = now; }
  if (failed) { cur.n += 1; await store.setJSON(k, cur).catch(() => {}); }
  return cur.n >= 8;
}
