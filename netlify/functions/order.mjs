// ZEVS – primește comanda de pe site, îi dă un număr unic (ZV-1, ZV-2 …)
// și o trimite pe Telegram. Tokenul botului stă DOAR în variabilele Netlify.
import { getStore } from "@netlify/blobs";
import { loadCatalog } from "../lib/catalog.mjs";

export const config = { path: "/api/order" };

// Prețurile se verifică pe server, din catalogul salvat (clientul nu le poate modifica).
const DELIVERY = {
  meet: { name: "Întâlnire fizică (Chișinău)", fee: 0 },
  post: { name: "Poșta Moldovei", fee: 50 },
  cur:  { name: "Curier", fee: 50 },
};

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const clean = (v, max = 120) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const digits = (v) => String(v ?? "").replace(/\D/g, "");
const fphone = (d) => "+373 " + d.slice(3).replace(/^(\d{2})(\d{3})(\d{3}).*$/, "$1 $2 $3");
const money = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " MDL";

async function nextOrderNumber() {
  const store = getStore({ name: "zevs-orders", consistency: "strong" });
  for (let i = 0; i < 6; i++) {
    const cur = await store.getWithMetadata("counter", { type: "json" });
    const n = (cur?.data?.n ?? 0) + 1;
    const opts = cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true };
    const res = await store.setJSON("counter", { n }, opts);
    if (!res || res.modified !== false) return n;          // scris cu succes
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120)); // conflict: reîncearcă
  }
  throw new Error("counter_busy");
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "method" });

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT = process.env.TELEGRAM_CHAT_ID;
  if (!TOKEN || !CHAT) return json(500, { ok: false, error: "not_configured" });

  const raw = await req.text();
  if (raw.length > 8000) return json(413, { ok: false, error: "too_large" });
  let b;
  try { b = JSON.parse(raw); } catch { return json(400, { ok: false, error: "bad_json" }); }
  if (b.website) return json(200, { ok: true, no: "ZV-0" }); // capcană anti-spam

  // ---- validare ----
  const { products } = await loadCatalog();
  const CATALOG = Object.fromEntries(products.filter((p) => p.active !== false).map((p) => [p.id, { name: p.name, price: p.price, sizes: p.sizes.filter((s) => s[1]).map((s) => s[0]) }]));
  const items = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
  const lines = [];
  let subtotal = 0;
  for (const it of items) {
    const p = CATALOG[it?.id];
    const q = Math.floor(Number(it?.q));
    const s = clean(it?.s, 6);
    if (!p || !p.sizes.includes(s) || !(q >= 1 && q <= 10)) return json(400, { ok: false, error: "bad_item" });
    subtotal += p.price * q;
    lines.push(`• ${p.name} — mărimea ${s} × ${q} = ${money(p.price * q)}`);
  }
  if (!lines.length) return json(400, { ok: false, error: "empty" });

  const name = clean(b.name, 80);
  const phone = digits(b.phone);
  const tg = clean(b.tg, 40).replace(/[^@A-Za-z0-9_]/g, "");
  let city = clean(b.city, 60);
  if (city === "Altă localitate") city = clean(b.cityo, 60);
  const dmKey = DELIVERY[b.dm] ? b.dm : null;
  if (!name || phone.length < 11 || !city || !dmKey) return json(400, { ok: false, error: "missing" });
  if (city !== "Chișinău" && dmKey !== "post") return json(400, { ok: false, error: "delivery" });
  const d = DELIVERY[dmKey];

  let addr = "";
  if (dmKey === "post") {
    const f = { ln: clean(b.pln, 60), fn: clean(b.pfn, 60), str: clean(b.str, 120), raion: clean(b.raion, 60), zip: clean(b.zip, 12), ph: digits(b.pph) };
    if (!f.ln || !f.fn || !f.str || !f.raion || !f.zip || f.ph.length < 11) return json(400, { ok: false, error: "missing_post" });
    addr = `\n📦 Date poștă:\n   ${f.ln} ${f.fn}\n   ${f.str}, ${f.raion}\n   Cod poștal: ${f.zip}\n   Tel: ${fphone(f.ph)}`;
  } else if (dmKey === "cur") {
    const a = clean(b.addr, 160), c = clean(b.com, 160);
    if (!a) return json(400, { ok: false, error: "missing_addr" });
    addr = `\n🏠 Adresa: ${a}` + (c ? `\n💬 Comentariu: ${c}` : "");
  }

  // ---- număr unic ----
  let n;
  try { n = await nextOrderNumber(); } catch { return json(503, { ok: false, error: "busy" }); }
  const no = `ZV-${n}`;
  const total = subtotal + d.fee;
  const when = new Date().toLocaleString("ro-MD", { timeZone: "Europe/Chisinau", dateStyle: "short", timeStyle: "short" });

  const text =
`🛍 Comandă nouă #${no}
🕒 ${when}

👤 ${name}
📞 ${fphone(phone)}
✈️ ${tg && tg !== "@" ? tg : "—"}
📍 ${city}
🚚 ${d.name}${d.fee ? ` (+${money(d.fee)})` : ""}${addr}

Produse:
${lines.join("\n")}

Subtotal: ${money(subtotal)}
Livrare: ${d.fee ? money(d.fee) : "—"}
TOTAL: ${money(total)}`;

  const tgRes = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT, text, disable_web_page_preview: true }),
  }).catch(() => null);
  if (!tgRes || !tgRes.ok) return json(502, { ok: false, error: "telegram" });

  return json(200, { ok: true, no, total });
};
