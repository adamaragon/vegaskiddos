import type { ScrapedEvent } from "./types";
import { laDateKey } from "../recurrence";

// Collapses repeated instances of the same event into a single "series" record,
// AND dedups the same event across sources (a farmers market listed by 3 feeds
// becomes one card). Grouping ignores source; same-day duplicates are merged
// keeping the richest data (image, geo, description, price).
//
// Per-instance cancellations are preserved, not lost: if a source cancels a
// single occurrence (e.g. the library cancels next Tuesday), that day is recorded
// in the series' `canceledDates` and the rest of the series continues. A one-time
// event that is itself cancelled is flagged `canceled`. So one cancelled instance
// never removes the whole series.

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function norm(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function laWeekday(iso: string): number {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short" }).format(new Date(iso));
  return WEEKDAY_ABBR.indexOf(s);
}
function richness(e: ScrapedEvent): number {
  return (e.image ? 4 : 0) + (e.lat ? 2 : 0) + (e.priceTier ? 1 : 0) + Math.min(1, (e.description || "").length / 100);
}
// Merge missing fields into the primary from a secondary duplicate.
function fill(primary: ScrapedEvent, other: ScrapedEvent): ScrapedEvent {
  return {
    ...primary,
    image: primary.image || other.image,
    lat: primary.lat ?? other.lat,
    lng: primary.lng ?? other.lng,
    neighborhood: primary.neighborhood || other.neighborhood,
    priceTier: primary.priceTier || other.priceTier,
    priceText: primary.priceText || other.priceText,
    url: primary.url || other.url,
    description: (primary.description || "").length >= (other.description || "").length ? primary.description : other.description,
  };
}

export function collapseRecurring(events: ScrapedEvent[]): ScrapedEvent[] {
  const groups = new Map<string, ScrapedEvent[]>();
  for (const e of events) {
    const key = `${norm(e.title)}|${norm(e.venue)}`; // cross-source: no source in key
    const g = groups.get(key);
    if (g) g.push(e);
    else groups.set(key, [e]);
  }

  const out: ScrapedEvent[] = [];
  for (const [key, group] of groups) {
    // 1) merge same-day duplicates (cross-source) into one instance per LA day.
    //    A day is cancelled only if NONE of its instances is live — a single live
    //    listing for that day wins (the event is happening). Keying on the LA
    //    calendar day matches how the app computes occurrences (lib/recurrence).
    const byDay = new Map<string, ScrapedEvent>();
    const hasLiveDay = new Set<string>();
    const hasCanceledDay = new Set<string>();
    for (const e of group) {
      const day = laDateKey(new Date(e.start));
      if (e.canceled) hasCanceledDay.add(day);
      else hasLiveDay.add(day);
      const existing = byDay.get(day);
      if (!existing) byDay.set(day, e);
      else if (existing.canceled && !e.canceled) byDay.set(day, e); // prefer a live listing
      else if (!existing.canceled && e.canceled) { /* keep the live one */ }
      else {
        const [hi, lo] = richness(e) >= richness(existing) ? [e, existing] : [existing, e];
        byDay.set(day, fill(hi, lo));
      }
    }
    // A day is cancelled only if it has no live instance at all.
    const canceledDays = [...hasCanceledDay].filter((d) => !hasLiveDay.has(d)).sort();
    const allInstances = [...byDay.values()].sort((a, b) => a.start.localeCompare(b.start));
    const liveInstances = allInstances.filter((e) => !canceledDays.includes(laDateKey(new Date(e.start))));

    // 2a) single distinct day -> one-time event (flagged canceled if that day is).
    if (allInstances.length === 1) {
      const only = allInstances[0];
      out.push({ ...only, canceled: canceledDays.length > 0 });
      continue;
    }

    // 2b) multiple distinct days -> recurring series. The label reflects the full
    //     schedule (incl. cancelled days); canceledDates carries the cancelled
    //     occurrences; the representative instance is a LIVE one when possible.
    const days = [...new Set(allInstances.map((e) => laWeekday(e.start)))].sort();
    const dateKeys = new Set(allInstances.map((e) => laDateKey(new Date(e.start))));
    let recurrence: string;
    if (days.length >= 5) recurrence = "Multiple days a week";
    else if (days.length === 1) recurrence = `Weekly on ${WEEKDAY[days[0]]}s`;
    else if (days.length <= 3 && dateKeys.size >= days.length) recurrence = `Weekly · ${days.map((d) => WEEKDAY_ABBR[d]).join(" / ")}`;
    else recurrence = `${dateKeys.size} upcoming dates`;

    const base = liveInstances[0] || allInstances[0];
    out.push({ ...base, recurrence, externalId: `series:${key}`, canceledDates: canceledDays, canceled: false });
  }
  return out;
}
