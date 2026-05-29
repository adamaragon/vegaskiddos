// Source adapter: Las Vegas–Clark County Library District (LVCCLD).
// Their Communico "Attend" calendar exposes a no-auth iCal feed at
// /feeds?data=<base64-json>. We pull the metro family branches and keep only
// kid-relevant programming (storytimes, kids/teen events). All library events
// are free. Branch -> neighborhood mapping drives the location filter.

import type { ScrapedEvent, SourceResult } from "../types";
import {
  classifyAges,
  isKidRelevant,
  stripHtml,
  type NeighborhoodId,
} from "../classify";

const SOURCE = "Library";
const FEED = "https://events.thelibrarydistrict.org/feeds";

// Metro family branches (id -> neighborhood). Verified from /v1/lvccld/locations.
const BRANCHES: { id: string; name: string; hood: NeighborhoodId }[] = [
  { id: "166", name: "Windmill Library", hood: "enterprise" },
  { id: "155", name: "Enterprise Library", hood: "enterprise" },
  { id: "160", name: "Spring Valley Library", hood: "spring-valley" },
  { id: "159", name: "Sahara West Library", hood: "spring-valley" },
  { id: "158", name: "Rainbow Library", hood: "spring-valley" },
  { id: "161", name: "Summerlin Library", hood: "summerlin" },
  { id: "153", name: "Centennial Hills Library", hood: "summerlin" },
  { id: "163", name: "West Charleston Library", hood: "downtown" },
  { id: "154", name: "Clark County Library", hood: "spring-valley" },
  { id: "165", name: "Whitney Library", hood: "henderson" },
  { id: "2031", name: "Sunrise Library", hood: "downtown" },
];

function hoodForLocation(loc: string): NeighborhoodId | null {
  const l = loc.toLowerCase();
  for (const b of BRANCHES) {
    if (l.includes(b.name.toLowerCase().replace(" library", ""))) return b.hood;
  }
  return null;
}

// Unfold iCal lines (continuation lines start with a space/tab) and split events.
function parseIcal(ics: string): Record<string, string>[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events: Record<string, string>[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") {
      if (cur) events.push(cur);
      cur = null;
    } else if (cur) {
      const i = line.indexOf(":");
      if (i > 0) {
        const key = line.slice(0, i).split(";")[0]; // drop params like ;TZID=
        cur[key] = line.slice(i + 1);
      }
    }
  }
  return events;
}

function unescapeIcal(v: string): string {
  return v
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

// "20260602T173000Z" -> proper UTC ISO. The trailing Z is genuine UTC, so we
// keep it as UTC and let display (America/Los_Angeles) convert (17:30Z = 10:30 AM
// PDT). Floating times (no Z) are assumed Pacific.
function icalToIso(dt: string): string | undefined {
  const m = dt.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  const month = Number(mo);
  const offset = month >= 3 && month <= 10 ? "-07:00" : "-08:00"; // rough DST
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`;
}

export async function fetchLibrary(opts?: { days?: number }): Promise<SourceResult> {
  const days = opts?.days ?? 30;
  const errors: string[] = [];
  const events: ScrapedEvent[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const payload = {
    feedType: "ical",
    filters: {
      location: BRANCHES.map((b) => b.id),
      ages: ["all"],
      types: ["all"],
      tags: [],
      term: "",
      days,
    },
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64");

  try {
    const res = await fetch(`${FEED}?data=${encodeURIComponent(data)}`, {
      headers: { "User-Agent": "VegasKiddos/1.0 (+https://vegaskiddos.com)" },
    });
    if (!res.ok) return { source: SOURCE, events, errors: [`HTTP ${res.status}`] };
    const ics = await res.text();

    for (const ve of parseIcal(ics)) {
      const title = unescapeIcal(ve.SUMMARY || "");
      const desc = unescapeIcal(ve.DESCRIPTION || "").slice(0, 600);
      const location = unescapeIcal(ve.LOCATION || "");
      if (!title || !ve.DTSTART) continue;

      const start = icalToIso(ve.DTSTART);
      if (!start || start.slice(0, 10) < today) continue;

      const blob = `${title} ${desc}`;
      if (!isKidRelevant(blob)) continue; // drop adult programming (ESL, tax help, book clubs)

      events.push({
        externalId: ve.UID || ve.URL || `${SOURCE}:${title}:${ve.DTSTART}`,
        title,
        description: desc,
        venue: (location.split(/\s*[-–]\s*/)[0] || location || "Library").trim(),
        address: location,
        neighborhood: hoodForLocation(location),
        lat: null,
        lng: null,
        start,
        end: ve.DTEND ? icalToIso(ve.DTEND) : undefined,
        ageTiers: classifyAges(blob),
        priceTier: "free", // library programs are free
        priceText: "Free",
        url: ve.URL || undefined,
        source: SOURCE,
      });
    }
  } catch (err) {
    errors.push((err as Error).message);
  }

  return { source: SOURCE, events, errors };
}
