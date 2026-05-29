// Generic adapter for any site running "The Events Calendar" (Modern Tribe),
// which exposes /wp-json/tribe/events/v1/events. Used for Vegas Family Guide,
// The UnCommons, and easily extended to other WordPress event calendars.

import type { ScrapedEvent, SourceResult } from "../types";
import {
  classifyAges,
  resolvePrice,
  isKidRelevant,
  nearestNeighborhood,
  neighborhoodFromZip,
  stripHtml,
} from "../classify";

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
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "VegasKiddos/1.0 (+https://vegaskiddos.com)" },
        });
        if (!res.ok) {
          if (res.status === 400) break; // past last page
          errors.push(`page ${page}: HTTP ${res.status}`);
          continue;
        }
        const data = (await res.json()) as { events?: TribeEvent[] };
        const batch = data.events || [];
        if (!batch.length) break;

        for (const e of batch) {
          const title = stripHtml(e.title);
          if (/cancell|postpone|sold out/i.test(title)) continue;
          const desc = stripHtml(e.description || e.excerpt);
          const cats = (e.categories || []).map((c) => c.name);
          const blob = `${title} ${desc} ${cats.join(" ")}`;
          if (!isKidRelevant(blob, cats)) continue;

          const v = e.venue || {};
          const lat = typeof v.geo_lat === "number" ? v.geo_lat : null;
          const lng = typeof v.geo_lng === "number" ? v.geo_lng : null;
          const venueName = stripHtml(v.venue) || "";
          const price = resolvePrice(e.cost, `${title} ${venueName} ${desc}`);
          events.push({
            externalId: e.global_id || e.url || `${opts.source}:${title}:${e.start_date}`,
            title,
            description: desc.slice(0, 600),
            venue: venueName,
            address: [v.address, v.city, v.zip].filter(Boolean).join(", "),
            neighborhood: nearestNeighborhood(lat, lng) ?? neighborhoodFromZip(v.zip),
            lat,
            lng,
            start: toIso(e.start_date)!,
            end: toIso(e.end_date),
            ageTiers: classifyAges(blob),
            priceTier: price.tier,
            priceText: (e.cost ? stripHtml(e.cost) : undefined) || price.text,
            url: e.url,
            image: e.image && typeof e.image === "object" ? e.image.url : undefined,
            source: opts.source,
          });
        }
      } catch (err) {
        errors.push(`page ${page}: ${(err as Error).message}`);
      }
    }
    return { source: opts.source, events, errors };
  };
}
