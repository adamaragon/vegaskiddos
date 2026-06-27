import type { KidEvent } from "./types";
import { getEvents } from "./data";
import { nextOccurrenceISO } from "./recurrence";
import type { Lang } from "./i18n";

// SEO landing-page "collections": curated filtered feeds with their own URL,
// title, and meta — the dynamic answer to competitors' static guide pages.

export interface Collection {
  slug: string;
  title: string;
  heading: string;
  description: string;
  emoji: string;
  // Spanish equivalents — used on /es so the page <title>, <h1>, meta
  // description, and structured data localize (hreflang was already correct).
  titleEs?: string;
  headingEs?: string;
  descriptionEs?: string;
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
    titleEs: "Eventos gratis para niños en Las Vegas",
    headingEs: "Eventos gratis para niños 🆓",
    descriptionEs: "Todos los eventos gratuitos para niños en Las Vegas — cuentacuentos, parques, festivales y más, ordenados por fecha.",
    emoji: "🆓",
    predicate: (e) => e.priceTier === "free",
  },
  {
    slug: "today",
    title: "Kids Events in Las Vegas Today",
    heading: "Happening today",
    description: "Kid & family events happening today across the Las Vegas valley.",
    titleEs: "Eventos para niños hoy en Las Vegas",
    headingEs: "Hoy",
    descriptionEs: "Eventos para niños y familias que suceden hoy en todo el valle de Las Vegas.",
    emoji: "📆",
    predicate: (e, now) => {
      const t = new Date(nextOccurrenceISO(e.start, e.recurrence, e.canceledDates)).getTime();
      const s = dayStart(now);
      return t >= s && t < s + 86400000;
    },
  },
  {
    slug: "this-weekend",
    title: "Kids Events This Weekend in Las Vegas",
    heading: "This weekend",
    description: "What to do with the kids in Las Vegas this weekend — the full Saturday & Sunday lineup.",
    titleEs: "Eventos para niños este fin de semana en Las Vegas",
    headingEs: "Este fin de semana",
    descriptionEs: "Qué hacer con los niños en Las Vegas este fin de semana — toda la programación de sábado y domingo.",
    emoji: "🎉",
    predicate: (e, now) => {
      const t = new Date(nextOccurrenceISO(e.start, e.recurrence, e.canceledDates)).getTime();
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
    titleEs: "Eventos para niños bajo techo en Las Vegas — Escapa del calor",
    headingEs: "Escapa del calor",
    descriptionEs: "Eventos para niños y familias con aire acondicionado y bajo techo en Las Vegas — bibliotecas, museos, teatros y áreas de juego. Perfectos para días de tres dígitos.",
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
    titleEs: "Parques acuáticos y juegos de agua para niños en Las Vegas",
    headingEs: "Juegos de agua",
    descriptionEs: "Vence el calor del desierto — parques acuáticos, sprayparks, piscinas infantiles y juegos de agua para familias de Las Vegas todo el verano.",
    emoji: "💦",
    predicate: (e) => kw(e, WATER_RE),
  },
  {
    slug: "storytime",
    title: "Kids Storytime & Library Events in Las Vegas",
    heading: "Storytime & books",
    description: "Free storytimes, baby & toddler tales, and read-alouds at libraries and bookshops across the Las Vegas valley.",
    titleEs: "Cuentacuentos y eventos de biblioteca para niños en Las Vegas",
    headingEs: "Cuentacuentos y libros",
    descriptionEs: "Cuentacuentos gratis, cuentos para bebés y niños pequeños, y lecturas en voz alta en bibliotecas y librerías del valle de Las Vegas.",
    emoji: "📚",
    predicate: (e) => kw(e, STORY_RE),
  },
  {
    slug: "arts-and-crafts",
    title: "Kids Arts & Crafts Events in Las Vegas",
    heading: "Arts & crafts",
    description: "Hands-on art classes, craft workshops, painting and maker sessions for kids and families around Las Vegas.",
    titleEs: "Eventos de arte y manualidades para niños en Las Vegas",
    headingEs: "Arte y manualidades",
    descriptionEs: "Clases de arte prácticas, talleres de manualidades, pintura y sesiones de creación para niños y familias en Las Vegas.",
    emoji: "🎨",
    predicate: (e) => kw(e, CRAFT_RE),
  },
  {
    slug: "stem",
    title: "Kids STEM & Science Events in Las Vegas",
    heading: "STEM & science",
    description: "Science shows, LEGO clubs, robotics, coding and hands-on STEM activities for curious Las Vegas kids.",
    titleEs: "Eventos STEM y de ciencia para niños en Las Vegas",
    headingEs: "STEM y ciencia",
    descriptionEs: "Shows de ciencia, clubes de LEGO, robótica, programación y actividades STEM prácticas para niños curiosos de Las Vegas.",
    emoji: "🔬",
    predicate: (e) => kw(e, STEM_RE),
  },
];

const INDOOR_VENUE_RE =
  /\b(librar|museum|theat(?:er|re)|gallery|aquarium|indoor|arcade|bowl|trampoline|rec(?:reation)? center|community center|discovery)\b/i;

// Return a collection's meta with title/heading/description localized for the
// given language (English fields are the fallback when an Es string is absent).
export function getCollectionMeta(slug: string, lang: Lang = "en"): Collection | undefined {
  const c = COLLECTIONS.find((x) => x.slug === slug);
  if (!c) return undefined;
  if (lang !== "es") return c;
  return {
    ...c,
    title: c.titleEs ?? c.title,
    heading: c.headingEs ?? c.heading,
    description: c.descriptionEs ?? c.description,
  };
}

export async function getCollection(
  slug: string,
  lang: Lang = "en"
): Promise<{ meta: Collection; events: KidEvent[] } | null> {
  const meta = getCollectionMeta(slug, lang);
  if (!meta) return null;
  const now = new Date();
  const events = (await getEvents(lang)).filter((e) => meta.predicate(e, now));
  return { meta, events };
}
