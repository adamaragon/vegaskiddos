import type { KidEvent } from "./types";
import { MOCK_EVENTS } from "./mock-events";
import type { AgeTierId, PriceTierId, NeighborhoodId } from "./constants";
import { nextOccurrenceISO } from "./recurrence";

// Sort by the next real occurrence (recurring series use their computed next date).
function byNextOccurrence(a: KidEvent, b: KidEvent) {
  return nextOccurrenceISO(a.start, a.recurrence).localeCompare(
    nextOccurrenceISO(b.start, b.recurrence)
  );
}

// Data layer. Reads from Airtable when env vars are present, otherwise falls
// back to the seed data so the app runs with zero configuration.

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE_NAME || "Events";

export function isAirtableConfigured() {
  return Boolean(AIRTABLE_TOKEN && AIRTABLE_BASE);
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

function mapRecord(rec: AirtableRecord): KidEvent | null {
  const f = rec.fields;
  if (!f.Title || !f.Start) return null;
  return {
    id: rec.id,
    title: String(f.Title),
    description: String(f.Description || ""),
    venue: String(f.Venue || ""),
    address: String(f.Address || ""),
    neighborhood: (f.Neighborhood as NeighborhoodId) || "downtown",
    lat: Number(f.Lat) || 0,
    lng: Number(f.Lng) || 0,
    start: String(f.Start),
    end: f.End ? String(f.End) : undefined,
    ageTiers: (Array.isArray(f.AgeTiers) ? f.AgeTiers : [])
      .map(String)
      .filter(Boolean) as AgeTierId[],
    priceTier: (f.PriceTier as PriceTierId) || "free",
    priceText: f.PriceText ? String(f.PriceText) : undefined,
    url: f.Url ? String(f.Url) : undefined,
    image: f.Image ? String(f.Image) : undefined,
    source: String(f.Source || "Community"),
    indoor: Boolean(f.Indoor),
    recurrence: f.Recurrence ? String(f.Recurrence) : undefined,
  };
}

export async function getEvents(): Promise<KidEvent[]> {
  if (!isAirtableConfigured()) {
    return [...MOCK_EVENTS].sort(byNextOccurrence);
  }
  try {
    // Approved events that are either upcoming OR recurring (recurring series
    // never expire — their next occurrence is computed for display).
    const formula =
      "AND({Approved}=1, OR(NOT({Recurrence}=BLANK()), IS_AFTER({Start}, DATEADD(NOW(),-1,'days'))))";
    const records: AirtableRecord[] = [];
    let offset: string | undefined;
    do {
      const url = new URL(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}`
      );
      url.searchParams.set("filterByFormula", formula);
      url.searchParams.set("pageSize", "100");
      if (offset) url.searchParams.set("offset", offset);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
        next: { revalidate: 600 },
      });
      if (!res.ok) throw new Error(`Airtable ${res.status}`);
      const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
      records.push(...data.records);
      offset = data.offset;
    } while (offset);
    const events = records
      .map(mapRecord)
      .filter((e): e is KidEvent => e !== null)
      .sort(byNextOccurrence);
    return events.length ? events : MOCK_EVENTS;
  } catch (err) {
    console.error("Airtable fetch failed, using seed data:", err);
    return [...MOCK_EVENTS].sort(byNextOccurrence);
  }
}

export async function getEvent(id: string): Promise<KidEvent | undefined> {
  const events = await getEvents();
  return events.find((e) => e.id === id);
}
