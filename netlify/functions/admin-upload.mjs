import { json, verify } from "../lib/auth.mjs";
import { imageStore } from "../lib/catalog.mjs";
import { randomBytes } from "node:crypto";
export const config = { path: "/api/admin/upload" };
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export default async (req) => {
  if (!verify(req)) return json(401, { ok: false, error: "Sesiune expirată. Intră din nou." });
  if (req.method !== "POST") return json(405, { ok: false });
  const type = (req.headers.get("content-type") || "").split(";")[0].trim();
  if (!TYPES[type]) return json(415, { ok: false, error: "Doar JPG, PNG sau WEBP." });
  const buf = new Uint8Array(await req.arrayBuffer());
  if (!buf.length || buf.length > 4 * 1024 * 1024) return json(413, { ok: false, error: "Poza e prea mare (max. 4 MB)." });
  // verificare semnătură fișier
  const sig = [...buf.slice(0, 12)];
  const isJpg = sig[0] === 0xff && sig[1] === 0xd8;
  const isPng = sig[0] === 0x89 && sig[1] === 0x50;
  const isWebp = String.fromCharCode(...sig.slice(8, 12)) === "WEBP";
  if (!(isJpg || isPng || isWebp)) return json(415, { ok: false, error: "Fișierul nu este o imagine validă." });
  const name = `${Date.now().toString(36)}-${randomBytes(5).toString("hex")}.${TYPES[type]}`;
  await imageStore().set(name, buf, { metadata: { type } });
  return json(200, { ok: true, url: `/img/${name}` });
};
