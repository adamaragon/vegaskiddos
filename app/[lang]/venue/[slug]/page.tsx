import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getApprovedEvents } from "@/lib/data";
import { venueSlug } from "@/lib/constants";
import { EventCard } from "@/components/EventCard";
import { JsonLd } from "@/components/JsonLd";
import { isListedEvent, nextOccurrenceISO } from "@/lib/recurrence";
import { SITE, breadcrumbLd, langAlternates } from "@/lib/seo";
import { homePath } from "@/lib/eventUrl";
import type { Lang } from "@/lib/i18n";
import { t } from "@/lib/i18n";

export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

async function venueEvents(slug: string, lang: Lang = "en") {
  const events = await getApprovedEvents(lang);
  const list = events
    .filter((e) => venueSlug(e.venue) === slug)
    .sort((a, b) => nextOccurrenceISO(a.start, a.recurrence, a.canceledDates).localeCompare(nextOccurrenceISO(b.start, b.recurrence, b.canceledDates)));
  const upcoming = list.filter((e) => isListedEvent(e));
  return { name: list[0]?.venue || "", upcoming, past: list.filter((e) => !isListedEvent(e)) };
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = (await params) as { lang: Lang; slug: string };
  const { name } = await venueEvents(slug, lang);
  if (!name) return { title: "Venue — Vegas Kiddos" };
  return {
    title: `${name} — Kids events | Vegas Kiddos`,
    description: `Kid-friendly events at ${name} in Las Vegas.`,
    alternates: langAlternates(lang, `/venue/${slug}`),
  };
}

export default async function VenuePage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = (await params) as { lang: Lang; slug: string };
  const { name, upcoming, past } = await venueEvents(slug, lang);
  if (!name) notFound();

  const shown = upcoming.length ? upcoming : past;
  const venueUrl = `${SITE}/venue/${slug}`;
  const v = shown[0];
  const venueLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name,
    ...(v?.address ? { address: v.address } : {}),
    ...(v?.lat && v?.lng ? { geo: { "@type": "GeoCoordinates", latitude: v.lat, longitude: v.lng } } : {}),
    url: venueUrl,
  };
  const base = lang === "es" ? `${SITE}/es` : SITE;
  const crumbs = breadcrumbLd([
    { name: "Vegas Kiddos", url: base },
    { name, url: `${base}/venue/${slug}` },
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd data={[venueLd, crumbs]} />
      <Link href={homePath(lang)} className="text-sm font-700 text-teal-btn hover:underline">{t(lang, "ev_back")}</Link>
      <h1 className="mt-3 font-display text-4xl font-700">{name}</h1>
      <p className="mt-1 text-ink/70">
        {upcoming.length
          ? `${upcoming.length} upcoming kid-friendly ${upcoming.length === 1 ? "event" : "events"} at this venue`
          : t(lang, "ended_note")}
      </p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((e, i) => (
          <EventCard key={e.id} event={e} index={i} lang={lang} priority={i === 0} />
        ))}
      </div>
    </div>
  );
}
