import type { AgeTierId, PriceTierId, NeighborhoodId } from "./constants";

export interface KidEvent {
  id: string;
  title: string;
  description: string;
  titleEs?: string; // Spanish translation (populated at scrape time)
  descriptionEs?: string; // Spanish translation
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
  canceled?: boolean; // whole one-time event cancelled; still shown, with a banner
  canceledReason?: string; // why the sweep marked it (audit / tooltip)
  canceledDates?: string[]; // for a recurring series: individual cancelled occurrences ("YYYY-MM-DD" LA days)
}
