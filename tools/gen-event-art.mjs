// AI event artwork generator. For scheduled + recurring events that lack an
// image, generate an on-brand flat illustration with OpenAI and upload it into
// the Events table's `ArtImage` attachment field (Airtable hosts it).
//
//   node tools/gen-event-art.mjs sample [n]     → generate n (default 2) to
//                                                  ./art-samples/, no upload
//   node tools/gen-event-art.mjs batch [--limit n]  → generate + upload
//   add --dry-run to list the selection + prompts only
//
// Env: OPENAI_API_KEY, AIRTABLE_TOKEN, AIRTABLE_BASE_ID, [GEN_QUALITY], [GEN_SIZE].
// gpt-image-1 sizes: 1024x1024 | 1536x1024 (landscape) | 1024x1536 — no true 16:9.
import fs from "node:fs";

try {
  for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const OPENAI = process.env.OPENAI_API_KEY;
const AT = process.env.AIRTABLE_TOKEN, BASE = process.env.AIRTABLE_BASE_ID;
const QUALITY = process.env.GEN_QUALITY || "medium";
const SIZE = process.env.GEN_SIZE || "1536x1024";
if (!AT || !BASE) { console.error("AIRTABLE_TOKEN / AIRTABLE_BASE_ID required"); process.exit(1); }

const mode = (process.argv[2] || "sample").toLowerCase();
const DRY = process.argv.includes("--dry-run");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg >= 0 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;
const sampleN = parseInt(process.argv[3], 10) || 2;

async function airtableAll(table, params = "") {
  const out = []; let offset;
  do {
    const u = `https://api.airtable.com/v0/${BASE}/${table}?pageSize=100${params}${offset ? `&offset=${offset}` : ""}`;
    const r = await fetch(u, { headers: { Authorization: `Bearer ${AT}` } });
    if (!r.ok) throw new Error(`${table} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json(); out.push(...d.records); offset = d.offset;
  } while (offset);
  return out;
}

// Map an event's text to a concrete illustration subject (keeps art relevant).
function subjectFor(text) {
  const t = text.toLowerCase();
  const map = [
    [/ice ?cream|gelato|\bsundae|snow ?cone|popsicle|frozen yogurt|froyo/, "colorful ice cream cones, scoops, and a sundae topped with sprinkles and a cherry"],
    [/storytime|story time|story ?walk|\bread|\bbook/, "an open storybook with friendly characters drifting out"],
    [/music|sing|concert|vocal|\bband\b|drum|ukulele/, "colorful musical instruments and floating music notes"],
    [/\bart\b|paint|craft|draw|create|messy|color/, "paint pots, brushes and craft supplies"],
    [/science|\bstem\b|lego|robot|coding|maker|experiment/, "playful little robots and bubbling science beakers"],
    [/dino|jurassic|fossil/, "a cute friendly cartoon dinosaur"],
    [/nature|garden|hike|trail|butterfly|\bfarm|preserve|outdoor/, "a sunny garden with plants and butterflies"],
    [/animal|\bzoo\b|reptile|petting|touch tank|aquarium|shark|bug/, "friendly cartoon animals"],
    [/swim|splash|\bpool\b|water play/, "a cheerful splashing pool scene"],
    [/dance|ballet|zumbini|movement|ballroom/, "joyful dancing figures and ribbons"],
    [/puppet|theat|magic|circus|stage|drama/, "a little puppet-theater stage with curtains"],
    [/farmers market|\bmarket\b|vendor/, "a farmers market with fruit and veggie stands"],
    [/festival|parade|\bfair\b|celebration|carnival|fiesta/, "a festive carnival scene with balloons and bunting"],
    [/baby|toddler|infant|mommy|little ones|lapsit/, "soft toys and stacking blocks for little ones"],
    [/teen|tween|gaming|\bgame|esport|anime/, "game controllers and playful arcade shapes"],
    [/scavenger|\bhunt\b|explore|adventure|quest/, "a treasure map and a magnifying glass"],
    [/chess|board game|puzzle/, "oversized board-game pieces and puzzle shapes"],
    [/cook|baking|food|eat|snack|cafe/, "cookies, cupcakes and baking treats"],
  ];
  for (const [re, subj] of map) if (re.test(t)) return subj;
  return "balloons, confetti and a cheerful celebration";
}

// Deterministic per-event variation so events that share a subject (e.g. many
// storytimes) still get visibly different art. Each axis is sampled with a
// distinct hash salt so two events rarely share more than one trait.

// Color palettes. All stay family-friendly and harmonious; first one is the
// brand classic so the look stays recognizable. The rest are coherent themes
// rather than random brand-color mixes — gives each event its own little world.
const PALETTES = [
  "the Vegas Kiddos brand palette of coral red, teal, sunny yellow, and grape purple on warm sand",
  "a desert-sunset palette of peach, dusty coral, marigold gold, and soft lavender",
  "a soft pastel palette of mint, blush pink, cream, baby blue, and lilac",
  "a crayon-bright palette of primary red, royal blue, banana yellow, and leaf green",
  "an ocean-and-sand palette of sea green, sky blue, sandy cream, and soft coral",
  "a jungle-pop palette of emerald green, lime, marigold, and sunset orange",
  "a watermelon palette of bright pink, mint green, kiwi, and warm cream",
  "a storybook muted palette of slate blue, dusty rose, mustard, and ivory",
  "a sherbet palette of strawberry pink, orange creamsicle, lemon, and pistachio",
  "a desert-monsoon palette of teal, plum, sage, and soft terracotta",
];

// Art styles — all rounded and kid-friendly; style mostly affects texture and
// edge quality, not subject matter, so the brand "playful" feeling stays.
const STYLES = [
  "Flat vector children's illustration with crisp clean shapes",
  "Cut-paper collage illustration with subtle visible paper textures and slightly imperfect edges",
  "Soft gouache children's-book illustration with gentle brush texture and slightly painterly edges",
  "Crayon-textured kids'-book illustration with soft waxy edges and a hint of grain",
  "Bold rounded geometric illustration with simple stacked shapes, very minimal",
  "Storybook watercolor illustration with soft washy edges and tiny ink outlines",
  "Risograph-inspired children's illustration with two-tone grainy textures and slight color offsets",
];

const LAYOUTS = [
  "a single centered scene",
  "a playful flat-lay arrangement of elements",
  "a rounded badge / emblem composition",
  "a wide horizontal banner scene",
  "an isometric mini-diorama",
  "a cluster of elements bursting from one corner",
  "an off-center asymmetric composition with negative space",
  "a scattered confetti-like arrangement of small motifs",
];

const ACCENTS = [
  "a tiny saguaro cactus in a corner",
  "a smiling sun peeking in",
  "a couple of soft rounded clouds",
  "scattered confetti dots",
  "a sprinkle of little stars",
  "small rolling desert dunes",
  "a few tiny floating hearts",
  "a small rainbow arc",
  "a couple of tiny paper airplanes",
  "a sprinkle of leafy doodles",
];

const BACKGROUNDS = [
  "a clean warm-sand background",
  "a soft pastel gradient background that matches the palette",
  "a subtle polka-dot patterned background in two tones of the palette",
  "a clean cream background with a faint half-circle of color rising from the bottom",
  "a clean background with a few oversized soft-blurred color blobs behind the subject",
];

const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const pickV = (arr, h, salt) => arr[(h + salt) % arr.length];

function promptFor(f, id = "") {
  const subject = subjectFor(`${f.Title} ${f.Description || ""}`);
  const h = hashStr(id || f.Title || "");
  const style = pickV(STYLES, h, 1);
  const palette = pickV(PALETTES, h, 2);
  const layout = pickV(LAYOUTS, h, 3);
  const accent = pickV(ACCENTS, h, 4);
  const background = pickV(BACKGROUNDS, h, 5);
  return `${style} of ${subject}, composed as ${layout}. Use ${palette}. Background: ${background}. Include ${accent}. Wide horizontal banner — keep the main subject centered so it crops cleanly for link previews and card thumbnails. Friendly, playful, child-appropriate. Absolutely no text, no letters, no words, no real human faces, no photorealism. Comfortable side margins.`;
}

async function generate(prompt) {
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size: SIZE, quality: QUALITY, n: 1 }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`No image returned: ${JSON.stringify(data).slice(0, 200)}`);
  return b64;
}

async function uploadToAirtable(recordId, b64) {
  const r = await fetch(`https://content.airtable.com/v0/${BASE}/${recordId}/ArtImage/uploadAttachment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${AT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: "image/png", file: b64, filename: `${recordId}.png` }),
  });
  if (!r.ok) throw new Error(`Airtable upload ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

// Selection: by default every approved event with no image of any kind yet.
// With `--ids rec1,rec2,…` instead, regenerate art for exactly those records
// (used to repair events whose scraped Image died and never synced to R2 — the
// new ArtImage takes precedence in sync-images.mjs, so the R2 copy resolves).
const idsArg = (() => {
  const i = process.argv.indexOf("--ids");
  return i >= 0 ? (process.argv[i + 1] || "").split(",").map((s) => s.trim()).filter(Boolean) : null;
})();

let recs;
if (idsArg && idsArg.length) {
  const orClause = idsArg.map((id) => `RECORD_ID()='${id}'`).join(",");
  const formula = `OR(${orClause})`;
  recs = (await airtableAll("Events", `&filterByFormula=${encodeURIComponent(formula)}`)).filter((r) => r.fields.Title);
  console.log(`--ids: regenerating art for ${recs.length}/${idsArg.length} requested record(s).`);
} else {
  const formula = "AND({Approved}=1, {Image}=BLANK(), {ArtImage}=BLANK())";
  try {
    recs = (await airtableAll("Events", `&filterByFormula=${encodeURIComponent(formula)}`)).filter((r) => r.fields.Title);
  } catch (e) {
    if (/ArtImage/.test(String(e)) || /INVALID_FILTER/.test(String(e))) {
      console.error("Missing 'ArtImage' field — run `npm run ensure-art-field` first.");
      process.exit(1);
    }
    throw e;
  }
}

console.log(`${recs.length} approved event(s) with no image yet. Mode: ${mode}, size: ${SIZE}, quality: ${QUALITY}${DRY ? " (dry-run)" : ""}.`);

if (DRY) {
  for (const r of recs.slice(0, 40)) console.log(`  • ${r.fields.Title}\n      ${promptFor(r.fields, r.id).slice(0, 110)}…`);
  process.exit(0);
}
if (!OPENAI) { console.error("OPENAI_API_KEY required to generate. Add it to .env.local."); process.exit(1); }

if (mode === "sample") {
  const dir = process.env.SAMPLE_DIR || "./art-samples";
  fs.mkdirSync(dir, { recursive: true });
  const picks = recs.slice(0, sampleN);
  for (const r of picks) {
    console.log(`🎨 ${r.fields.Title} …`);
    const b64 = await generate(promptFor(r.fields, r.id));
    const path = `${dir}/${r.id}.png`;
    fs.writeFileSync(path, Buffer.from(b64, "base64"));
    console.log(`   saved ${path}`);
  }
  console.log(`\n✅ ${picks.length} sample(s) in ${dir} — review before batch.`);
} else if (mode === "batch") {
  const picks = recs.slice(0, LIMIT);
  let ok = 0, fail = 0;
  for (const r of picks) {
    try {
      const b64 = await generate(promptFor(r.fields, r.id));
      await uploadToAirtable(r.id, b64);
      ok++;
      console.log(`✅ ${ok}/${picks.length}  ${r.fields.Title}`);
    } catch (e) {
      fail++;
      console.error(`⚠️  ${r.fields.Title}: ${String(e).slice(0, 160)}`);
    }
  }
  console.log(`\nDone. Uploaded ${ok}, failed ${fail}.`);
} else {
  console.error(`Unknown mode "${mode}". Use: sample | batch`);
  process.exit(1);
}
