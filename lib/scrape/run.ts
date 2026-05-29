import type { ScrapedEvent, SourceResult } from "./types";
import { makeTribeAdapter } from "./sources/tribe";
import { fetchNevadaMoms } from "./sources/nevadaMoms";
import { fetchLibrary } from "./sources/library";
import { upsertEvents, dedupeApprovedEvents } from "./airtable";
import { collapseRecurring } from "./recurring";

const vegasFamilyGuide = makeTribeAdapter({
  source: "Vegas Family Guide",
  apiBase: "https://vegasfamilyevents.com/wp-json/tribe/events/v1/events",
  pages: 5,
  perPage: 50,
});
const uncommons = makeTribeAdapter({
  source: "The UnCommons",
  apiBase: "https://uncommons.com/wp-json/tribe/events/v1/events",
  pages: 3,
  perPage: 50,
});
const familyFunVegas = makeTribeAdapter({
  source: "Family Fun Vegas",
  apiBase: "https://familyfun.vegas/wp-json/tribe/events/v1/events",
  pages: 5,
  perPage: 50,
});

export interface RunSummary {
  ranAt: string;
  sources: { source: string; found: number; errors: string[] }[];
  totalFound: number;
  afterCollapse: number;
  recurringSeries: number;
  inserted: number; // newly created
  updated: number; // existing refreshed
  dryRun: boolean;
  sampleTitles: string[];
}

// Registered source adapters. Add new ones here as they're built.
const SOURCES: (() => Promise<SourceResult>)[] = [
  vegasFamilyGuide,
  uncommons,
  familyFunVegas,
  () => fetchNevadaMoms(),
  () => fetchLibrary({ days: 45 }),
];

export async function runScrape(opts?: { dryRun?: boolean }): Promise<RunSummary> {
  const dryRun = opts?.dryRun ?? false;
  const results = await Promise.all(SOURCES.map((s) => s()));

  // Merge + dedup within this run by externalId.
  const seen = new Set<string>();
  const all: ScrapedEvent[] = [];
  for (const r of results) {
    for (const e of r.events) {
      if (!e.start) continue;
      if (seen.has(e.externalId)) continue;
      seen.add(e.externalId);
      all.push(e);
    }
  }

  // Collapse repeated instances into single recurring "series" records.
  const collapsed = collapseRecurring(all);
  const recurringSeries = collapsed.filter((e) => e.recurrence).length;

  // Upsert by ExternalId — creates new (pending), refreshes existing without
  // touching approval. Recurring series get their next date refreshed here.
  const counts = dryRun || !collapsed.length
    ? { created: 0, updated: 0 }
    : await upsertEvents(collapsed);

  // Self-heal: collapse any approved cross-source/leftover duplicates.
  if (!dryRun) {
    try { await dedupeApprovedEvents(); } catch (e) { console.error("dedupe skipped:", e); }
  }

  return {
    ranAt: new Date().toISOString(),
    sources: results.map((r) => ({
      source: r.source,
      found: r.events.length,
      errors: r.errors,
    })),
    totalFound: all.length,
    afterCollapse: collapsed.length,
    recurringSeries,
    inserted: counts.created,
    updated: counts.updated,
    dryRun,
    sampleTitles: collapsed.filter((e) => e.recurrence).slice(0, 8).map((e) => `${e.title} (${e.recurrence})`),
  };
}
