import { imageStore } from "../lib/catalog.mjs";
export const config = { path: "/img/:name" };
export default async (req, context) => {
  const name = String(context?.params?.name || new URL(req.url).pathname.split("/").pop() || "");
  if (!/^[a-z0-9._-]+$/i.test(name)) return new Response("Not found", { status: 404 });
  const r = await imageStore().getWithMetadata(name, { type: "arrayBuffer" }).catch(() => null);
  if (!r || !r.data) return new Response("Not found", { status: 404 });
  return new Response(r.data, { headers: { "content-type": r.metadata?.type || "image/jpeg", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
};
