import type { ScrapedEvent } from "./types";

// Collapses repeated instances of the same event (same source+title+venue on
// different dates) into a single "series" record with a human recurrence label
// and a stable externalId, keeping the earliest upcoming instance as the date.
// This is what turns 12 weekly storytime rows into one "Weekly on Tuesdays" card.

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function laWeekday(iso: string): number {
  // Weekday in Las Vegas time.
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
  }).format(new Date(iso));
  return WEEKDAY_ABBR.indexOf(s);
}

function labelFor(instances: ScrapedEvent[]): string {
  const days = [...new Set(instances.map((e) => laWeekday(e.start)))].sort();
  const dateKeys = new Set(instances.map((e) => e.start.slice(0, 10)));
  // Daily-ish: many distinct dates spanning most of the week.
  if (days.length >= 5) return "Multiple days a week";
  if (days.length === 1) return `Weekly on ${WEEKDAY[days[0]]}s`;
  if (days.length <= 3 && dateKeys.size >= days.length) {
    return `Weekly · ${days.map((d) => WEEKDAY_ABBR[d]).join(" / ")}`;
  }
  return `${dateKeys.size} upcoming dates`;
}

export function collapseRecurring(events: ScrapedEvent[]): ScrapedEvent[] {
  const groups = new Map<string, ScrapedEvent[]>();
  for (const e of events) {
    const key = `${e.source}|${norm(e.title)}|${norm(e.venue)}`;
    const g = groups.get(key);
    if (g) g.push(e);
    else groups.set(key, [e]);
  }

  const out: ScrapedEvent[] = [];
  for (const [key, group] of groups) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    group.sort((a, b) => a.start.localeCompare(b.start));
    const series = { ...group[0] }; // earliest upcoming instance
    series.recurrence = labelFor(group);
    // Stable id so re-scrapes update the same series instead of duplicating.
    series.externalId = `series:${key}`;
    out.push(series);
  }
  return out;
}
