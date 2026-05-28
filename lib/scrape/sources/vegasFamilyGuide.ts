// Source adapter: Vegas Family Guide (vegasfamilyevents.com) — a curated Las
// Vegas family events calendar built on The Events Calendar (WordPress), which
// exposes a public REST API. We pull upcoming events as review-queue leads,
// always linking back to the source for attribution.

import type { ScrapedEvent, SourceResult } from "../types";
import {
  classifyAges,
  classifyPrice,
  isKidRelevant,
  nearestNeighborhood,
  neighborhoodFromZip,
  stripHtml,
} from "../classify";

const SOURCE = "Vegas Family Guide";
const API = "https://vegasfamilyevents.com/wp-json/tribe/events/v1/events";

interface TribeEvent {
  global_id: string;
  title: string;
  description?: string;
  excerpt?: string;
  start_date: string; // "YYYY-MM-DD HH:MM:SS" (local)
  end_date?: string;
  utc_start_date?: string;
  utc_end_date?: string;
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

// Tribe local datetimes have no zone; Las Vegas is the implied zone.
function toIso(local?: string): string | undefined {
  if (!local) return undefined;
  const t = local.replace(" ", "T");
  // Late-May→Sept is PDT (-07:00); good enough for review-queue leads.
  return `${t}-07:00`;
}

export async function fetchVegasFamilyGuide(opts?: {
  pages?: number;
  perPage?: number;
}): Promise<SourceResult> {
  const pages = opts?.pages ?? 4;
  const perPage = opts?.perPage ?? 50;
  const errors: string[] = [];
  const events: ScrapedEvent[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (let page = 1; page <= pages; page++) {
    const url = `${API}?per_page=${perPage}&page=${page}&start_date=${today}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "VegasKiddos/1.0 (+https://vegaskiddos.com)" },
      });
      if (!res.ok) {
        if (res.status === 400) break; // ran past the last page
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
        const neighborhood =
          nearestNeighborhood(lat, lng) ?? neighborhoodFromZip(v.zip);

        events.push({
          externalId: e.global_id || e.url || `${SOURCE}:${e.title}:${e.start_date}`,
          title,
          description: desc.slice(0, 600),
          venue: stripHtml(v.venue) || "",
          address: [v.address, v.city, v.zip].filter(Boolean).join(", "),
          neighborhood,
          lat,
          lng,
          start: toIso(e.start_date)!,
          end: toIso(e.end_date),
          ageTiers: classifyAges(blob),
          priceTier: classifyPrice(e.cost, blob),
          priceText: e.cost ? stripHtml(e.cost) : undefined,
          url: e.url,
          image: e.image && typeof e.image === "object" ? e.image.url : undefined,
          source: SOURCE,
        });
      }
    } catch (err) {
      errors.push(`page ${page}: ${(err as Error).message}`);
    }
  }

  return { source: SOURCE, events, errors };
}
