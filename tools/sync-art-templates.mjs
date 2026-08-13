// Build one illustration per event type and upload to R2 as
//   img.vegaskiddos.com/type/<id>/<width>.webp
//
// Reuses an existing ArtImage when we already have a good one for that type
// (Kids Cafe baked-goods art → food). Generates with OpenAI only for types
// that have no donor (yoga, etc).
//
//   npx tsx tools/sync-art-templates.mjs
//   npx tsx tools/sync-art-templates.mjs --dry-run
//   npx tsx tools/sync-art-templates.mjs --force --only yoga,market
//   npx tsx tools/sync-art-templates.mjs --fill-event recXXX
//
// Env: AIRTABLE_TOKEN, AIRTABLE_BASE_ID, CLOUDFLARE_API_TOKEN,
//      CLOUDFLARE_ACCOUNT_ID, [OPENAI_API_KEY], [GEN_QUALITY], [GEN_SIZE].
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { ART_TYPES, ART_TYPE_IDS, artTypeFor } from "../lib/eventArt.ts";

const execFileP = promisify(execFile);

try {
  for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const AT = process.env.AIRTABLE_TOKEN;
const BASE = process.env.AIRTABLE_BASE_ID;
const OPENAI = process.env.OPENAI_API_KEY;
const QUALITY = process.env.GEN_QUALITY || "medium";
const SIZE = process.env.GEN_SIZE || "1536x1024";
const BUCKET = "vegaskiddos-media";
const SIZES = [384, 640, 1024, 1600];
const WEBP_QUALITY = 78;
const WRANGLER = path.resolve("node_modules/.bin/wrangler");
const CDN = "https://img.vegaskiddos.com";

const DRY = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const onlyArg = process.argv.indexOf("--only");
const ONLY = onlyArg >= 0
  ? (process.argv[onlyArg + 1] || "").split(",").map((s) => s.trim()).filter(Boolean)
  : null;
const fillArg = process.argv.indexOf("--fill-event");
const FILL_EVENTS = fillArg >= 0
  ? (process.argv[fillArg + 1] || "").split(",").map((s) => s.trim()).filter(Boolean)
  : [];
const PREFERRED_DONORS = {
  food: "rec3lD5m1BcisA4yL", // Kids Cafe baked-goods art Adam already saw as correct
};

if (!AT || !BASE) { console.error("AIRTABLE_TOKEN / AIRTABLE_BASE_ID required"); process.exit(1); }
if (!DRY && (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)) {
  console.error("CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID required");
  process.exit(1);
}

function legacyTypeId(title, description = "") {
  const t = `${title} ${description}`.toLowerCase();
  const map = [
    [/ice ?cream|gelato|\bsundae|snow ?cone|popsicle|frozen yogurt|froyo/, "ice-cream"],
    [/storytime|story time|story ?walk|\bread|\bbook/, "storytime"],
    [/music|sing|concert|vocal|\bband\b|drum|ukulele/, "music"],
    [/\bart\b|paint|craft|draw|create|messy|color/, "art"],
    [/science|\bstem\b|lego|robot|coding|maker|experiment/, "stem"],
    [/dino|jurassic|fossil/, "dino"],
    [/nature|garden|hike|trail|butterfly|\bfarm|preserve|outdoor/, "nature"],
    [/animal|\bzoo\b|reptile|petting|touch tank|aquarium|shark|bug/, "animals"],
    [/swim|splash|\bpool\b|water play/, "swim"],
    [/dance|ballet|zumbini|movement|ballroom/, "dance"],
    [/puppet|theat|magic|circus|stage|drama/, "theater"],
    [/farmers market|\bmarket\b|vendor/, "market"],
    [/festival|parade|\bfair\b|celebration|carnival|fiesta/, "festival"],
    [/baby|toddler|infant|mommy|little ones|lapsit/, "baby"],
    [/teen|tween|gaming|\bgame|esport|anime/, "gaming"],
    [/scavenger|\bhunt\b|explore|adventure|quest/, "scavenger"],
    [/chess|board game|puzzle/, "boardgame"],
    [/cook|baking|food|eat|snack|cafe/, "food"],
  ];
  for (const [re, id] of map) if (re.test(t)) return id;
  return "celebration";
}

function attachment(v) {
  if (Array.isArray(v) && v[0] && typeof v[0] === "object" && v[0].url) {
    return { url: String(v[0].url), id: String(v[0].id || v[0].url) };
  }
  return null;
}

async function airtableAll(params = "") {
  const out = [];
  let offset;
  do {
    const u = `https://api.airtable.com/v0/${BASE}/Events?pageSize=100${params}${offset ? `&offset=${offset}` : ""}`;
    const r = await fetch(u, { headers: { Authorization: `Bearer ${AT}` } });
    if (!r.ok) throw new Error(`Airtable ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json();
    out.push(...d.records);
    offset = d.offset;
  } while (offset);
  return out;
}

async function r2Exists(typeId) {
  const r = await fetch(`${CDN}/type/${typeId}/1024.webp`, { method: "HEAD" });
  return r.ok;
}

function templatePrompt(subject) {
  return `Flat vector children's illustration of ${subject}, composed as a single centered scene. Use the Vegas Kiddos brand palette of coral red, teal, sunny yellow, and grape purple on warm sand. Background: a clean warm-sand background. Include a tiny saguaro cactus in a corner. Wide horizontal banner — keep the main subject centered so it crops cleanly for link previews and card thumbnails. Friendly, playful, child-appropriate. Absolutely no text, no letters, no words, no real human faces, no photorealism. Comfortable side margins.`;
}

async function generatePng(subject) {
  if (!OPENAI) throw new Error("OPENAI_API_KEY required to generate a new type template");
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-1", prompt: templatePrompt(subject), size: SIZE, quality: QUALITY, n: 1 }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`No image returned: ${JSON.stringify(data).slice(0, 200)}`);
  return Buffer.from(b64, "base64");
}

async function uploadSizes(pngBuf, keyPrefix) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vk-type-"));
  try {
    for (const w of SIZES) {
      const buf = await sharp(pngBuf)
        .resize(w, null, { withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      const tmp = path.join(tmpRoot, `${w}.webp`);
      fs.writeFileSync(tmp, buf);
      await execFileP(WRANGLER, [
        "r2", "object", "put", `${BUCKET}/${keyPrefix}/${w}.webp`,
        "--file", tmp, "--content-type", "image/webp",
        "--cache-control", "public, max-age=31536000, immutable", "--remote",
      ], { env: process.env });
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

async function main() {
  const types = ART_TYPE_IDS.filter((id) => !ONLY || ONLY.includes(id));
  console.log(`Art type templates: ${types.join(", ")}${DRY ? " (dry-run)" : ""}${FORCE ? " (force)" : ""}`);

  console.log("Fetching approved events for donor images…");
  const recs = await airtableAll(`&filterByFormula=${encodeURIComponent("{Approved}=1")}`);
  const donors = new Map();
  for (const rec of recs) {
    const f = rec.fields || {};
    const art = attachment(f.ArtImage);
    if (!art) continue;
    const type = artTypeFor(String(f.Title || ""), String(f.Description || ""));
    const legacy = legacyTypeId(String(f.Title || ""), String(f.Description || ""));
    // Only reuse art that was generated for this type under the old matcher.
    // Otherwise a "Farmer's Market" whose ArtImage is a garden (old `\bfarm`
    // rule) would become the market template.
    if (legacy !== type.id) continue;
    const titleType = artTypeFor(String(f.Title || ""), "");
    const current = donors.get(type.id);
    const candidate = { id: rec.id, title: f.Title, url: art.url, titleMatch: titleType.id === type.id };
    if (!current || (!current.titleMatch && candidate.titleMatch)) donors.set(type.id, candidate);
  }
  for (const [typeId, recId] of Object.entries(PREFERRED_DONORS)) {
    const rec = recs.find((r) => r.id === recId);
    const art = rec && attachment(rec.fields?.ArtImage);
    if (art) donors.set(typeId, { id: rec.id, title: rec.fields.Title, url: art.url, titleMatch: true });
  }

  for (const id of types) {
    const type = ART_TYPES[id];
    const exists = FORCE ? false : await r2Exists(id);
    const donor = donors.get(id);
    if (exists) {
      console.log(`  skip ${id} (already on R2)`);
      continue;
    }
    if (DRY) {
      console.log(`  ${id}: ${donor ? `reuse ${donor.id} "${donor.title}"` : "GENERATE new template"}`);
      continue;
    }
    let png;
    if (donor) {
      console.log(`  ${id}: reusing ${donor.id} "${donor.title}"`);
      const r = await fetch(donor.url);
      if (!r.ok) throw new Error(`donor ${donor.id} ${r.status}`);
      png = Buffer.from(await r.arrayBuffer());
    } else {
      console.log(`  ${id}: generating…`);
      png = await generatePng(type.subject);
    }
    await uploadSizes(png, `type/${id}`);
    console.log(`  ${id}: uploaded`);
  }

  for (const recId of FILL_EVENTS) {
    const rec = recs.find((r) => r.id === recId);
    if (!rec) {
      console.warn(`  fill-event ${recId}: not in approved list, fetching…`);
    }
    const f = rec?.fields || {};
    const type = artTypeFor(String(f.Title || ""), String(f.Description || ""));
    if (DRY) {
      console.log(`  fill ${recId} → type/${type.id}`);
      continue;
    }
    const src = await fetch(`${CDN}/type/${type.id}/1024.webp`);
    if (!src.ok) {
      console.warn(`  fill ${recId}: type/${type.id} not on R2 yet (${src.status})`);
      continue;
    }
    // Re-upload from the type object we just wrote: fetch each size.
    for (const w of SIZES) {
      const r = await fetch(`${CDN}/type/${type.id}/${w}.webp`);
      if (!r.ok) continue;
      const tmp = path.join(os.tmpdir(), `${recId}-${w}.webp`);
      fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
      await execFileP(WRANGLER, [
        "r2", "object", "put", `${BUCKET}/event/${recId}/${w}.webp`,
        "--file", tmp, "--content-type", "image/webp",
        "--cache-control", "public, max-age=31536000, immutable", "--remote",
      ], { env: process.env });
      fs.rmSync(tmp, { force: true });
    }
    console.log(`  filled event/${recId} from type/${type.id}`);
  }

  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
