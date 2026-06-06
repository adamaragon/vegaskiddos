import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvents } from "@/lib/data";
import { venueSlug } from "@/lib/constants";
import { EventCard } from "@/components/EventCard";
import { JsonLd } from "@/components/JsonLd";
import { nextOccurrenceISO } from "@/lib/recurrence";
import { SITE, breadcrumbLd, langAlternates } from "@/lib/seo";
import type { Lang } from "@/lib/i18n";

// Statically rendered per locale + cached (revalidate: 86400). Venue slugs render
// on demand and cache on first hit (too many to prebuild), so the build stays
// fast and the Worker serves cached HTML instead of re-rendering each request.
export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

async function venueEvents(slug: string, lang: Lang = "en") {
  const events = await getEvents(lang);
  const list = events
    .filter((e) => venueSlug(e.venue) === slug)
    .sort((a, b) => nextOccurrenceISO(a.start, a.recurrence).localeCompare(nextOccurrenceISO(b.start, b.recurrence)));
  return { name: list[0]?.venue || "", list };
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = (await params) as { lang: Lang; slug: string };
  const { name } = await venueEvents(slug, lang);
  if (!name) return { title: "Venue — Vegas Kiddos" };
  return {
    title: `${name} — Kids events | Vegas Kiddos`,
    description: `Upcoming kid-friendly events at ${name} in Las Vegas.`,
    alternates: langAlternates(lang, `/venue/${slug}`),
  };
}

export default async function VenuePage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = (await params) as { lang: Lang; slug: string };
  const { name, list } = await venueEvents(slug, lang);
  if (!name) notFound();

  const venueUrl = `${SITE}/venue/${slug}`;
  const v = list[0];
  const venueLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name,
    ...(v?.address ? { address: v.address } : {}),
    ...(v?.lat && v?.lng ? { geo: { "@type": "GeoCoordinates", latitude: v.lat, longitude: v.lng } } : {}),
    url: venueUrl,
  };
  const crumbs = breadcrumbLd([
    { name: "Vegas Kiddos", url: SITE },
    { name, url: venueUrl },
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd data={[venueLd, crumbs]} />
      <Link href="/" className="text-sm font-700 text-teal-btn hover:underline">← All events</Link>
      <h1 className="mt-3 font-display text-4xl font-700">{name}</h1>
      <p className="mt-1 text-ink/70">
        {list.length} upcoming kid-friendly {list.length === 1 ? "event" : "events"} at this venue
      </p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((e, i) => (
          <EventCard key={e.id} event={e} index={i} />
        ))}
      </div>
    </div>
  );
}
