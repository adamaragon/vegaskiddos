// Sweep approved events for blank/short descriptions and fill them in.
//
// Some sources (notably the City of Henderson gov calendar) only yield a title
// + date — their detail pages are 403-walled, so events land with no
// Description and render blank on the site. This tool finds those and writes a
// concise, accurate, family-focused description grounded ONLY in the known
// facts (title, venue, city, date) — it does NOT invent prices, times, or
// specifics. Bilingual (Description + DescriptionEs). Idempotent: only touches
// events whose Description is under MIN_LEN chars, so it's safe to re-run after
// every scrape.
//
// Usage:
//   node tools/fill-blank-descriptions.mjs           # generate + write
//   node tools/fill-blank-descriptions.mjs --dry      # preview only, no writes
//
// Env: AIRTABLE_TOKEN, AIRTABLE_BASE_ID, [AIRTABLE_TABLE_NAME=Events], OPENAI_API_KEY
import fs from "fs";

// Load .env.local if present (so it works standalone like the other tools).
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
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini";
const MIN_LEN = 15;
const DRY = process.argv.includes("--dry");

if (!TOKEN || !BASE) { console.error("Missing AIRTABLE_TOKEN / AIRTABLE_BASE_ID"); process.exit(1); }
if (!OPENAI_KEY) { console.error("Missing OPENAI_API_KEY"); process.exit(1); }

const API = "https://api.airtable.com/v0";
const T = encodeURIComponent(TABLE);

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

const SYS = `You write short, warm, factual blurbs for a Las Vegas family events website (Vegas Kiddos).
Given only an event's title, venue, city and date, write a 2-3 sentence description a parent would find helpful.
RULES:
- Use ONLY the facts given. NEVER invent prices, exact times, ages, schedules, performers, or details you weren't told.
- Keep it general where unsure (e.g. "a family-friendly farmers market" rather than fabricated specifics).
- Warm and inviting but not hype-y. No emojis. No "click here". Don't restate the date/time.
- Mention the venue/area naturally when given.
Return STRICT JSON: {"en":"<english>","es":"<spanish translation, same meaning>"}`;

async function generate(ev) {
  const facts = [
    `Title: ${ev.Title}`,
    ev.Venue && `Venue: ${ev.Venue}`,
    `City: Henderson / Las Vegas area, Nevada`,
    ev.Start && `Date: ${new Date(ev.Start).toDateString()}`,
  ].filter(Boolean).join("\n");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYS }, { role: "user", content: facts }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const obj = JSON.parse(j.choices[0].message.content);
  return { en: String(obj.en || "").trim(), es: String(obj.es || "").trim() };
}

async function patch(id, fields) {
  const res = await fetch(`${API}/${BASE}/${T}/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) throw new Error(`Airtable PATCH ${res.status}: ${await res.text()}`);
}

const recs = await allRecords();
const blanks = recs.filter((r) => !r.fields.Rejected && (r.fields.Description || "").trim().length < MIN_LEN);
console.log(`${recs.filter(r=>r.fields.Approved).length} approved · ${blanks.length} blank description${blanks.length===1?"":"s"}${DRY?" (DRY RUN)":""}\n`);

let done = 0;
for (const r of blanks) {
  const ev = r.fields;
  try {
    const { en, es } = await generate(ev);
    if (!en) { console.log(`✗ ${ev.Title} — empty generation, skipped`); continue; }
    console.log(`• ${ev.Title}`);
    console.log(`  EN: ${en}`);
    console.log(`  ES: ${es}\n`);
    if (!DRY) {
      const fields = { Description: en };
      if (es) fields.DescriptionEs = es;
      await patch(r.id, fields);
      done++;
    }
  } catch (e) {
    console.error(`✗ ${ev.Title} — ${e.message}`);
  }
}
console.log(DRY ? "Dry run complete — no writes." : `Updated ${done}/${blanks.length} events.`);
