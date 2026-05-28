// Source adapter: Nevada Moms (nvmoms.com) — a daily-updated Southern Nevada
// family calendar on the Modern Events Calendar plugin, which exposes a rich
// RSS feed with namespaced mec:* fields. We filter to Southern Nevada and pull
// upcoming events as review-queue leads.

import type { ScrapedEvent, SourceResult } from "../types";
import {
  classifyAges,
  classifyPrice,
  passesAdultFilter,
  neighborhoodFromZip,
  stripHtml,
} from "../classify";

const SOURCE = "Nevada Moms";
const FEED = "https://nvmoms.com/events/feed/";

function field(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
}

// "10:00 am" | "All Day" | "" -> "HH:MM"
function to24h(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s || s === "all day") return "09:00";
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return "09:00";
  let h = parseInt(m[1], 10);
  const min = m[2] || "00";
  if (m[3] === "pm" && h !== 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

export async function fetchNevadaMoms(): Promise<SourceResult> {
  const errors: string[] = [];
  const events: ScrapedEvent[] = [];
  const today = new Date().toISOString().slice(0, 10);

  try {
    const res = await fetch(FEED, {
      headers: { "User-Agent": "VegasKiddos/1.0 (+https://vegaskiddos.com)" },
    });
    if (!res.ok) return { source: SOURCE, events, errors: [`HTTP ${res.status}`] };
    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

    for (const it of items) {
      const category = field(it, "mec:category");
      // Southern Nevada / Las Vegas only — skip Reno/Tahoe listings.
      if (/northern nevada|reno|tahoe|carson/i.test(category)) continue;

      const title = stripHtml(field(it, "title"));
      const startDate = field(it, "mec:startDate");
      if (!title || !startDate || startDate < today) continue;

      const desc = stripHtml(field(it, "description")).slice(0, 600);
      const location = stripHtml(field(it, "mec:location"));
      const cost = field(it, "mec:cost");
      const link = field(it, "link");
      const blob = `${title} ${desc} ${category}`;
      // Nevada Moms is already a vetted family calendar — keep all but adult-only.
      if (!passesAdultFilter(blob)) continue;

      const start = `${startDate}T${to24h(field(it, "mec:startHour"))}:00-07:00`;
      const endDate = field(it, "mec:endDate");
      const endHour = field(it, "mec:endHour");
      // Skip multi-month "ongoing" ranges as the end (keep single-day framing).
      const end =
        endDate && endDate === startDate
          ? `${endDate}T${to24h(endHour)}:00-07:00`
          : undefined;

      const zipMatch = location.match(/\b(89\d{3})\b/);
      events.push({
        externalId: link || `${SOURCE}:${title}:${startDate}`,
        title,
        description: desc,
        venue: location,
        address: location,
        neighborhood: neighborhoodFromZip(zipMatch?.[1]),
        lat: null,
        lng: null,
        start,
        end,
        ageTiers: classifyAges(blob),
        priceTier: classifyPrice(cost, blob),
        priceText: cost || undefined,
        url: link || undefined,
        source: SOURCE,
      });
    }
  } catch (err) {
    errors.push((err as Error).message);
  }

  return { source: SOURCE, events, errors };
}
