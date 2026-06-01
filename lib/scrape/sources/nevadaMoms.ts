// Source adapter: Nevada Moms (nvmoms.com) — a Modern Events Calendar site.
//
// The RSS feed (/events/feed/) only carries the ~10 most-recently-published
// items, which are Reno-dominated and mostly evergreen "(Click Here!)" roundup
// posts — so it yielded zero usable Southern Nevada events. Instead we hit MEC's
// own list endpoint (admin-ajax `mec_list_load_more`) filtered to the "Southern
// Nevada (Henderson-Vegas)" category (term 1329). It needs no nonce and pages by
// date window via `mec_start_date`. The list markup gives title + date + a stable
// event id + link; venue/description/coords are left for the enrich pass
// (fill-blank-descriptions, infer-ages, geocode) like other lightweight sources.

import type { ScrapedEvent, SourceResult } from "../types";
import { classifyAges, isKidRelevant, neighborhoodFromZip, stripHtml } from "../classify";

const SOURCE = "Nevada Moms";
const AJAX = "https://nvmoms.com/wp-admin/admin-ajax.php";
const SN_CATEGORY = "1329"; // "Southern Nevada (Henderson-Vegas)" MEC category
const UA = "VegasKiddos/1.0 (+https://vegaskiddos.com)";
const DAY_MS = 86_400_000;

// "Uptown Tot Time", "Mommy & Me", "Stroller Strides" — family signals the
// shared (broad-source) KID_INCLUDE list deliberately omits. nvmoms is already a
// Southern-Nevada family calendar, so a slightly wider net is safe here.
const EXTRA_FAMILY = /\b(tot|tots|mommy|stroller|nursing|babywearing|homeschool)\b/i;
// Explicit kid words that rescue an otherwise-adult class (e.g. "Family Yoga").
const KID_WORD = /\b(kid|kids|child|children|family|families|baby|babies|toddler|tot|teen|tween|story ?time|preschool)\b/i;
// Evergreen directory/roundup posts, not real events — always skip.
const ROUNDUP = /\(click here!?\)/i;
// nvmoms mixes adult fitness classes into the family calendar; drop them unless
// the title is explicitly kid-tagged.
const ADULT_FITNESS = /\b(yoga|pilates|zumba|barre|bootcamp|cardio|hiit)\b|enhance fitness|high fitness|\bworkout\b/i;

function decode(s: string): string {
  return stripHtml(s)
    .replace(/&#0?38;|&amp;/g, "&")
    .replace(/&#8217;|&rsquo;|&#0?39;/g, "'")
    .replace(/&#8211;|&ndash;/g, "–")
    .trim();
}

interface Article {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  link: string;
}

// MEC suppresses location in this theme's single-event HTML and REST, but its
// per-event iCal export (`?method=ical&id=<id>`) carries a full street address
// on the LOCATION line. One cheap GET per kept event; the geocode enrich pass
// turns the address into map coordinates (no GEO/lat-lng is exposed).
async function fetchVenue(id: string): Promise<string> {
  try {
    const res = await fetch(`https://nvmoms.com/?method=ical&id=${id}`, {
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return "";
    const ics = (await res.text()).replace(/\r?\n[ \t]/g, ""); // unfold
    const m = ics.match(/^LOCATION:(.+)$/m);
    if (!m) return "";
    return m[1]
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\n/gi, ", ")
      .trim();
  } catch {
    return "";
  }
}

function parseArticles(html: string): Article[] {
  const out: Article[] = [];
  for (const a of html.match(/<article[\s\S]*?<\/article>/g) || []) {
    const ym = a.match(/mec-toggle-(\d{4})(\d{2})-\d+/);
    const day = a.match(/event-d[^>]*>\s*(\d{1,2})/);
    const id = a.match(/data-event-id="(\d+)"/);
    const tA = a.match(/mec-event-title"[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    if (!ym || !day || !id || !tA) continue;
    const date = `${ym[1]}-${ym[2]}-${day[1].padStart(2, "0")}`;
    out.push({ id: id[1], date, link: tA[1], title: decode(tA[2]) });
  }
  return out;
}

export async function fetchNevadaMoms(opts?: { days?: number }): Promise<SourceResult> {
  const errors: string[] = [];
  const events: ScrapedEvent[] = [];
  const days = opts?.days ?? 60;
  const today = new Date().toISOString().slice(0, 10);

  try {
    // Walk the start-date window forward in ~10-day steps and dedup by event id
    // (recurring events recur across windows). One occurrence per event.
    const seen = new Set<string>();
    const kept: Article[] = [];
    const base = new Date(`${today}T12:00:00Z`).getTime();
    for (let offset = 0; offset <= days; offset += 10) {
      const start = new Date(base + offset * DAY_MS).toISOString().slice(0, 10);
      const body = new URLSearchParams({
        action: "mec_list_load_more",
        "atts[category]": SN_CATEGORY,
        "atts[show_only_one_occurrence]": "1",
        mec_start_date: start,
      });
      const res = await fetch(AJAX, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) {
        errors.push(`HTTP ${res.status} @ ${start}`);
        continue;
      }
      const json = (await res.json()) as { html?: string };
      for (const art of parseArticles(json.html || "")) {
        if (seen.has(art.id)) continue;
        seen.add(art.id);
        if (art.date < today) continue;
        // Title-only relevance (no description in the list markup): keep genuine
        // kid/family programming, drop the adult yoga/fitness/social classes and
        // roundup posts that share this calendar.
        if (ROUNDUP.test(art.title)) continue;
        if (ADULT_FITNESS.test(art.title) && !KID_WORD.test(art.title)) continue;
        if (!isKidRelevant(art.title) && !EXTRA_FAMILY.test(art.title)) continue;
        kept.push(art);
      }
    }

    // Fetch each kept event's address from its iCal export (parallel).
    const venues = await Promise.all(kept.map((a) => fetchVenue(a.id)));
    kept.forEach((art, i) => {
      const venue = venues[i];
      const zip = venue.match(/\b(89\d{3})\b/)?.[1];
      events.push({
        externalId: `${SOURCE}:${art.id}`,
        title: art.title,
        description: "",
        venue,
        address: venue,
        neighborhood: zip ? neighborhoodFromZip(zip) : null,
        lat: null,
        lng: null,
        start: `${art.date}T09:00:00-07:00`,
        end: undefined,
        ageTiers: classifyAges(art.title),
        priceTier: null,
        priceText: undefined,
        url: art.link && /^https?:/.test(art.link) ? art.link : undefined,
        source: SOURCE,
      });
    });
  } catch (err) {
    errors.push((err as Error).message);
  }

  return { source: SOURCE, events, errors };
}
