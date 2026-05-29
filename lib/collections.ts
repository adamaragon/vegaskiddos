import type { KidEvent } from "./types";
import { getEvents } from "./data";
import { nextOccurrenceISO } from "./recurrence";

// SEO landing-page "collections": curated filtered feeds with their own URL,
// title, and meta — the dynamic answer to competitors' static guide pages.

export interface Collection {
  slug: string;
  title: string;
  heading: string;
  description: string;
  emoji: string;
  predicate: (e: KidEvent, now: Date) => boolean;
}

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export const COLLECTIONS: Collection[] = [
  {
    slug: "free",
    title: "Free Kids Events in Las Vegas",
    heading: "Free kids events 🆓",
    description: "Every free, kid-friendly event happening around Las Vegas — storytimes, parks, festivals and more, sorted by date.",
    emoji: "🆓",
    predicate: (e) => e.priceTier === "free",
  },
  {
    slug: "today",
    title: "Kids Events in Las Vegas Today",
    heading: "Happening today",
    description: "Kid & family events happening today across the Las Vegas valley.",
    emoji: "📆",
    predicate: (e, now) => {
      const t = new Date(nextOccurrenceISO(e.start, e.recurrence)).getTime();
      const s = dayStart(now);
      return t >= s && t < s + 86400000;
    },
  },
  {
    slug: "this-weekend",
    title: "Kids Events This Weekend in Las Vegas",
    heading: "This weekend",
    description: "What to do with the kids in Las Vegas this weekend — the full Saturday & Sunday lineup.",
    emoji: "🎉",
    predicate: (e, now) => {
      const t = new Date(nextOccurrenceISO(e.start, e.recurrence)).getTime();
      const dow = now.getDay();
      const sat = dayStart(now) + ((6 - dow + 7) % 7) * 86400000;
      return t >= Math.max(sat, dayStart(now)) && t < sat + 2 * 86400000;
    },
  },
];

export function getCollectionMeta(slug: string) {
  return COLLECTIONS.find((c) => c.slug === slug);
}

export async function getCollection(
  slug: string,
  lang: import("./i18n").Lang = "en"
): Promise<{ meta: Collection; events: KidEvent[] } | null> {
  const meta = getCollectionMeta(slug);
  if (!meta) return null;
  const now = new Date();
  const events = (await getEvents(lang)).filter((e) => meta.predicate(e, now));
  return { meta, events };
}
