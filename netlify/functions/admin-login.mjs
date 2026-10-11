import { json, passwordOk, makeToken, tooManyAttempts } from "../lib/auth.mjs";
export const config = { path: "/api/admin/login" };
export default async (req, context) => {
  if (req.method !== "POST") return json(405, { ok: false });
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 8)
    return json(500, { ok: false, error: "Parola de admin nu este setată pe Netlify (ADMIN_PASSWORD, minim 8 caractere)." });
  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "";
  if (await tooManyAttempts(ip, false)) return json(429, { ok: false, error: "Prea multe încercări. Încearcă peste 15 minute." });
  let body = {}; try { body = await req.json(); } catch {}
  if (!passwordOk(body.password)) {
    await tooManyAttempts(ip, true);
    await new Promise((r) => setTimeout(r, 600));
    return json(401, { ok: false, error: "Parolă greșită." });
  }
  return json(200, { ok: true, token: makeToken() });
};
