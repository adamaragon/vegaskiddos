import type { MetadataRoute } from "next";
import { getApprovedEvents } from "@/lib/data";
import { COLLECTIONS } from "@/lib/collections";
import { venueSlug } from "@/lib/constants";

const BASE = "https://vegaskiddos.com";

// Regenerate daily so newly-scraped/approved events appear in the sitemap
// without waiting for a redeploy (it was static-at-build-time before). Daily
// is plenty for crawlers and keeps the Airtable-backed render off the hot path
// (was hourly — more function compute than the crawl cadence warrants).

export const revalidate = 600;

// Each content URL exists in English (canonical) and Spanish (/es). Emit the
// English URL with an `es` alternate so Google indexes both — matches the
// reciprocal hreflang tags rendered in the page <head>.
function entry(
  path: string,
  opts: { changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"]; priority?: number } = {},
): MetadataRoute.Sitemap[number] {
  const suffix = path === "/" ? "" : path;
  // No lastModified: we have no reliable per-URL modified timestamp, and
  // stamping every URL with `new Date()` on each daily regen just trains
  // crawlers to ignore the field. Omitting it is the honest signal.
  return {
    url: `${BASE}${suffix}`,
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
    alternates: { languages: { es: `${BASE}/es${suffix}` } },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await getApprovedEvents();
  const venueSlugs = [...new Set(events.map((e) => venueSlug(e.venue || "")).filter(Boolean))];

  return [
    entry("/", { changeFrequency: "daily", priority: 1 }),
    ...COLLECTIONS.map((c) => entry(`/${c.slug}`, { changeFrequency: "daily", priority: 0.8 })),
    entry("/about", { changeFrequency: "monthly", priority: 0.4 }),
    entry("/submit", { changeFrequency: "monthly", priority: 0.5 }),
    entry("/donate", { changeFrequency: "yearly", priority: 0.3 }),
    ...venueSlugs.map((slug) => entry(`/venue/${slug}`, { changeFrequency: "weekly", priority: 0.5 })),
    ...events.map((e) => entry(`/event/${e.id}`, { changeFrequency: "weekly", priority: 0.7 })),
  ];
}
