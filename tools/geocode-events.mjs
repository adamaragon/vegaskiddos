// Backfill missing Lat/Lng on approved events so they show on the Map view.
//
// Many scraped events (gov calendars, libraries) carry an address or venue but
// no coordinates, so >half the catalog was invisible on the map. This geocodes
// them via OpenStreetMap Nominatim (no API key), bounded to the Las Vegas metro
// so we never grab a same-named place in another city. Idempotent: only touches
// events missing Lat/Lng, safe to re-run after every scrape.
//
// Usage:
//   node tools/geocode-events.mjs            # geocode + write
//   node tools/geocode-events.mjs --dry       # preview only
//   node tools/geocode-events.mjs --limit 20  # cap how many this run
//
// Env: AIRTABLE_TOKEN, AIRTABLE_BASE_ID, [AIRTABLE_TABLE_NAME=Events]
import fs from "fs";

try {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trimStart().startsWith("#")) {
      const k = line.slice(0, i).trim();
      if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
    }
  }
} catch {}

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE = process.env.AIRTABLE_BASE_ID;
const TABLE = process.env.AIRTABLE_TABLE_NAME || "Events";
const DRY = process.argv.includes("--dry");
const LIMIT = (() => { const i = process.argv.indexOf("--limit"); return i > -1 ? Number(process.argv[i + 1]) : Infinity; })();

if (!TOKEN || !BASE) { console.error("Missing AIRTABLE_TOKEN / AIRTABLE_BASE_ID"); process.exit(1); }

const API = "https://api.airtable.com/v0";
const T = encodeURIComponent(TABLE);
// Las Vegas metro bounding box (incl. Henderson, North LV). [minLat,maxLat,minLng,maxLng]
const BOX = { minLat: 35.80, maxLat: 36.40, minLng: -115.70, maxLng: -114.80 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function allRecords() {
  let recs = [], offset;
  do {
    const u = new URL(`${API}/${BASE}/${T}`);
    u.searchParams.set("pageSize", "100");
    if (offset) u.searchParams.set("offset", offset);
    const r = await fetch(u, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!r.ok) throw new Error(`Airtable ${r.status}: ${await r.text()}`);
    const j = await r.json();
    recs = recs.concat(j.records);
    offset = j.offset;
  } while (offset);
  return recs;
}

// Best geocoding query for an event: a street address if it has a number,
// else the venue name — always pinned to the Las Vegas metro.
function queryFor(f) {
  const addr = String(f.Address || "")
    .replace(/\s+-\s*$/, "")
    .replace(/\s*-\s*[^,]*room[^,]*$/i, "")
    .replace(/,?\s*(suite|ste\.?|unit|#)\s*\S+/i, "") // drop suite/unit — Nominatim chokes on it
    .trim();
  if (/\d{2,}/.test(addr) && addr.length > 8) {
    return /\bNV\b|nevada|las vegas|henderson|north las vegas|boulder city|mt\.?\s*charleston/i.test(addr)
      ? addr
      : `${addr}, Las Vegas, NV`;
  }
  const venue = String(f.Venue || "").trim();
  if (venue.length > 2) {
    return /\bNV\b|nevada|las vegas|henderson|north las vegas|boulder city|mt\.?\s*charleston/i.test(venue)
      ? venue
      : `${venue}, Las Vegas, NV`;
  }
  return null;
}

async function geocode(q) {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("q", q);
  u.searchParams.set("format", "json");
  u.searchParams.set("countrycodes", "us");
  u.searchParams.set("limit", "1");
  u.searchParams.set("viewbox", `${BOX.minLng},${BOX.maxLat},${BOX.maxLng},${BOX.minLat}`);
  u.searchParams.set("bounded", "1");
  const r = await fetch(u, { headers: { "User-Agent": "VegasKiddos/1.0 (events map geocoder; adam@threesided.com)" } });
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const j = await r.json();
  if (!j.length) return null;
  const lat = Number(j[0].lat), lng = Number(j[0].lon);
  // Reject anything outside the metro — a wrong-city match is worse than none.
  if (lat < BOX.minLat || lat > BOX.maxLat || lng < BOX.minLng || lng > BOX.maxLng) return null;
  return { lat, lng };
}

async function patch(id, fields) {
  const r = await fetch(`${API}/${BASE}/${T}/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!r.ok) throw new Error(`Airtable PATCH ${r.status}: ${await r.text()}`);
}

const CACHE_PATH = "tools/.geocode-cache.json";
let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")); } catch {}
function cacheSet(q, val) {
  cache[q] = val;
  try { fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2)); } catch {}
}

const recs = await allRecords();
const missing = recs.filter((r) => !r.fields.Rejected && (!Number(r.fields.Lat) || !Number(r.fields.Lng)));
console.log(`${recs.filter(r=>r.fields.Approved).length} approved · ${missing.length} missing coordinates${DRY ? " (DRY RUN)" : ""}\n`);

let done = 0, skipped = 0;
for (const r of missing.slice(0, LIMIT === Infinity ? missing.length : LIMIT)) {
  const q = queryFor(r.fields);
  if (!q) { console.log(`· skip "${r.fields.Title}" — no address or venue`); skipped++; continue; }
  try {
    if (cache[q]) {
      const c = cache[q];
      console.log(`✓ ${r.fields.Title}  →  ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}   [${q}] (cached)`);
      if (!DRY) { await patch(r.id, { Lat: c.lat, Lng: c.lng }); done++; }
      continue;
    }
    await sleep(1100); // Nominatim usage policy: max 1 req/sec
    const c = await geocode(q);
    if (!c) { console.log(`✗ "${r.fields.Title}" — no metro match for: ${q}`); skipped++; continue; }
    cacheSet(q, c);
    console.log(`✓ ${r.fields.Title}  →  ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}   [${q}]`);
    if (!DRY) { await patch(r.id, { Lat: c.lat, Lng: c.lng }); done++; }
  } catch (e) {
    console.error(`✗ "${r.fields.Title}" — ${e.message}`); skipped++;
  }
}
console.log(DRY ? `\nDry run complete — ${skipped} unresolved.` : `\nGeocoded ${done}, ${skipped} unresolved.`);
