// Catalogul ZEVS – sursa unică de adevăr pe server (Netlify Blobs).
import { getStore } from "@netlify/blobs";

export const CATS = ["Shirts","Geci","Hanorace","Zip-Hoodies","Sweater","Longsleeve","Tricouri","Polo","Jeans","Pantaloni","Belts","Glasses","Socks","Bracelets","Shoes","Slides"];

export const DEFAULT_PRODUCTS = [
  { id:"produs-nou",        name:"Produs Nou",        price:1499, cat:"Shirts",      imgs:["/images/p1.webp"], sizes:[["S",1],["M",1],["L",1],["XL",1]], home:true,  active:true, desc:"" },
  { id:"xya",               name:"xya",               price:8268, cat:"Hanorace",    imgs:["/images/p2.webp"], sizes:[["S",1],["M",1],["L",1],["XL",1]], home:true,  active:true, desc:"" },
  { id:"tape-type",         name:"Tape type",         price:2999, cat:"Tricouri",    imgs:["/images/p3.webp"], sizes:[["S",1],["M",1],["L",1],["XL",1]], home:true,  active:true, desc:"" },
  { id:"nba-collaboration", name:"NBA collaboration", price:1969, cat:"Geci",        imgs:["/images/p4.webp"], sizes:[["S",1],["M",1],["L",1],["XL",1]], home:true,  active:true, desc:"" },
  { id:"cursive-oversized", name:"Cursive oversized", price:1350, cat:"Hanorace",    imgs:["/images/p5.webp"], sizes:[["S",1],["M",1],["L",1],["XL",1]], home:false, active:true, desc:"" },
  { id:"back-zip-up",       name:"Back zip-up",       price:4599, cat:"Zip-Hoodies", imgs:["/images/p6.webp"], sizes:[["S",1],["M",1],["L",1],["XL",1]], home:false, active:true, desc:"" },
  { id:"basketball-series", name:"Basketball series", price:2135, cat:"Shirts",      imgs:["/images/p7.webp"], sizes:[["S",1],["M",1],["L",1],["XL",1]], home:false, active:true, desc:"" },
  { id:"track-sneakers",    name:"Track sneakers",    price:1899, cat:"Shoes",       imgs:["/images/p8.webp"], sizes:[["36",1],["38",1],["39",1],["41",1],["42",1]], home:false, active:true, desc:"" },
  { id:"tracksuit-pants",   name:"Tracksuit pants",   price:1999, cat:"Pantaloni",   imgs:["/images/p9.webp"], sizes:[["S",1],["M",1],["L",1],["XL",1]], home:false, active:true, desc:"" },
];

export const catalogStore = () => getStore({ name: "zevs-catalog", consistency: "strong" });
export const imageStore = () => getStore({ name: "zevs-images", consistency: "strong" });

/** Returnează { products, source: "store" | "default", updatedAt } */
export async function loadCatalog() {
  try {
    const d = await catalogStore().get("products", { type: "json" });
    if (d && Array.isArray(d.products)) return { products: d.products, source: "store", updatedAt: d.updatedAt || null };
  } catch {}
  return { products: DEFAULT_PRODUCTS, source: "default", updatedAt: null };
}

const str = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const slug = (v) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const IMG_RE = /^\/(images\/[a-z0-9._-]+|img\/[a-z0-9._-]+)$/i;

/** Validează și curăță lista trimisă din panoul de administrare. */
export function sanitizeProducts(list) {
  if (!Array.isArray(list)) throw new Error("Lista de produse lipsește.");
  if (list.length > 300) throw new Error("Prea multe produse (max. 300).");
  const seen = new Set();
  return list.map((p, i) => {
    const name = str(p?.name, 80);
    if (!name) throw new Error(`Produsul #${i + 1} nu are nume.`);
    let id = slug(p?.id) || slug(name) || `produs-${i + 1}`;
    while (seen.has(id)) id += "-2";
    seen.add(id);
    const price = Math.round(Number(p?.price));
    if (!(price > 0 && price < 1000000)) throw new Error(`Preț invalid la „${name}”.`);
    const cat = CATS.includes(p?.cat) ? p.cat : "Shirts";
    const sizes = (Array.isArray(p?.sizes) ? p.sizes : []).slice(0, 20)
      .map((s) => [str(Array.isArray(s) ? s[0] : s, 8).toUpperCase(), Array.isArray(s) ? (s[1] ? 1 : 0) : 1])
      .filter((s) => s[0]);
    if (!sizes.length) throw new Error(`Adaugă cel puțin o mărime la „${name}”.`);
    const imgs = (Array.isArray(p?.imgs) ? p.imgs : []).map((u) => String(u)).filter((u) => IMG_RE.test(u)).slice(0, 10);
    if (!imgs.length) throw new Error(`Adaugă cel puțin o poză la „${name}”.`);
    return { id, name, price, cat, sizes, imgs, home: !!p?.home, active: p?.active !== false, desc: str(p?.desc, 600) };
  });
}
