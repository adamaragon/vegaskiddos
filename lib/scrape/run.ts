import type { ScrapedEvent, SourceResult } from "./types";
import { fetchVegasFamilyGuide } from "./sources/vegasFamilyGuide";
import { fetchNevadaMoms } from "./sources/nevadaMoms";
import { existingExternalIds, insertEvents } from "./airtable";

export interface RunSummary {
  ranAt: string;
  sources: { source: string; found: number; errors: string[] }[];
  totalFound: number;
  newAfterDedup: number;
  inserted: number;
  dryRun: boolean;
  sampleTitles: string[];
}

// Registered source adapters. Add new ones here as they're built.
const SOURCES: (() => Promise<SourceResult>)[] = [
  () => fetchVegasFamilyGuide({ pages: 4, perPage: 50 }),
  () => fetchNevadaMoms(),
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

  // Dedup against what's already in Airtable.
  const known = dryRun ? new Set<string>() : await existingExternalIds();
  const fresh = all.filter((e) => !known.has(e.externalId));

  const inserted = dryRun || !fresh.length ? 0 : await insertEvents(fresh);

  return {
    ranAt: new Date().toISOString(),
    sources: results.map((r) => ({
      source: r.source,
      found: r.events.length,
      errors: r.errors,
    })),
    totalFound: all.length,
    newAfterDedup: fresh.length,
    inserted,
    dryRun,
    sampleTitles: fresh.slice(0, 8).map((e) => e.title),
  };
}
