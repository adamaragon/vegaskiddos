import { cache } from "react";
import type { KidEvent } from "./types";
import { MOCK_EVENTS } from "./mock-events";
import { NEIGHBORHOODS, type AgeTierId, type PriceTierId, type NeighborhoodId } from "./constants";
import { nextOccurrenceISO, isListedEvent } from "./recurrence";
import type { Lang } from "./i18n";
import { artTemplateSrc, artTypeFor } from "./eventArt";
import { PAGE_REVALIDATE } from "./pageCache";
import { safeHttpUrl } from "./httpUrl";

function byNextOccurrence(a: KidEvent, b: KidEvent) {
  return nextOccurrenceISO(a.start, a.recurrence, a.canceledDates).localeCompare(
    nextOccurrenceISO(b.start, b.recurrence, b.canceledDates)
  );
}

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE_NAME || "Events";

const IMG_CDN = "https://img.vegaskiddos.com";

export function isAirtableConfigured() {
  return Boolean(AIRTABLE_TOKEN && AIRTABLE_BASE);
}

function failClosed(): boolean {
  return process.env.NODE_ENV === "production" && isAirtableConfigured();
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

const KNOWN_HOODS = new Set<string>(NEIGHBORHOODS.map((n) => n.id));

function parseNeighborhood(raw: unknown): NeighborhoodId {
  const id = String(raw || "");
  return KNOWN_HOODS.has(id) ? (id as NeighborhoodId) : "unknown";
}

function mapRecord(rec: AirtableRecord): KidEvent | null {
  const f = rec.fields;
  if (!f.Title || !f.Start) return null;
  const art = artTypeFor(String(f.Title), String(f.Description || ""));
  return {
    id: rec.id,
    title: String(f.Title),
    description: String(f.Description || ""),
    titleEs: f.TitleEs ? String(f.TitleEs) : undefined,
    descriptionEs: f.DescriptionEs ? String(f.DescriptionEs) : undefined,
    venue: String(f.Venue || ""),
    address: String(f.Address || ""),
    neighborhood: parseNeighborhood(f.Neighborhood),
    lat: Number(f.Lat) || 0,
    lng: Number(f.Lng) || 0,
    start: String(f.Start),
    end: f.End ? String(f.End) : undefined,
    ageTiers: (Array.isArray(f.AgeTiers) ? f.AgeTiers : [])
      .map(String)
      .filter(Boolean) as AgeTierId[],
    priceTier: (f.PriceTier as PriceTierId) || "free",
    priceText: f.PriceText ? String(f.PriceText) : undefined,
    url: safeHttpUrl(f.Url ? String(f.Url) : undefined),
    image: `${IMG_CDN}${artTemplateSrc(art.id)}`,
    source: String(f.Source || "Community"),
    indoor: f.Indoor == null ? undefined : Boolean(f.Indoor),
    recurrence: f.Recurrence ? String(f.Recurrence) : undefined,
    canceled: f.Canceled == null ? undefined : Boolean(f.Canceled),
    canceledReason: f.CanceledReason ? String(f.CanceledReason) : undefined,
    canceledDates: f.CanceledDates
      ? String(f.CanceledDates).split(/[\s,]+/).map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
      : undefined,
  };
}

function localize(events: KidEvent[], lang: Lang): KidEvent[] {
  if (lang !== "es") return events;
  return events.map((e) =>
    e.titleEs || e.descriptionEs
      ? { ...e, title: e.titleEs || e.title, description: e.descriptionEs || e.description }
      : e
  );
}

async function fetchAirtableRecords(formula: string): Promise<AirtableRecord[]> {
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
      next: { revalidate: PAGE_REVALIDATE },
    });
    if (!res.ok) throw new Error(`Airtable ${res.status}`);
    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

function toEvents(records: AirtableRecord[], lang: Lang): KidEvent[] {
  return localize(
    records.map(mapRecord).filter((e): e is KidEvent => e !== null).sort(byNextOccurrence),
    lang,
  );
}

function mockEvents(lang: Lang): KidEvent[] {
  return localize([...MOCK_EVENTS].sort(byNextOccurrence), lang);
}

export const getApprovedEvents = cache(async (lang: Lang = "en"): Promise<KidEvent[]> => {
  if (!isAirtableConfigured()) {
    return mockEvents(lang);
  }
  try {
    const records = await fetchAirtableRecords("{Approved}=1");
    const events = toEvents(records, lang);
    if (events.length) return events;
    if (failClosed()) {
      console.error("Airtable returned zero approved events — failing closed");
      return [];
    }
    return mockEvents(lang);
  } catch (err) {
    console.error("Airtable fetch failed:", err);
    if (failClosed()) return [];
    return mockEvents(lang);
  }
});

export const getEvents = cache(async (lang: Lang = "en"): Promise<KidEvent[]> => {
  return (await getApprovedEvents(lang)).filter((e) => isListedEvent(e));
});

const AIRTABLE_ID = /^rec[a-zA-Z0-9]{10,}$/;

export type EventLookup =
  | { kind: "ok"; event: KidEvent }
  | { kind: "gone" }
  | { kind: "missing" };

async function fetchRecordById(id: string): Promise<{ status: number; rec?: AirtableRecord }> {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}/${id}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    next: { revalidate: PAGE_REVALIDATE },
  });
  if (res.status === 404) return { status: 404 };
  if (!res.ok) throw new Error(`Airtable ${res.status}`);
  const rec = (await res.json()) as AirtableRecord;
  return { status: 200, rec };
}

export const lookupEvent = cache(async (id: string, lang: Lang = "en"): Promise<EventLookup> => {
  if (!AIRTABLE_ID.test(id)) return { kind: "missing" };

  if (!isAirtableConfigured()) {
    const event = localize(MOCK_EVENTS, lang).find((e) => e.id === id);
    return event ? { kind: "ok", event } : { kind: "missing" };
  }

  try {
    const { status, rec } = await fetchRecordById(id);
    if (status === 404 || !rec) return { kind: "gone" };
    if (!rec.fields?.Approved) return { kind: "gone" };
    const event = mapRecord(rec);
    if (!event) return { kind: "gone" };
    return { kind: "ok", event: localize([event], lang)[0] };
  } catch (err) {
    console.error("Airtable lookupEvent failed:", err);
    const cached = (await getApprovedEvents(lang)).find((e) => e.id === id);
    if (cached) return { kind: "ok", event: cached };
    return { kind: "missing" };
  }
});

export const getEvent = cache(async (id: string, lang: Lang = "en"): Promise<KidEvent | undefined> => {
  const hit = await lookupEvent(id, lang);
  return hit.kind === "ok" ? hit.event : undefined;
});

export const getEventsByIds = cache(async (ids: string[], lang: Lang = "en"): Promise<KidEvent[]> => {
  const uniq = [...new Set(ids)].filter((id) => AIRTABLE_ID.test(id)).slice(0, 40);
  if (!uniq.length) return [];

  if (!isAirtableConfigured()) {
    const want = new Set(uniq);
    return localize(MOCK_EVENTS.filter((e) => want.has(e.id)), lang);
  }

  const formula = `AND({Approved}=1, OR(${uniq.map((id) => `RECORD_ID()='${id}'`).join(",")}))`;
  try {
    return toEvents(await fetchAirtableRecords(formula), lang);
  } catch (err) {
    console.error("Airtable getEventsByIds failed:", err);
    return [];
  }
});
