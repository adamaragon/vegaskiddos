// EN→ES translation for event content, stored back into Airtable as
// TitleEs / DescriptionEs. Used by the one-time backfill (tools/translate-
// backfill.mjs) and by the scraper (tools/gov-scrape.mjs) for new events.
//
// Translation runs through OpenAI (gpt-4o-mini, cheap + good for short copy).
// Everything is idempotent: only rows missing TitleEs are translated, so it's
// safe to re-run as often as you like.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_TRANSLATE_MODEL || "gpt-4o-mini";
const API = "https://api.airtable.com/v0";

const SYS = [
  "You are a professional translator localizing a Las Vegas children's-events",
  "website for Spanish-speaking parents. Translate each event's title and",
  "description from English into natural, warm, parent-friendly Latin American",
  "Spanish. Rules:",
  "- Keep proper nouns unchanged: venue names, brand names, library/park names,",
  "  city/neighborhood names, and people's names.",
  "- Keep numbers, ages, prices ($), dates, times, and URLs exactly as written.",
  "- Preserve line breaks and any ••• bullet separators.",
  "- Do not add notes, quotes, or commentary.",
  'Respond ONLY as JSON: {"items":[{"titleEs":"…","descriptionEs":"…"}]} in the',
  "exact same order as the input items.",
].join(" ");

// Translate a batch of {title, description} → [{titleEs, descriptionEs}].
export async function translateBatch(items, apiKey) {
  if (!items.length) return [];
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: JSON.stringify({ items: items.map((i) => ({ title: i.title || "", description: i.description || "" })) }) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  return Array.isArray(parsed.items) ? parsed.items : [];
}

// Ensure the TitleEs / DescriptionEs columns exist. Tries the Airtable Meta
// API; if the token lacks schema scope, returns false so the caller can warn.
async function ensureEsFields({ token, base, table }) {
  const metaRes = await fetch(`${API}/meta/bases/${base}/tables`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) return false; // no schema read scope — assume fields exist
  const { tables } = await metaRes.json();
  const t = tables.find((x) => x.name === table || x.id === table);
  if (!t) return false;
  const have = new Set(t.fields.map((f) => f.name));
  for (const name of ["TitleEs", "DescriptionEs"]) {
    if (have.has(name)) continue;
    const res = await fetch(`${API}/meta/bases/${base}/tables/${t.id}/fields`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: "multilineText" }),
    });
    if (!res.ok) return false; // no schema write scope
  }
  return true;
}

// Backfill Spanish translations for any displayed (non-rejected) events that
// don't have a TitleEs yet. Returns the number of records translated.
export async function backfillTranslations({ apiKey, token, base, table, batchSize = 12, log = () => {} }) {
  if (!apiKey) { log("⏭  No OPENAI_API_KEY — skipping translation."); return 0; }

  const fieldsOk = await ensureEsFields({ token, base, table });
  if (fieldsOk === false) {
    log("ℹ️  Could not verify/create TitleEs & DescriptionEs columns via the Meta API.");
    log("   If the next step errors with UNKNOWN_FIELD_NAME, add two 'Long text'");
    log("   fields named TitleEs and DescriptionEs to the Events table, then re-run.");
  }

  // Pull every non-rejected row missing a Spanish title.
  const formula = "AND({TitleEs}=BLANK(), NOT({Title}=BLANK()), NOT({Rejected}=1))";
  const recs = [];
  let offset;
  do {
    const url = new URL(`${API}/${base}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("filterByFormula", formula);
    ["Title", "Description"].forEach((f) => url.searchParams.append("fields[]", f));
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Airtable list ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    recs.push(...data.records);
    offset = data.offset;
  } while (offset);

  if (!recs.length) { log("✅ All events already translated."); return 0; }
  log(`🌐 Translating ${recs.length} event(s) to Spanish…`);

  let done = 0;
  for (let i = 0; i < recs.length; i += batchSize) {
    const slice = recs.slice(i, i + batchSize);
    const items = slice.map((r) => ({ title: String(r.fields.Title || ""), description: String(r.fields.Description || "") }));
    let out;
    try {
      out = await translateBatch(items, apiKey);
    } catch (err) {
      log(`   ⚠️  Batch ${i / batchSize + 1} failed: ${err.message}`);
      continue;
    }
    const updates = slice.map((r, j) => ({
      id: r.id,
      fields: {
        TitleEs: out[j]?.titleEs || String(r.fields.Title || ""),
        DescriptionEs: out[j]?.descriptionEs || String(r.fields.Description || ""),
      },
    }));
    const patch = await fetch(`${API}/${base}/${encodeURIComponent(table)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: updates }),
    });
    if (!patch.ok) throw new Error(`Airtable patch ${patch.status}: ${(await patch.text()).slice(0, 300)}`);
    done += updates.length;
    log(`   …${done}/${recs.length}`);
  }
  log(`✅ Translated ${done} event(s) to Spanish.`);
  return done;
}
