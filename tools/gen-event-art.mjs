// AI event artwork generator. For scheduled + recurring events that lack an
// image, generate an on-brand flat illustration with OpenAI and upload it into
// the Events table's `ArtImage` attachment field (Airtable hosts it).
//
//   node tools/gen-event-art.mjs sample [n]     → generate n (default 2) to
//                                                  ./art-samples/, no upload
//   node tools/gen-event-art.mjs batch [--limit n]  → generate + upload
//   add --dry-run to list the selection + prompts only
//
// Env: OPENAI_API_KEY, AIRTABLE_TOKEN, AIRTABLE_BASE_ID, [GEN_QUALITY].
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

function promptFor(f) {
  const subject = subjectFor(`${f.Title} ${f.Description || ""}`);
  return `Flat vector children's illustration of ${subject}. Bright and cheerful with simple, rounded geometric shapes and a clean warm-sand background. Color palette: coral red, teal, sunny yellow, grape purple. Subtle Las Vegas desert motifs (a small cactus, a warm sun). Friendly and playful, designed as a thumbnail for a kids' events website. Absolutely no text, no letters, no words, and no real human faces. Centered composition with comfortable margins.`;
}

async function generate(prompt) {
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1536x1024", quality: QUALITY, n: 1 }),
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

// Selection: approved, (recurring OR scheduled-to-FB), and no image yet.
const formula = "AND({Approved}=1, OR(NOT({Recurrence}=BLANK()), NOT({FBPostedAt}=BLANK())), {Image}=BLANK(), {ArtImage}=BLANK())";
let recs;
try {
  recs = (await airtableAll("Events", `&filterByFormula=${encodeURIComponent(formula)}`)).filter((r) => r.fields.Title);
} catch (e) {
  if (/ArtImage/.test(String(e)) || /INVALID_FILTER/.test(String(e))) {
    console.error("Missing 'ArtImage' field — run `npm run ensure-art-field` first.");
    process.exit(1);
  }
  throw e;
}

console.log(`${recs.length} event(s) need artwork (recurring + scheduled, no image yet). Mode: ${mode}${DRY ? " (dry-run)" : ""}.`);

if (DRY) {
  for (const r of recs.slice(0, 40)) console.log(`  • ${r.fields.Title}\n      ${promptFor(r.fields).slice(0, 110)}…`);
  process.exit(0);
}
if (!OPENAI) { console.error("OPENAI_API_KEY required to generate. Add it to .env.local."); process.exit(1); }

if (mode === "sample") {
  const dir = process.env.SAMPLE_DIR || "./art-samples";
  fs.mkdirSync(dir, { recursive: true });
  const picks = recs.slice(0, sampleN);
  for (const r of picks) {
    console.log(`🎨 ${r.fields.Title} …`);
    const b64 = await generate(promptFor(r.fields));
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
      const b64 = await generate(promptFor(r.fields));
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
