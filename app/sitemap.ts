import type { MetadataRoute } from "next";
import { getEvents } from "@/lib/data";
import { COLLECTIONS } from "@/lib/collections";
import { venueSlug } from "@/lib/constants";

const BASE = "https://vegaskiddos.com";

// Each content URL exists in English (canonical) and Spanish (/es). Emit the
// English URL with an `es` alternate so Google indexes both — matches the
// reciprocal hreflang tags rendered in the page <head>.
function entry(
  path: string,
  opts: { changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"]; priority?: number } = {},
): MetadataRoute.Sitemap[number] {
  const suffix = path === "/" ? "" : path;
  return {
    url: `${BASE}${suffix}`,
    lastModified: new Date(),
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
    alternates: { languages: { es: `${BASE}/es${suffix}` } },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await getEvents();
  const venueSlugs = [...new Set(events.map((e) => venueSlug(e.venue || "")).filter(Boolean))];

  return [
    entry("/", { changeFrequency: "daily", priority: 1 }),
    ...COLLECTIONS.map((c) => entry(`/${c.slug}`, { changeFrequency: "daily", priority: 0.8 })),
    entry("/about", { changeFrequency: "monthly", priority: 0.4 }),
    entry("/submit", { changeFrequency: "monthly", priority: 0.5 }),
    ...venueSlugs.map((slug) => entry(`/venue/${slug}`, { changeFrequency: "weekly", priority: 0.5 })),
    ...events.map((e) => entry(`/event/${e.id}`, { changeFrequency: "weekly", priority: 0.7 })),
  ];
}
