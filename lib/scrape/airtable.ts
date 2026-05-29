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
