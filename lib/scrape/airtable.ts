import type { ScrapedEvent } from "./types";

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
    Description: e.description,
    Venue: e.venue,
    Address: e.address,
    Start: e.start,
    AgeTiers: e.ageTiers,
    Source: e.source,
    ExternalId: e.externalId,
    ScrapedAt: new Date().toISOString(),
  };
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

// Self-healing dedup: among APPROVED events, collapse same title+venue dupes
// (the same event listed by multiple sources, or a one-time left behind when it
// became a recurring series). Keeps the best record (recurring series > has
// image > richest) and soft-rejects the rest. Runs after each scrape.
export async function dedupeApprovedEvents(): Promise<number> {
  const { token, base, table } = cfg();
  const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const recs: { id: string; fields: Record<string, unknown> }[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`${API}/${base}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("filterByFormula", "{Approved}=1");
    ["Title", "Venue", "Recurrence", "Image", "Description", "ExternalId"].forEach((f) =>
      url.searchParams.append("fields[]", f)
    );
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return 0;
    const data = (await res.json()) as { records: typeof recs; offset?: string };
    recs.push(...data.records);
    offset = data.offset;
  } while (offset);

  const score = (r: (typeof recs)[number]) => {
    const f = r.fields;
    return (String(f.ExternalId || "").startsWith("series:") ? 100 : 0) +
      (f.Image ? 10 : 0) + Math.min(5, String(f.Description || "").length / 100);
  };
  const groups = new Map<string, typeof recs>();
  for (const r of recs) {
    const k = `${norm(String(r.fields.Title))}|${norm(String(r.fields.Venue))}`;
    (groups.get(k) || groups.set(k, []).get(k)!).push(r);
  }
  const reject: string[] = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => score(b) - score(a));
    reject.push(...g.slice(1).map((r) => r.id));
  }
  for (let i = 0; i < reject.length; i += 10) {
    await fetch(`${API}/${base}/${encodeURIComponent(table)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: reject.slice(i, i + 10).map((id) => ({ id, fields: { Approved: false, Rejected: true } })) }),
    });
  }
  return reject.length;
}

// Auto-approve every pending event that hasn't been explicitly rejected. Lets
// the daily scrape publish straight to the public site so nothing sits in a
// queue waiting on a manual click. Skips Rejected=true records (dedupe losers,
// hand-rejected events) so they never come back. The isKidRelevant filter
// already removed adult/civic content before insert; dedupe runs after this to
// collapse any cross-source dups that just got approved.
export async function approveAllPending(): Promise<number> {
  const { token, base, table } = cfg();
  const ids: string[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`${API}/${base}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("filterByFormula", "AND(NOT({Approved}), NOT({Rejected}))");
    url.searchParams.append("fields[]", "ExternalId");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return 0;
    const data = (await res.json()) as { records: { id: string }[]; offset?: string };
    ids.push(...data.records.map((r) => r.id));
    offset = data.offset;
  } while (offset);
  for (let i = 0; i < ids.length; i += 10) {
    await fetch(`${API}/${base}/${encodeURIComponent(table)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: ids.slice(i, i + 10).map((id) => ({ id, fields: { Approved: true } })) }),
    });
  }
  return ids.length;
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
