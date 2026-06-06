import { cache } from "react";
import type { KidEvent } from "./types";
import { MOCK_EVENTS } from "./mock-events";
import type { AgeTierId, PriceTierId, NeighborhoodId } from "./constants";
import { nextOccurrenceISO } from "./recurrence";
import type { Lang } from "./i18n";

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

// Durable image host. Event images are synced (tools/sync-images.mjs) to the R2
// bucket served here as /event/<id>/<width>.webp, so the app references stable
// URLs instead of Airtable's ephemeral signed URLs (which expire ~2h and break
// in cached HTML). 1024 is the default/OG size; lib/imageLoader.ts swaps the
// width segment per responsive <Image> request.
const IMG_CDN = "https://img.vegaskiddos.com";

export function isAirtableConfigured() {
  return Boolean(AIRTABLE_TOKEN && AIRTABLE_BASE);
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

// First URL out of an Airtable attachment field ([{ url }, ...]).
function attachmentUrl(v: unknown): string | undefined {
  if (Array.isArray(v) && v[0] && typeof v[0] === "object" && "url" in (v[0] as object)) {
    return String((v[0] as { url?: unknown }).url || "") || undefined;
  }
  return undefined;
}

function mapRecord(rec: AirtableRecord): KidEvent | null {
  const f = rec.fields;
  if (!f.Title || !f.Start) return null;
  return {
    id: rec.id,
    title: String(f.Title),
    description: String(f.Description || ""),
    titleEs: f.TitleEs ? String(f.TitleEs) : undefined,
    descriptionEs: f.DescriptionEs ? String(f.DescriptionEs) : undefined,
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
    // Reference the durable R2 copy (synced from ArtImage attachment or the
    // scraped Image URL) so cached HTML never holds an expiring Airtable URL.
    image:
      attachmentUrl((f as Record<string, unknown>).ArtImage) || f.Image
        ? `${IMG_CDN}/event/${rec.id}/1024.webp`
        : undefined,
    source: String(f.Source || "Community"),
    // Preserve "unknown" — coercing a missing Indoor field to false would
    // mislabel every unflagged event as outdoor (e.g. library storytimes).
    indoor: f.Indoor == null ? undefined : Boolean(f.Indoor),
    recurrence: f.Recurrence ? String(f.Recurrence) : undefined,
  };
}

// When rendering in Spanish, swap in the stored translation (falling back to
// the source text if a given event hasn't been translated yet).
function localize(events: KidEvent[], lang: Lang): KidEvent[] {
  if (lang !== "es") return events;
  return events.map((e) =>
    e.titleEs || e.descriptionEs
      ? { ...e, title: e.titleEs || e.title, description: e.descriptionEs || e.description }
      : e
  );
}

// Wrapped in React cache() so multiple calls in one request (e.g. an event
// page's generateMetadata + render, or the homepage's strip + browser) share a
// single fetch + parse. Cross-request data is already cached via revalidate:3600.
export const getEvents = cache(async (lang: Lang = "en"): Promise<KidEvent[]> => {
  if (!isAirtableConfigured()) {
    return localize([...MOCK_EVENTS].sort(byNextOccurrence), lang);
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
        next: { revalidate: 3600 },
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
    return localize(events.length ? events : MOCK_EVENTS, lang);
  } catch (err) {
    console.error("Airtable fetch failed, using seed data:", err);
    return localize([...MOCK_EVENTS].sort(byNextOccurrence), lang);
  }
});

export async function getEvent(id: string, lang: Lang = "en"): Promise<KidEvent | undefined> {
  const events = await getEvents(lang);
  return events.find((e) => e.id === id);
}
