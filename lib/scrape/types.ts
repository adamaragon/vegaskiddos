import type { AgeTierId, PriceTierId, NeighborhoodId } from "./classify";

// A normalized event produced by a source adapter, ready for Airtable.
export interface ScrapedEvent {
  externalId: string; // stable per-source id, used for dedup
  title: string;
  description: string;
  venue: string;
  address: string;
  neighborhood: NeighborhoodId | null;
  lat: number | null;
  lng: number | null;
  start: string; // ISO
  end?: string; // ISO
  ageTiers: AgeTierId[];
  priceTier: PriceTierId | null;
  priceText?: string;
  url?: string;
  image?: string;
  source: string;
  recurrence?: string; // human label, e.g. "Weekly on Tuesdays"; empty = one-time
}

export interface SourceResult {
  source: string;
  events: ScrapedEvent[];
  errors: string[];
}
