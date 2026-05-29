import type { AgeTierId, PriceTierId, NeighborhoodId } from "./constants";

export interface KidEvent {
  id: string;
  title: string;
  description: string;
  venue: string;
  address: string;
  neighborhood: NeighborhoodId;
  lat: number;
  lng: number;
  start: string; // ISO datetime
  end?: string; // ISO datetime
  ageTiers: AgeTierId[];
  priceTier: PriceTierId;
  priceText?: string; // e.g. "$8 / child, adults free"
  url?: string; // RSVP / source link
  image?: string;
  source: string; // where it came from (Library, Eventbrite, Community, ...)
  indoor?: boolean;
  recurrence?: string; // e.g. "Weekly on Tuesdays"; empty/undefined = one-time
}
