// Durable image sync: download each approved event's image, generate responsive
// WebP sizes, and upload them to the R2 bucket `vegaskiddos-media`, served at
// https://img.vegaskiddos.com/event/<id>/<width>.webp. The app references those
// stable URLs (lib/data.ts), so cached HTML never holds Airtable's ephemeral
// signed URLs — images survive any cache duration and need no external resizer.
//
// Idempotent: a manifest (tools/.image-sync-manifest.json) records each event's
// source identity; unchanged images are skipped on re-runs. Safe to run daily.
//
// Usage:
//   node tools/sync-images.mjs              # sync all approved events
//   node tools/sync-images.mjs --limit 5     # first N (smoke test)
//   node tools/sync-images.mjs --force       # ignore manifest, re-sync all
//
// Env: AIRTABLE_TOKEN, AIRTABLE_BASE_ID, [AIRTABLE_TABLE_NAME],
//      CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID (for wrangler r2 upload).
import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import sharp from "sharp";

const execFileP = promisify(execFile);

// Load .env.local (same convention as the other tools).
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
const BUCKET = "vegaskiddos-media";
const SIZES = [384, 640, 1024, 1600];
const QUALITY = 78;
const CONCURRENCY = 5;
const MANIFEST = "tools/.image-sync-manifest.json";
const WRANGLER = path.resolve("node_modules/.bin/wrangler");

const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i >= 0 ? parseInt(process.argv[i + 1], 10) : Infinity;
})();
const FORCE = process.argv.includes("--force");

if (!TOKEN || !BASE) {
  console.error("Missing AIRTABLE_TOKEN / AIRTABLE_BASE_ID");
  process.exit(1);
}
if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
  console.error("Missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID");
  process.exit(1);
}

// First URL out of an Airtable attachment field; returns { url, id } identity.
function attachment(v) {
  if (Array.isArray(v) && v[0] && typeof v[0] === "object" && v[0].url) {
    return { url: String(v[0].url), id: String(v[0].id || v[0].url) };
  }
  return null;
}

async function fetchEvents() {
  const out = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}`);
    url.searchParams.set("filterByFormula", "{Approved}=1");
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) throw new Error(`Airtable ${res.status}`);
    const data = await res.json();
    for (const rec of data.records) {
      const f = rec.fields;
      // Prefer AI art (ArtImage attachment) over the scraped Image URL — matches lib/data.ts.
      const art = attachment(f.ArtImage);
      const src = art ? art.url : (f.Image ? String(f.Image) : null);
      const identity = art ? art.id : (f.Image ? String(f.Image) : null);
      if (src) out.push({ id: rec.id, src, identity });
    }
    offset = data.offset;
  } while (offset);
  return out;
}

const manifest = (() => {
  if (FORCE) return {};
  try { return JSON.parse(fs.readFileSync(MANIFEST, "utf8")); } catch { return {}; }
})();

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vk-img-"));

async function syncOne(ev) {
  if (!FORCE && manifest[ev.id] === ev.identity) return "skip";
  const res = await fetch(ev.src);
  if (!res.ok) { console.warn(`  ! ${ev.id}: source ${res.status}`); return "err"; }
  const input = Buffer.from(await res.arrayBuffer());
  for (const w of SIZES) {
    const buf = await sharp(input)
      .resize(w, null, { withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();
    const tmp = path.join(tmpRoot, `${ev.id}-${w}.webp`);
    fs.writeFileSync(tmp, buf);
    await execFileP(WRANGLER, [
      "r2", "object", "put", `${BUCKET}/event/${ev.id}/${w}.webp`,
      "--file", tmp, "--content-type", "image/webp",
      "--cache-control", "public, max-age=31536000, immutable", "--remote",
    ], { env: process.env });
    fs.rmSync(tmp, { force: true });
  }
  manifest[ev.id] = ev.identity;
  return "ok";
}

async function main() {
  console.log("Fetching approved events…");
  let events = await fetchEvents();
  console.log(`${events.length} events with an image.`);
  if (LIMIT !== Infinity) events = events.slice(0, LIMIT);

  let ok = 0, skip = 0, err = 0, done = 0;
  const queue = [...events];
  async function worker() {
    while (queue.length) {
      const ev = queue.shift();
      try {
        const r = await syncOne(ev);
        if (r === "ok") ok++; else if (r === "skip") skip++; else err++;
      } catch (e) {
        err++; console.warn(`  ! ${ev.id}: ${e.message}`);
      }
      if (++done % 25 === 0) {
        console.log(`  …${done}/${events.length} (ok ${ok}, skip ${skip}, err ${err})`);
        fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 0));
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 0));
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log(`Done. uploaded ${ok}, skipped ${skip}, errors ${err}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
