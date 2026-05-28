import type { MetadataRoute } from "next";
import { getEvents } from "@/lib/data";

const BASE = "https://vegaskiddos.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await getEvents();
  const eventUrls = events.map((e) => ({
    url: `${BASE}/event/${e.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/submit`, changeFrequency: "monthly", priority: 0.5 },
    ...eventUrls,
  ];
}
