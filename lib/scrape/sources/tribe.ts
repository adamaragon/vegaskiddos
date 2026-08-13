// Generic adapter for any site running "The Events Calendar" (Modern Tribe),
// which exposes /wp-json/tribe/events/v1/events. Used for Vegas Family Guide,
// The UnCommons, and easily extended to other WordPress event calendars.
//
// REST is intermittently WAF'd (HTML challenge instead of JSON). Those same
// sites expose `/?post_type=tribe_events&ical=1` which still 200s. ICS UIDs
// don't match REST global_ids, so a fallback run sets skipSweep.

import type { ScrapedEvent, SourceResult } from "../types";
import {
  classifyAges,
  resolvePrice,
  isKidRelevant,
  nearestNeighborhood,
  neighborhoodFromZip,
  stripHtml,
} from "../classify";
import { fetchJsonRetry, fetchTextRetry } from "../http";
import { parseIcal, unescapeIcal, icalToIso } from "../ical";

const UA =
  "Mozilla/5.0 (compatible; VegasKiddos/1.0; +https://vegaskiddos.com)";

interface TribeEvent {
  global_id: string;
  title: string;
  description?: string;
  excerpt?: string;
  start_date: string;
  end_date?: string;
  cost?: string;
  url?: string;
  image?: { url?: string } | false;
  venue?: {
    venue?: string;
    address?: string;
    city?: string;
    zip?: string;
    geo_lat?: number;
    geo_lng?: number;
  };
  categories?: { name: string }[];
  tags?: { name: string }[];
}

function toIso(local?: string): string | undefined {
  if (!local) return undefined;
  return `${local.replace(" ", "T")}-07:00`; // Tribe local datetimes; LV is the implied zone
}

function fromTribeEvent(e: TribeEvent, source: string): ScrapedEvent | null {
  const title = stripHtml(e.title);
  if (/cancell|postpone|sold out/i.test(title)) return null;
  const desc = stripHtml(e.description || e.excerpt);
  const cats = (e.categories || []).map((c) => c.name);
  const blob = `${title} ${desc} ${cats.join(" ")}`;
  if (!isKidRelevant(blob, cats)) return null;

  const v = e.venue || {};
  const lat = typeof v.geo_lat === "number" ? v.geo_lat : null;
  const lng = typeof v.geo_lng === "number" ? v.geo_lng : null;
  const venueName = stripHtml(v.venue) || "";
  const price = resolvePrice(e.cost, `${title} ${venueName} ${desc}`);
  const start = toIso(e.start_date);
  if (!start) return null;
  return {
    externalId: e.global_id || e.url || `${source}:${title}:${e.start_date}`,
    title,
    description: desc.slice(0, 600),
    venue: venueName,
    address: [v.address, v.city, v.zip].filter(Boolean).join(", "),
    neighborhood: nearestNeighborhood(lat, lng) ?? neighborhoodFromZip(v.zip),
    lat,
    lng,
    start,
    end: toIso(e.end_date),
    ageTiers: classifyAges(blob),
    priceTier: price.tier,
    priceText: (e.cost ? stripHtml(e.cost) : undefined) || price.text,
    url: e.url,
    image: e.image && typeof e.image === "object" ? e.image.url : undefined,
    source,
  };
}

function fromIcalEvent(ve: Record<string, string>, source: string): ScrapedEvent | null {
  const title = unescapeIcal(ve.SUMMARY || "");
  if (!title || /cancell|postpone|sold out/i.test(title)) return null;
  const desc = unescapeIcal(ve.DESCRIPTION || "");
  const cats = (ve.CATEGORIES || "").split(",").map((c) => c.trim()).filter(Boolean);
  const blob = `${title} ${desc} ${cats.join(" ")}`;
  if (!isKidRelevant(blob, cats)) return null;
  const start = icalToIso(ve.DTSTART || "");
  if (!start) return null;
  const loc = unescapeIcal(ve.LOCATION || "");
  const locParts = loc.split(",").map((s) => s.trim()).filter(Boolean);
  const venueName = locParts[0] || "";
  const address = locParts.slice(1).join(", ");
  const zip = loc.match(/\b(89\d{3})\b/)?.[1];
  const price = resolvePrice(null, `${title} ${venueName} ${desc}`);
  return {
    externalId: ve.UID || ve.URL || `${source}:${title}:${start}`,
    title,
    description: desc.slice(0, 600),
    venue: venueName,
    address,
    neighborhood: neighborhoodFromZip(zip),
    lat: null,
    lng: null,
    start,
    end: icalToIso(ve.DTEND || ""),
    ageTiers: classifyAges(blob),
    priceTier: price.tier,
    priceText: price.text,
    url: ve.URL,
    source,
  };
}

async function fetchIcalFallback(apiBase: string, source: string): Promise<ScrapedEvent[]> {
  const origin = new URL(apiBase).origin;
  const url = `${origin}/?post_type=tribe_events&ical=1&eventDisplay=list`;
  const ics = await fetchTextRetry(
    url,
    { headers: { "User-Agent": UA, Accept: "text/calendar,*/*" } },
    { retries: 2, accept: /BEGIN:VCALENDAR/ },
  );
  const out: ScrapedEvent[] = [];
  for (const ve of parseIcal(ics)) {
    const e = fromIcalEvent(ve, source);
    if (e) out.push(e);
  }
  return out;
}

export function makeTribeAdapter(opts: {
  source: string;
  apiBase: string; // e.g. "https://uncommons.com/wp-json/tribe/events/v1/events"
  pages?: number;
  perPage?: number;
}) {
  return async function fetchTribe(): Promise<SourceResult> {
    const pages = opts.pages ?? 4;
    const perPage = opts.perPage ?? 50;
    const errors: string[] = [];
    const events: ScrapedEvent[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (let page = 1; page <= pages; page++) {
      const url = `${opts.apiBase}?per_page=${perPage}&page=${page}&start_date=${today}`;
      let data: { events?: TribeEvent[] } | "PAST_END";
      try {
        data = await fetchJsonRetry<{ events?: TribeEvent[] }>(
          url,
          { headers: { "User-Agent": UA } },
          { retries: 3, pastEndStatus: 400 },
        );
      } catch (err) {
        errors.push(`page ${page}: ${(err as Error).message}`);
        continue;
      }
      if (data === "PAST_END") break;
      const batch = data.events || [];
      if (!batch.length) break;

      for (const e of batch) {
        const mapped = fromTribeEvent(e, opts.source);
        if (mapped) events.push(mapped);
      }
    }

    let skipSweep = false;
    if (!events.length) {
      try {
        const ical = await fetchIcalFallback(opts.apiBase, opts.source);
        if (ical.length) {
          events.push(...ical);
          skipSweep = true;
          errors.length = 0;
        }
      } catch (err) {
        errors.push(`ical fallback: ${(err as Error).message}`);
      }
    }
    return { source: opts.source, events, errors, skipSweep };
  };
}
