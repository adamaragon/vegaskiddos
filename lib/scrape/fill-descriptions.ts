import { DESCRIPTION_MIN_LEN } from "./description";

const API = "https://api.airtable.com/v0";

const SYS = `You write short, warm, factual blurbs for a Las Vegas family events website (Vegas Kiddos).
Given only an event's title, venue, city and date, write a 2-3 sentence description a parent would find helpful.
RULES:
- Use ONLY the facts given. NEVER invent prices, exact times, ages, schedules, performers, or details you weren't told.
- Keep it general where unsure (e.g. "a family-friendly farmers market" rather than fabricated specifics).
- Warm and inviting but not hype-y. No emojis. No "click here". Don't restate the date/time.
- Mention the venue/area naturally when given.
Return STRICT JSON: {"en":"<english>","es":"<spanish translation, same meaning>"}`;

export interface FillDescriptionsResult {
  scanned: number;
  blanks: number;
  filled: number;
  errors: string[];
}

export interface FillDescriptionsOpts {
  dryRun?: boolean;
  limit?: number;
  log?: (msg: string) => void;
}

type AirtableRec = { id: string; fields: Record<string, unknown> };

function cfg() {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || "Events";
  const openaiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini";
  if (!token || !base) throw new Error("AIRTABLE_TOKEN/AIRTABLE_BASE_ID not set");
  return { token, base, table, openaiKey, model };
}

async function allRecords(token: string, base: string, table: string): Promise<AirtableRec[]> {
  const t = encodeURIComponent(table);
  let recs: AirtableRec[] = [];
  let offset: string | undefined;
  do {
    const u = new URL(`${API}/${base}/${t}`);
    u.searchParams.set("pageSize", "100");
    if (offset) u.searchParams.set("offset", offset);
    const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Airtable ${r.status}: ${await r.text()}`);
    const j = (await r.json()) as { records: AirtableRec[]; offset?: string };
    recs = recs.concat(j.records);
    offset = j.offset;
  } while (offset);
  return recs;
}

async function generate(
  ev: Record<string, unknown>,
  openaiKey: string,
  model: string
): Promise<{ en: string; es: string }> {
  const facts = [
    `Title: ${ev.Title}`,
    ev.Venue && `Venue: ${ev.Venue}`,
    `City: Henderson / Las Vegas area, Nevada`,
    ev.Start && `Date: ${new Date(String(ev.Start)).toDateString()}`,
  ]
    .filter(Boolean)
    .join("\n");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYS }, { role: "user", content: facts }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { choices: { message: { content: string } }[] };
  const obj = JSON.parse(j.choices[0].message.content) as { en?: string; es?: string };
  return { en: String(obj.en || "").trim(), es: String(obj.es || "").trim() };
}

async function patch(
  token: string,
  base: string,
  table: string,
  id: string,
  fields: Record<string, unknown>
) {
  const t = encodeURIComponent(table);
  const res = await fetch(`${API}/${base}/${t}/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) throw new Error(`Airtable PATCH ${res.status}: ${await res.text()}`);
}

function isBlank(fields: Record<string, unknown>): boolean {
  return !fields.Rejected && String(fields.Description || "").trim().length < DESCRIPTION_MIN_LEN;
}

/** Generate grounded bilingual descriptions for events missing body text. */
export async function fillBlankDescriptions(opts?: FillDescriptionsOpts): Promise<FillDescriptionsResult> {
  const { token, base, table, openaiKey, model } = cfg();
  const dryRun = opts?.dryRun ?? false;
  const log = opts?.log ?? (() => {});

  if (!openaiKey) {
    log("fill-descriptions: skipped (no OPENAI_API_KEY)");
    return { scanned: 0, blanks: 0, filled: 0, errors: [] };
  }

  const recs = await allRecords(token, base, table);
  const allBlanks = recs.filter((r) => isBlank(r.fields));
  let blanks = allBlanks;
  if (opts?.limit != null && opts.limit > 0) blanks = blanks.slice(0, opts.limit);

  const errors: string[] = [];
  let filled = 0;

  for (const r of blanks) {
    const ev = r.fields;
    const title = String(ev.Title || "(untitled)");
    try {
      const { en, es } = await generate(ev, openaiKey, model);
      if (!en) {
        log(`fill-descriptions: skip ${title} (empty generation)`);
        continue;
      }
      if (!dryRun) {
        const fields: Record<string, unknown> = { Description: en };
        if (es) fields.DescriptionEs = es;
        await patch(token, base, table, r.id, fields);
        filled++;
      }
    } catch (e) {
      const msg = `${title}: ${(e as Error).message}`;
      errors.push(msg);
      log(`fill-descriptions: error ${msg}`);
    }
  }

  return { scanned: recs.length, blanks: allBlanks.length, filled, errors };
}
