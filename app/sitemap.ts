import type { MetadataRoute } from "next";
import { getEvents } from "@/lib/data";
import { COLLECTIONS } from "@/lib/collections";
import { venueSlug } from "@/lib/constants";

const BASE = "https://vegaskiddos.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await getEvents();
  const eventUrls = events.map((e) => ({
    url: `${BASE}/event/${e.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  const collectionUrls = COLLECTIONS.map((c) => ({
    url: `${BASE}/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));
  const venueSlugs = [...new Set(events.map((e) => venueSlug(e.venue || "")).filter(Boolean))];
  const venueUrls = venueSlugs.map((slug) => ({
    url: `${BASE}/venue/${slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    ...collectionUrls,
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/submit`, changeFrequency: "monthly", priority: 0.5 },
    ...venueUrls,
    ...eventUrls,
  ];
}
