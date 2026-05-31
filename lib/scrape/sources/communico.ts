// Generic adapter for libraries running Communico "Attend", which exposes a
// no-auth iCal feed at <host>/feeds?data=<base64-json>. Both the Las Vegas–
// Clark County Library District and Henderson Libraries run Communico, so this
// factory drives both. Branch -> neighborhood mapping powers the location
// filter; all library programming is free.

import type { ScrapedEvent, SourceResult } from "../types";
import { classifyAges, isKidRelevant, type NeighborhoodId } from "../classify";
import { parseIcal, unescapeIcal, icalToIso } from "../ical";

export interface CommunicoBranch {
  id: string;
  name: string;
  hood: NeighborhoodId;
}

export function makeCommunicoAdapter(opts: {
  source: string;
  feedUrl: string; // e.g. "https://henderson.libnet.info/feeds"
  branches: CommunicoBranch[];
}) {
  const { source, feedUrl, branches } = opts;

  function hoodForLocation(loc: string): NeighborhoodId | null {
    const l = loc.toLowerCase();
    for (const b of branches) {
      if (l.includes(b.name.toLowerCase().replace(/ library$/, ""))) return b.hood;
    }
    return branches[0]?.hood ?? null;
  }

  return async function fetchCommunico(opts2?: { days?: number }): Promise<SourceResult> {
    const days = opts2?.days ?? 45;
    const errors: string[] = [];
    const events: ScrapedEvent[] = [];
    const today = new Date().toISOString().slice(0, 10);

    const payload = {
      feedType: "ical",
      filters: {
        location: branches.map((b) => b.id),
        ages: ["all"],
        types: ["all"],
        tags: [],
        term: "",
        days,
      },
    };
    const data = Buffer.from(JSON.stringify(payload)).toString("base64");

    try {
      const res = await fetch(`${feedUrl}?data=${encodeURIComponent(data)}`, {
        headers: { "User-Agent": "VegasKiddos/1.0 (+https://vegaskiddos.com)" },
      });
      if (!res.ok) return { source, events, errors: [`HTTP ${res.status}`] };
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
          externalId: ve.UID || ve.URL || `${source}:${title}:${ve.DTSTART}`,
          title,
          description: desc,
          venue: (location.split(/\s*[-–]\s*/)[0] || location || source).trim(),
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
          source,
        });
      }
    } catch (err) {
      errors.push((err as Error).message);
    }

    return { source, events, errors };
  };
}
