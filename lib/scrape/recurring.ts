import type { ScrapedEvent } from "./types";

// Collapses repeated instances of the same event into a single "series" record,
// AND dedups the same event across sources (a farmers market listed by 3 feeds
// becomes one card). Grouping ignores source; same-day duplicates are merged
// keeping the richest data (image, geo, description, price).

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
    // 1) merge same-day duplicates (cross-source) into one instance per day.
    const byDay = new Map<string, ScrapedEvent>();
    for (const e of group) {
      const day = e.start.slice(0, 10);
      const existing = byDay.get(day);
      if (!existing) byDay.set(day, e);
      else {
        const [hi, lo] = richness(e) >= richness(existing) ? [e, existing] : [existing, e];
        byDay.set(day, fill(hi, lo));
      }
    }
    const instances = [...byDay.values()].sort((a, b) => a.start.localeCompare(b.start));

    if (instances.length === 1) { out.push(instances[0]); continue; }

    // 2) multiple distinct days -> recurring series.
    const days = [...new Set(instances.map((e) => laWeekday(e.start)))].sort();
    const dateKeys = new Set(instances.map((e) => e.start.slice(0, 10)));
    let recurrence: string;
    if (days.length >= 5) recurrence = "Multiple days a week";
    else if (days.length === 1) recurrence = `Weekly on ${WEEKDAY[days[0]]}s`;
    else if (days.length <= 3 && dateKeys.size >= days.length) recurrence = `Weekly · ${days.map((d) => WEEKDAY_ABBR[d]).join(" / ")}`;
    else recurrence = `${dateKeys.size} upcoming dates`;

    const series = { ...instances[0], recurrence, externalId: `series:${key}` };
    out.push(series);
  }
  return out;
}
