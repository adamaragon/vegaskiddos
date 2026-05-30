// Backfill missing AgeTiers on approved events so they show up under the right
// age filter and carry age tags. Many scraped events arrive untagged.
//
// Uses gpt-4o-mini to read title + description and pick from the fixed taxonomy
// (baby 0-1, toddler 1-3, kids 3-12, tweens 12+). Conservative: tags only the
// ages an event genuinely serves; falls back to ["kids"] when unsure rather than
// over-claiming. Idempotent — only touches events with no AgeTiers.
//
// Usage:
//   node tools/infer-ages.mjs           # infer + write
//   node tools/infer-ages.mjs --dry      # preview only
//
// Env: AIRTABLE_TOKEN, AIRTABLE_BASE_ID, [AIRTABLE_TABLE_NAME=Events], OPENAI_API_KEY
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
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini";
const DRY = process.argv.includes("--dry");

if (!TOKEN || !BASE) { console.error("Missing AIRTABLE_TOKEN / AIRTABLE_BASE_ID"); process.exit(1); }
if (!OPENAI_KEY) { console.error("Missing OPENAI_API_KEY"); process.exit(1); }

const API = "https://api.airtable.com/v0";
const T = encodeURIComponent(TABLE);
const VALID = ["baby", "toddler", "kids", "tweens"];

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

const SYS = `You tag kids' events with the age groups they serve, for a Las Vegas family events site.
Taxonomy (use these exact ids): baby (0-1 yrs), toddler (1-3), kids (3-12), tweens (12+).
Rules:
- Pick ALL that genuinely apply based on the title/description (e.g. "Baby Storytime" -> ["baby","toddler"]; "Teen Coding" -> ["tweens"]; "K-5" -> ["kids"]).
- A general "family"/"all ages" event -> ["toddler","kids"] (the realistic core) unless wording points wider.
- Do NOT over-tag. When genuinely unclear, return ["kids"].
Return STRICT JSON: {"tiers":["..."]} using only the ids above.`;

async function infer(ev) {
  const user = `Title: ${ev.Title}\nDescription: ${(ev.Description || "").slice(0, 500)}`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYS }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const obj = JSON.parse((await res.json()).choices[0].message.content);
  const tiers = [...new Set((obj.tiers || []).filter((t) => VALID.includes(t)))];
  return tiers.length ? tiers : ["kids"];
}

async function patch(id, fields) {
  const r = await fetch(`${API}/${BASE}/${T}/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!r.ok) throw new Error(`Airtable PATCH ${r.status}: ${await r.text()}`);
}

const recs = await allRecords();
const missing = recs.filter((r) => !r.fields.Rejected && !(Array.isArray(r.fields.AgeTiers) && r.fields.AgeTiers.length));
console.log(`${recs.filter(r=>r.fields.Approved).length} approved · ${missing.length} missing age tiers${DRY ? " (DRY RUN)" : ""}\n`);

let done = 0;
for (const r of missing) {
  try {
    const tiers = await infer(r.fields);
    console.log(`• ${(r.fields.Title || "").slice(0, 48).padEnd(50)} → [${tiers.join(", ")}]`);
    if (!DRY) { await patch(r.id, { AgeTiers: tiers }); done++; }
  } catch (e) {
    console.error(`✗ ${r.fields.Title} — ${e.message}`);
  }
}
console.log(DRY ? "\nDry run complete — no writes." : `\nTagged ${done}/${missing.length} events.`);
