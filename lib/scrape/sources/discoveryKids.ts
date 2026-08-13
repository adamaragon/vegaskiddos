// DISCOVERY Children's Museum (discoverykidslv.org). EventON plugin — no
// public iCal, Tribe REST 404s, and /export-events/* 500s. The WP REST list
// (ajde_events) has titles but no dates; each permalink embeds schema.org
// Event JSON-LD with start/end. ~17 published events, so permalink fetches
// are cheap.

import type { ScrapedEvent, SourceResult } from "../types";
import {
  classifyAges,
  isKidRelevant,
  resolvePrice,
  stripHtml,
} from "../classify";
import { fetchJsonRetry, fetchTextRetry } from "../http";

const SOURCE = "DISCOVERY Kids";
const REST = "https://discoverykidslv.org/wp-json/wp/v2/ajde_events";
const UA =
  "Mozilla/5.0 (compatible; VegasKiddos/1.0; +https://vegaskiddos.com)";
const VENUE = "DISCOVERY Children's Museum";
const ADDRESS = "360 Promenade Place, Las Vegas, NV 89106";
const LAT = 36.169;
const LNG = -115.140;
const SKIP = /online-admission|buy-tickets|camps-mockup|venue-rentals|sponsor-test|export-events/;

interface WpPost {
  id: number;
  slug: string;
  status?: string;
  link: string;
  title?: { rendered?: string };
}

function padIso(raw: string): string | undefined {
  const m = raw
    .trim()
    .match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})(?:T(\d{1,2}):(\d{2})(?::(\d{2}))?(?:([+-])(\d{1,2}):?(\d{2}))?)?/,
    );
  if (!m) return undefined;
  const [, y, mo, d, h, mi, se, sign, oh, om] = m;
  const date = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  if (!h) return `${date}T09:00:00-07:00`;
  const offset = sign
    ? `${sign}${oh.padStart(2, "0")}:${(om || "00").padStart(2, "0")}`
    : "-07:00";
  return `${date}T${h.padStart(2, "0")}:${mi}:${(se || "00").padStart(2, "0")}${offset}`;
}

function jsonLdEvents(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1]) as unknown;
      const stack = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of stack) {
        if (!node || typeof node !== "object") continue;
        const obj = node as Record<string, unknown>;
        if (obj["@graph"] && Array.isArray(obj["@graph"])) {
          for (const g of obj["@graph"]) {
            if (g && typeof g === "object" && (g as { "@type"?: string })["@type"] === "Event") {
              out.push(g as Record<string, unknown>);
            }
          }
        } else if (obj["@type"] === "Event") {
          out.push(obj);
        }
      }
    } catch {
      /* malformed block */
    }
  }
  return out;
}

function locName(ld: Record<string, unknown>): string {
  const loc = ld.location;
  if (loc && typeof loc === "object" && !Array.isArray(loc)) {
    const name = (loc as { name?: string }).name;
    if (name) return stripHtml(name);
  }
  return VENUE;
}

function locAddress(ld: Record<string, unknown>): string {
  const loc = ld.location;
  if (loc && typeof loc === "object" && !Array.isArray(loc)) {
    const addr = (loc as { address?: unknown }).address;
    if (typeof addr === "string" && addr.trim()) return addr.trim();
    if (addr && typeof addr === "object") {
      const a = addr as { streetAddress?: string; addressLocality?: string; postalCode?: string };
      const parts = [a.streetAddress, a.addressLocality, a.postalCode].filter(Boolean);
      if (parts.length) return parts.join(", ");
    }
  }
  return ADDRESS;
}

export async function fetchDiscoveryKids(): Promise<SourceResult> {
  const errors: string[] = [];
  const events: ScrapedEvent[] = [];
  const today = new Date().toISOString().slice(0, 10);

  let posts: WpPost[] = [];
  try {
    const data = await fetchJsonRetry<WpPost[]>(
      `${REST}?per_page=100&status=publish`,
      { headers: { "User-Agent": UA } },
      { retries: 3 },
    );
    if (data === "PAST_END") {
      return { source: SOURCE, events, errors: ["REST past-end"] };
    }
    posts = data.filter((p) => p.status !== "draft" && !SKIP.test(p.slug || "") && !SKIP.test(p.link || ""));
  } catch (err) {
    return { source: SOURCE, events, errors: [(err as Error).message] };
  }

  for (const post of posts) {
    let html: string;
    try {
      html = await fetchTextRetry(post.link, { headers: { "User-Agent": UA } }, { retries: 2, timeoutMs: 15_000 });
    } catch (err) {
      errors.push(`${post.slug}: ${(err as Error).message}`);
      continue;
    }
    const ld = jsonLdEvents(html)[0];
    if (!ld) continue;
    const title = stripHtml(String(ld.name || post.title?.rendered || ""));
    if (!title) continue;
    const start = padIso(String(ld.startDate || ""));
    if (!start || start.slice(0, 10) < today) continue;
    const desc = stripHtml(String(ld.description || "")).slice(0, 600);
    const venue = locName(ld);
    const address = locAddress(ld);
    const blob = `${title} ${desc} ${venue} ${address}`;
    if (!isKidRelevant(blob)) continue;
    const price = resolvePrice(null, `${title} ${venue} ${desc}`);
    const image = typeof ld.image === "string" ? ld.image : undefined;
    events.push({
      externalId: `${SOURCE}:${post.id}`,
      title,
      description: desc,
      venue,
      address,
      neighborhood: venue.toLowerCase().includes("palms") ? "spring-valley" : "downtown",
      lat: LAT,
      lng: LNG,
      start,
      end: padIso(String(ld.endDate || "")),
      ageTiers: classifyAges(blob),
      priceTier: price.tier,
      priceText: price.text,
      url: post.link,
      image,
      source: SOURCE,
    });
  }

  return { source: SOURCE, events, errors: events.length ? [] : errors };
}
