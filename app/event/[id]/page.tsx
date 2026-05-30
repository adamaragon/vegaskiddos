import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent, getEvents } from "@/lib/data";
import { ageTier, priceTier, neighborhood, venueSlug } from "@/lib/constants";
import { eventEnv } from "@/lib/env";
import { formatWhen, EventCard } from "@/components/EventCard";
import { ShareButtons } from "@/components/ShareButtons";
import { TrackedLink } from "@/components/TrackedLink";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";
import { nextOccurrenceISO } from "@/lib/recurrence";
import { AdminEventControls } from "@/components/AdminEventControls";
import { getLang } from "@/lib/lang-server";
import { t, ageLabel, priceLabel, hoodLabel } from "@/lib/i18n";

// Rendered dynamically so the vk_lang cookie can switch the page to Spanish.
// The Airtable fetch underneath is still cached (revalidate: 600), so pages
// stay fast and crawlers get fully server-rendered HTML.
export const dynamic = "force-dynamic";

const SITE = "https://vegaskiddos.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event not found — Vegas Kiddos" };
  const hood = neighborhood(event.neighborhood);
  const desc =
    (event.description || `${event.title} at ${event.venue}.`).slice(0, 155);
  const title = `${event.title} — ${event.venue}, ${hood.label}`;
  const url = `${SITE}/event/${event.id}`;
  return {
    title: `${event.title} | Vegas Kiddos`,
    description: desc,
    openGraph: {
      title,
      description: desc,
      url,
      type: "website",
      images: [event.image || `${SITE}/opengraph-image`],
    },
    twitter: { card: "summary_large_image", title, description: desc },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lang = await getLang();
  const event = await getEvent(id, lang);
  if (!event) notFound();

  const price = priceTier(event.priceTier);
  const hood = neighborhood(event.neighborhood);
  const hoodName = hoodLabel(lang, event.neighborhood);
  const allEvents = await getEvents(lang);
  const moreAtVenue = event.venue
    ? allEvents.filter((e) => e.id !== event.id && e.venue === event.venue).slice(0, 3)
    : [];
  const moreNearby = allEvents
    .filter((e) => e.id !== event.id && e.neighborhood === event.neighborhood && e.venue !== event.venue)
    .slice(0, 3);
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    event.address || event.venue
  )}`;

  const whenStart = nextOccurrenceISO(event.start, event.recurrence);

  // "Add to Google Calendar" — a feature no LV competitor offers per event.
  const gcalFmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const gcalEnd = event.end && !event.recurrence ? event.end : new Date(new Date(whenStart).getTime() + 3600000).toISOString();
  const gcalHref =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(event.title)}` +
    `&dates=${gcalFmt(whenStart)}/${gcalFmt(gcalEnd)}` +
    `&details=${encodeURIComponent((event.description || "") + (event.url ? `\n\n${event.url}` : ""))}` +
    `&location=${encodeURIComponent(event.address || event.venue)}`;

  const shareUrl = `${SITE}/event/${event.id}`;
  // Free → "0"; paid → first number in the price text (e.g. "$8 / child" → "8").
  const ldPrice = event.priceTier === "free" ? "0" : event.priceText?.match(/\d+(?:\.\d+)?/)?.[0];
  const eventLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    startDate: event.start,
    ...(event.end ? { endDate: event.end } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venue,
      address: event.address || event.venue,
      ...(event.lat && event.lng
        ? { geo: { "@type": "GeoCoordinates", latitude: event.lat, longitude: event.lng } }
        : {}),
    },
    ...(event.image ? { image: [event.image] } : {}),
    offers: {
      "@type": "Offer",
      ...(ldPrice ? { price: ldPrice } : {}),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: event.url || shareUrl,
    },
    organizer: { "@type": "Organization", name: "Vegas Kiddos", url: SITE },
    inLanguage: lang,
    url: shareUrl,
    isAccessibleForFree: event.priceTier === "free",
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={[eventLd, breadcrumbLd([{ name: "Vegas Kiddos", url: SITE }, { name: event.title, url: shareUrl }])]} />
      <Link
        href="/"
        className="text-sm font-700 text-teal-dark hover:underline"
      >
        {t(lang, "ev_back")}
      </Link>

      <div className="mt-3">
        <AdminEventControls id={event.id} />
      </div>

      <div className="mt-4 overflow-hidden rounded-blob border border-ink/10 bg-white shadow-card">
        <div className="bg-gradient-to-br from-teal to-grape p-8 text-white">
          <p className="text-sm font-700 uppercase tracking-wide text-white/80">
            {event.recurrence ? `${t(lang, "ev_next")} ` : ""}{formatWhen(whenStart)}
            {event.end && !event.recurrence ? ` – ${formatWhen(event.end).split(", ").pop()}` : ""}
          </p>
          {event.recurrence && (
            <span className="mt-2 inline-block rounded-full bg-white/25 px-3 py-1 text-sm font-800">
              {t(lang, "ev_repeats")} {event.recurrence}
            </span>
          )}
          <h1 className="mt-2 font-display text-3xl font-700 sm:text-4xl">
            {event.title}
          </h1>
          <p className="mt-2 text-white/90">
            📍 {event.venue ? (
              <Link href={`/venue/${venueSlug(event.venue)}`} className="underline decoration-white/40 underline-offset-2 hover:decoration-white">
                {event.venue}
              </Link>
            ) : "Las Vegas"}
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-grape/10 px-3 py-1 text-sm font-700 text-grape">
              {hoodName}
            </span>
            <span className="rounded-full bg-sand px-3 py-1 text-sm font-700 text-ink/70">
              {price.emoji} {event.priceText || priceLabel(lang, event.priceTier)}
            </span>
            {eventEnv(event) && (
              <span className="rounded-full bg-sand px-3 py-1 text-sm font-700 text-ink/70">
                {eventEnv(event) === "indoor" ? t(lang, "indoor") : t(lang, "outdoor")}
              </span>
            )}
            <span className="rounded-full bg-sand px-3 py-1 text-sm font-700 text-ink/70">
              {t(lang, "ev_via")} {event.source}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {event.ageTiers.map((aid) => {
              const a = ageTier(aid);
              const L = ageLabel(lang, aid);
              return (
                <span
                  key={aid}
                  className="rounded-full border-2 border-teal/40 px-3 py-1 text-sm font-700 text-teal-dark"
                >
                  {a.emoji} {L.label} <span className="opacity-60">{L.sublabel}</span>
                </span>
              );
            })}
          </div>

          <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-ink/80">
            {event.description}
          </p>

          {event.address && (
            <p className="mt-6 text-sm text-ink/60">
              <span className="font-700">{t(lang, "ev_address")}</span> {event.address}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <TrackedLink
              event="Get Directions"
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-teal px-5 py-3 font-800 text-white shadow-pop transition hover:bg-teal-dark"
            >
              {t(lang, "ev_directions")}
            </TrackedLink>
            <TrackedLink
              event="Add to Calendar"
              href={gcalHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-grape px-5 py-3 font-800 text-white shadow-pop transition hover:bg-grape-dark"
            >
              {t(lang, "ev_calendar")}
            </TrackedLink>
            {event.url && (
              <TrackedLink
                event="RSVP / Info"
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-coral px-5 py-3 font-800 text-white shadow-pop transition hover:bg-coral-dark"
              >
                {t(lang, "ev_rsvp")}
              </TrackedLink>
            )}
          </div>

          <div className="mt-6 border-t border-ink/10 pt-5">
            <p className="mb-2 text-sm font-700 text-ink/60">{t(lang, "ev_share")}</p>
            <ShareButtons url={shareUrl} title={event.title}
              text={`${event.title} — a kid-friendly event in ${hood.label}, Las Vegas`} />
          </div>

          <p className="mt-6 text-xs text-ink/40">
            {t(lang, "ev_disclaimer")}
          </p>
        </div>
      </div>

      {moreAtVenue.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-700">{t(lang, "ev_more_at")} {event.venue}</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {moreAtVenue.map((e, i) => <EventCard key={e.id} event={e} index={i} />)}
          </div>
        </section>
      )}

      {moreNearby.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-700">{t(lang, "ev_more_in")} {hoodName}</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {moreNearby.map((e, i) => <EventCard key={e.id} event={e} index={i} />)}
          </div>
        </section>
      )}
    </div>
  );
}
