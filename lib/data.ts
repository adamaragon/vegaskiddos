import type { KidEvent } from "./types";
import { MOCK_EVENTS } from "./mock-events";
import type { AgeTierId, PriceTierId, NeighborhoodId } from "./constants";

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
  };
}

export async function getEvents(): Promise<KidEvent[]> {
  if (!isAirtableConfigured()) {
    return [...MOCK_EVENTS].sort((a, b) => a.start.localeCompare(b.start));
  }
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(
      AIRTABLE_TABLE
    )}?filterByFormula=${encodeURIComponent("{Approved}=1")}&pageSize=100`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
      next: { revalidate: 600 },
    });
    if (!res.ok) throw new Error(`Airtable ${res.status}`);
    const data = (await res.json()) as { records: AirtableRecord[] };
    const events = data.records
      .map(mapRecord)
      .filter((e): e is KidEvent => e !== null)
      .sort((a, b) => a.start.localeCompare(b.start));
    return events.length ? events : MOCK_EVENTS;
  } catch (err) {
    console.error("Airtable fetch failed, using seed data:", err);
    return [...MOCK_EVENTS].sort((a, b) => a.start.localeCompare(b.start));
  }
}

export async function getEvent(id: string): Promise<KidEvent | undefined> {
  const events = await getEvents();
  return events.find((e) => e.id === id);
}
