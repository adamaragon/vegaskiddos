import type { ScrapedEvent } from "./types";

const API = "https://api.airtable.com/v0";

function cfg() {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || "Events";
  if (!token || !base) throw new Error("AIRTABLE_TOKEN/AIRTABLE_BASE_ID not set");
  return { token, base, table };
}

// Pull every existing ExternalId so we never insert a duplicate.
export async function existingExternalIds(): Promise<Set<string>> {
  const { token, base, table } = cfg();
  const ids = new Set<string>();
  let offset: string | undefined;
  do {
    const url = new URL(`${API}/${base}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.append("fields[]", "ExternalId");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Airtable list ${res.status}`);
    const data = (await res.json()) as {
      records: { fields: { ExternalId?: string } }[];
      offset?: string;
    };
    for (const r of data.records) {
      if (r.fields.ExternalId) ids.add(r.fields.ExternalId);
    }
    offset = data.offset;
  } while (offset);
  return ids;
}

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
    Approved: false, // review queue — never auto-publish scraped events
  };
  if (e.neighborhood) f.Neighborhood = e.neighborhood;
  if (e.end) f.End = e.end;
  if (e.priceTier) f.PriceTier = e.priceTier;
  if (e.priceText) f.PriceText = e.priceText;
  if (e.url) f.Url = e.url;
  if (e.image) f.Image = e.image;
  if (typeof e.lat === "number") f.Lat = e.lat;
  if (typeof e.lng === "number") f.Lng = e.lng;
  return f;
}

// Create new records in batches of 10 (Airtable limit). typecast lets select
// options be created on the fly if needed.
export async function insertEvents(events: ScrapedEvent[]): Promise<number> {
  const { token, base, table } = cfg();
  let created = 0;
  for (let i = 0; i < events.length; i += 10) {
    const batch = events.slice(i, i + 10).map((e) => ({ fields: toFields(e) }));
    const res = await fetch(`${API}/${base}/${encodeURIComponent(table)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ records: batch, typecast: true }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable insert ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as { records: unknown[] };
    created += data.records.length;
  }
  return created;
}
