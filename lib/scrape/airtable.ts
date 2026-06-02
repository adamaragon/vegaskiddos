import type { ScrapedEvent } from "./types";
import { hasSubstantialDescription } from "./description";

const API = "https://api.airtable.com/v0";

function cfg() {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || "Events";
  if (!token || !base) throw new Error("AIRTABLE_TOKEN/AIRTABLE_BASE_ID not set");
  return { token, base, table };
}

// Content fields only — deliberately omits Approved/Rejected so upserts NEVER
// change a human's review decision. New records get no Approved (= pending);
// existing records keep whatever the admin set.
function toFields(e: ScrapedEvent) {
  const f: Record<string, unknown> = {
    Title: e.title,
    Venue: e.venue,
    Address: e.address,
    Start: e.start,
    AgeTiers: e.ageTiers,
    Source: e.source,
    ExternalId: e.externalId,
    ScrapedAt: new Date().toISOString(),
  };
  // Omit empty/short descriptions so daily upserts don't wipe AI-filled text.
  if (hasSubstantialDescription(e.description)) f.Description = e.description;
  if (e.neighborhood) f.Neighborhood = e.neighborhood;
  if (e.end) f.End = e.end;
  if (e.priceTier) f.PriceTier = e.priceTier;
  if (e.priceText) f.PriceText = e.priceText;
  if (e.url) f.Url = e.url;
  if (e.image) f.Image = e.image;
  if (e.recurrence) f.Recurrence = e.recurrence;
  if (typeof e.lat === "number") f.Lat = e.lat;
  if (typeof e.lng === "number") f.Lng = e.lng;
  return f;
}

const normKey = (t: unknown, v: unknown) =>
  `${String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()}`;

// Publish newly-scraped events without ever touching already-approved ones.
//
// CONTRACT: this only ever READS approved events and only ever WRITES pending
// ones. An event a human (or a prior run) approved is immutable here — it never
// gets un-approved or dropped by the daily scrape. Dedup is applied to NEW events
// only: a pending event that duplicates an existing approved event (same
// title+venue) is rejected rather than published, so we never create a visible
// duplicate, and we never demote the established copy. Among brand-new pending
// dupes, the best record (recurring series > has image > richest) wins.
//
// Returns counts of what was approved vs. rejected-as-duplicate this run.
export async function publishPending(): Promise<{ approved: number; rejected: number }> {
  const { token, base, table } = cfg();
  type Rec = { id: string; fields: Record<string, unknown> };

  const page = async (formula: string, fields: string[]): Promise<Rec[]> => {
    const out: Rec[] = [];
    let offset: string | undefined;
    do {
      const url = new URL(`${API}/${base}/${encodeURIComponent(table)}`);
      url.searchParams.set("pageSize", "100");
      url.searchParams.set("filterByFormula", formula);
      fields.forEach((f) => url.searchParams.append("fields[]", f));
      if (offset) url.searchParams.set("offset", offset);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Airtable ${res.status}`);
      const data = (await res.json()) as { records: Rec[]; offset?: string };
      out.push(...data.records);
      offset = data.offset;
    } while (offset);
    return out;
  };

  // The protected set: keys we must NOT duplicate or disturb. Read-only.
  const approved = await page("{Approved}=1", ["Title", "Venue"]);
  const protectedKeys = new Set(approved.map((r) => normKey(r.fields.Title, r.fields.Venue)));

  const pending = await page(
    "AND(NOT({Approved}), NOT({Rejected}))",
    ["Title", "Venue", "ExternalId", "Image", "Description"]
  );

  const score = (r: Rec) =>
    (String(r.fields.ExternalId || "").startsWith("series:") ? 100 : 0) +
    (r.fields.Image ? 10 : 0) +
    Math.min(5, String(r.fields.Description || "").length / 100);

  const approveIds: string[] = [];
  const rejectIds: string[] = [];
  const bestNewByKey = new Map<string, Rec>();

  for (const r of pending) {
    const k = normKey(r.fields.Title, r.fields.Venue);
    if (protectedKeys.has(k)) {
      // Duplicates an already-approved event → drop the newcomer, keep theirs.
      rejectIds.push(r.id);
      continue;
    }
    const cur = bestNewByKey.get(k);
    if (!cur) {
      bestNewByKey.set(k, r);
    } else if (score(r) > score(cur)) {
      rejectIds.push(cur.id);
      bestNewByKey.set(k, r);
    } else {
      rejectIds.push(r.id);
    }
  }
  for (const r of bestNewByKey.values()) approveIds.push(r.id);

  const patch = async (ids: string[], fields: Record<string, unknown>) => {
    for (let i = 0; i < ids.length; i += 10) {
      await fetch(`${API}/${base}/${encodeURIComponent(table)}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ records: ids.slice(i, i + 10).map((id) => ({ id, fields })) }),
      });
    }
  };
  await patch(approveIds, { Approved: true });
  await patch(rejectIds, { Rejected: true });
  return { approved: approveIds.length, rejected: rejectIds.length };
}

// Upsert by ExternalId: creates new (pending) events, refreshes existing ones'
// content (incl. the next date for recurring series) without touching approval.
export async function upsertEvents(
  events: ScrapedEvent[]
): Promise<{ created: number; updated: number }> {
  const { token, base, table } = cfg();
  let created = 0;
  let updated = 0;
  for (let i = 0; i < events.length; i += 10) {
    const batch = events.slice(i, i + 10).map((e) => ({ fields: toFields(e) }));
    const res = await fetch(`${API}/${base}/${encodeURIComponent(table)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: ["ExternalId"] },
        records: batch,
        typecast: true,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable upsert ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      createdRecords?: string[];
      updatedRecords?: string[];
    };
    created += (data.createdRecords || []).length;
    updated += (data.updatedRecords || []).length;
  }
  return { created, updated };
}
