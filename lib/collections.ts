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

// Keyword match across an event's title, description and venue. Used by the
// themed "guide" collections below, whose events aren't tagged in Airtable.
function kw(e: KidEvent, re: RegExp) {
  return re.test(`${e.title} ${e.description} ${e.venue}`);
}

const WATER_RE =
  /\b(splash|splash ?pad|sprayground|water ?play|water ?park|wading|aquatic|swim|pool)\b/i;
const STORY_RE =
  /\b(storytime|story ?time|stories|read ?aloud|book ?club|babytime|toddler ?time)\b/i;
const CRAFT_RE =
  /\b(arts?|crafts?|paint|drawing|pottery|clay|origami|sculpt|maker ?space|art ?studio)\b/i;
const STEM_RE =
  /\b(stem|steam|science|robot|coding|code|lego|duplo|engineer|experiment|astronom|planetarium)\b/i;

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
  {
    slug: "beat-the-heat",
    title: "Indoor Kids Events in Las Vegas — Beat the Heat",
    heading: "Beat the heat",
    description: "Air-conditioned, indoor kid & family events across Las Vegas — libraries, museums, theaters and play spaces. Perfect for triple-digit days.",
    emoji: "🧊",
    // The scraped `indoor` flag is sparse, so also infer it from venues that are
    // reliably indoor + air-conditioned.
    predicate: (e) => Boolean(e.indoor) || INDOOR_VENUE_RE.test(`${e.venue} ${e.title}`),
  },
  {
    slug: "splash-pads",
    title: "Splash Pads & Water Play for Kids in Las Vegas",
    heading: "Splash pads & water play",
    description: "Beat the desert heat — splash pads, sprayparks, kiddie pools and water-play events for Las Vegas families all summer long.",
    emoji: "💦",
    predicate: (e) => kw(e, WATER_RE),
  },
  {
    slug: "storytime",
    title: "Kids Storytime & Library Events in Las Vegas",
    heading: "Storytime & books",
    description: "Free storytimes, baby & toddler tales, and read-alouds at libraries and bookshops across the Las Vegas valley.",
    emoji: "📚",
    predicate: (e) => kw(e, STORY_RE),
  },
  {
    slug: "arts-and-crafts",
    title: "Kids Arts & Crafts Events in Las Vegas",
    heading: "Arts & crafts",
    description: "Hands-on art classes, craft workshops, painting and maker sessions for kids and families around Las Vegas.",
    emoji: "🎨",
    predicate: (e) => kw(e, CRAFT_RE),
  },
  {
    slug: "stem",
    title: "Kids STEM & Science Events in Las Vegas",
    heading: "STEM & science",
    description: "Science shows, LEGO clubs, robotics, coding and hands-on STEM activities for curious Las Vegas kids.",
    emoji: "🔬",
    predicate: (e) => kw(e, STEM_RE),
  },
];

const INDOOR_VENUE_RE =
  /\b(librar|museum|theat(?:er|re)|gallery|aquarium|indoor|arcade|bowl|trampoline|rec(?:reation)? center|community center|discovery)\b/i;

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
