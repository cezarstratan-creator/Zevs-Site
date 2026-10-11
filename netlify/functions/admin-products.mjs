import { json, verify } from "../lib/auth.mjs";
import { loadCatalog, sanitizeProducts, catalogStore, CATS } from "../lib/catalog.mjs";
export const config = { path: "/api/admin/products" };
export default async (req) => {
  if (!verify(req)) return json(401, { ok: false, error: "Sesiune expirată. Intră din nou." });
  if (req.method === "GET") {
    const c = await loadCatalog();
    return json(200, { ok: true, ...c, cats: CATS });
  }
  if (req.method === "PUT") {
    const raw = await req.text();
    if (raw.length > 500000) return json(413, { ok: false, error: "Prea multe date." });
    let body; try { body = JSON.parse(raw); } catch { return json(400, { ok: false, error: "Date invalide." }); }
    let products;
    try { products = sanitizeProducts(body.products); } catch (e) { return json(400, { ok: false, error: e.message }); }
    const store = catalogStore();
    const prev = await store.get("products", { type: "json" }).catch(() => null);
    if (prev) await store.setJSON("backup-" + Date.now(), prev).catch(() => {}); // copie de siguranță
    const updatedAt = new Date().toISOString();
    await store.setJSON("products", { products, updatedAt });
    return json(200, { ok: true, products, updatedAt });
  }
  return json(405, { ok: false });
};
