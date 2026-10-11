// Public: lista de produse pentru site.
import { loadCatalog } from "../lib/catalog.mjs";
export const config = { path: "/api/products" };
export default async () => {
  const { products, source, updatedAt } = await loadCatalog();
  return new Response(JSON.stringify({ source, updatedAt, products: products.filter((p) => p.active !== false) }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate" },
  });
};
