import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { lookupEvent, getEvents } from "@/lib/data";
import { eventAbsUrl, homePath, venuePath } from "@/lib/eventUrl";
import { safeHttpUrl } from "@/lib/httpUrl";
import { ageTier, priceTier, neighborhood, venueSlug } from "@/lib/constants";
import { eventEnv } from "@/lib/env";
import { formatWhen, EventCard } from "@/components/EventCard";
import { ShareButtons } from "@/components/ShareButtons";
import { TrackedLink } from "@/components/TrackedLink";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd, langAlternates } from "@/lib/seo";
import { nextOccurrenceISO, laDateKey, eventHasEnded } from "@/lib/recurrence";
import { AdminEventControls } from "@/components/AdminEventControls";
import { t, ageLabel, priceLabel, hoodLabel, type Lang } from "@/lib/i18n";

// ISR on demand (revalidate 10 min). Do not prebuild every event permalink:
// hundreds of pages × locales made CI hang on OpenNext's R2 cache populate.
// First visitor generates the page; after that the Worker serves the cache.
export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

const SITE = "https://vegaskiddos.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = (await params) as { lang: Lang; id: string };
  const hit = await lookupEvent(id, lang);
  if (hit.kind !== "ok") return { title: "Event not found — Vegas Kiddos" };
  const event = hit.event;
  const hood = neighborhood(event.neighborhood);
  const desc =
    (event.description || `${event.title} at ${event.venue}.`).slice(0, 155);
  const title = `${event.title} — ${event.venue}, ${hood.label}`;
  const url = eventAbsUrl(event.id, lang);
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
    alternates: langAlternates(lang, `/event/${id}`),
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = (await params) as { lang: Lang; id: string };
  const hit = await lookupEvent(id, lang);
  if (hit.kind === "gone") permanentRedirect(homePath(lang)); // 308; GET-equivalent of 301 in App Router
  if (hit.kind !== "ok") notFound();
  const event = hit.event;

  const price = priceTier(event.priceTier);
  const hood = neighborhood(event.neighborhood);
  const hoodName = hoodLabel(lang, event.neighborhood);
  const allEvents = await getEvents(lang);
  const moreAtVenue = event.venue
    ? allEvents.filter((e) => e.id !== event.id && e.venue === event.venue).slice(0, 3)
    : [];
  const moreNearby = event.neighborhood === "unknown"
    ? []
    : allEvents
        .filter((e) => e.id !== event.id && e.neighborhood === event.neighborhood && e.venue !== event.venue)
        .slice(0, 3);
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    event.address || event.venue
  )}`;

  const whenStart = nextOccurrenceISO(event.start, event.recurrence, event.canceledDates);
  const ended = eventHasEnded(event.start, event.recurrence);
  // Upcoming individually-cancelled occurrences of a recurring series (the series
  // itself keeps running) — shown as a heads-up note.
  const todayKey = laDateKey(new Date());
  const upcomingCanceled = (event.canceledDates || []).filter((d) => d >= todayKey).sort();
  const fmtCancelDay = (key: string) =>
    new Date(`${key}T12:00:00-07:00`).toLocaleDateString(lang === "es" ? "es-US" : "en-US", {
      weekday: "short", month: "short", day: "numeric", timeZone: "America/Los_Angeles",
    });

  // "Add to Google Calendar" — a feature no LV competitor offers per event.
  const gcalFmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const gcalEnd = event.end && !event.recurrence ? event.end : new Date(new Date(whenStart).getTime() + 3600000).toISOString();
  const gcalHref =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(event.title)}` +
    `&dates=${gcalFmt(whenStart)}/${gcalFmt(gcalEnd)}` +
    `&details=${encodeURIComponent((event.description || "") + (event.url ? `\n\n${event.url}` : ""))}` +
    `&location=${encodeURIComponent(event.address || event.venue)}`;

  const shareUrl = eventAbsUrl(event.id, lang);
  const rsvpUrl = safeHttpUrl(event.url);
  const ldPrice = event.priceTier === "free" ? "0" : event.priceText?.match(/\d+(?:\.\d+)?/)?.[0];
  const eventLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    // Use the next occurrence (matches the visible date) so recurring series
    // don't advertise a stale, past startDate in structured data.
    startDate: whenStart,
    endDate: gcalEnd,
    eventStatus: event.canceled
      ? "https://schema.org/EventCancelled"
      : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venue,
      address: {
        "@type": "PostalAddress",
        ...(event.address ? { streetAddress: event.address } : {}),
        addressLocality: "Las Vegas",
        addressRegion: "NV",
        addressCountry: "US",
      },
      ...(event.lat && event.lng
        ? { geo: { "@type": "GeoCoordinates", latitude: event.lat, longitude: event.lng } }
        : {}),
    },
    ...(event.image ? { image: [event.image] } : {}),
    // Only emit Offer when we actually have a price — a currency/availability
    // block with no price is an incomplete Offer (Rich Results warning).
    ...(ldPrice !== undefined && !ended
      ? {
          offers: {
            "@type": "Offer",
            price: ldPrice,
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: rsvpUrl || shareUrl,
          },
        }
      : {}),
    organizer: { "@type": "Organization", name: "Vegas Kiddos", url: SITE },
    inLanguage: lang === "es" ? "es-US" : "en-US",
    url: shareUrl,
    isAccessibleForFree: event.priceTier === "free",
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={ended && !event.canceled
        ? [breadcrumbLd([
            { name: "Vegas Kiddos", url: lang === "es" ? `${SITE}/es` : SITE },
            { name: event.title, url: lang === "es" ? `${SITE}/es/event/${event.id}` : shareUrl },
          ])]
        : [eventLd, breadcrumbLd([
            { name: "Vegas Kiddos", url: lang === "es" ? `${SITE}/es` : SITE },
            { name: event.title, url: lang === "es" ? `${SITE}/es/event/${event.id}` : shareUrl },
          ])]} />
      <Link
        href={homePath(lang)}
        className="text-sm font-700 text-teal-btn hover:underline"
      >
        {t(lang, "ev_back")}
      </Link>

      <div className="mt-3">
        <AdminEventControls id={event.id} />
      </div>

      {ended && !event.canceled && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border-2 border-ink/15 bg-sand p-4 sm:p-5">
          <span className="text-2xl leading-none" aria-hidden>📅</span>
          <div>
            <p className="font-display text-lg font-extrabold uppercase tracking-wide text-ink/80">
              {t(lang, "ended_banner")}
            </p>
            <p className="mt-1 text-sm text-ink/75">{t(lang, "ended_note")}</p>
          </div>
        </div>
      )}

      {event.canceled && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border-2 border-coral-dark/30 bg-coral/10 p-4 sm:p-5">
          <span className="text-2xl leading-none" aria-hidden>🚫</span>
          <div>
            <p className="font-display text-lg font-extrabold uppercase tracking-wide text-coral-dark">
              {t(lang, "cancel_banner")}
            </p>
            <p className="mt-1 text-sm text-ink/75">{t(lang, "cancel_note")}</p>
          </div>
        </div>
      )}

      {/* Recurring series with specific cancelled occurrences — the series still
          runs; just these dates are off. */}
      {!event.canceled && upcomingCanceled.length > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border-2 border-sunny-dark/30 bg-sunny/15 p-4 sm:p-5">
          <span className="text-2xl leading-none" aria-hidden>⚠️</span>
          <div>
            <p className="text-sm font-bold text-ink/80">{t(lang, "cancel_dates_note")}</p>
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm font-bold text-coral-dark">
              {upcomingCanceled.map((d) => (
                <li key={d}>🚫 {fmtCancelDay(d)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className={`mt-4 overflow-hidden rounded-blob border bg-white shadow-card ${event.canceled ? "border-coral-dark/30" : "border-ink/10"}`}>
        {event.image ? (
          // Hero treatment when we have the event art: full-bleed image with a
          // dark-bottom gradient scrim so the title sits on top of its own
          // palette. The aspect matches the generated 1536×1024 art so nothing
          // gets cropped on the card.
          <div className="relative aspect-[3/2] w-full overflow-hidden bg-sand">
            <Image
              src={event.image}
              alt={event.venue ? `${event.title} — ${event.venue}` : event.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className={`object-cover ${event.canceled ? "grayscale-[60%]" : ""}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 text-white">
              <p className="text-sm font-700 uppercase tracking-wide text-white/90">
                {event.recurrence ? `${t(lang, "ev_next")} ` : ""}{formatWhen(whenStart, lang)}
                {event.end && !event.recurrence ? ` – ${formatWhen(event.end, lang).split(", ").pop()}` : ""}
              </p>
              {event.recurrence && (
                <span className="mt-2 inline-block rounded-full bg-white/25 px-3 py-1 text-sm font-800 backdrop-blur-sm">
                  {t(lang, "ev_repeats")} {event.recurrence}
                </span>
              )}
              <h1 className="mt-2 font-display text-3xl font-700 drop-shadow-md sm:text-4xl">
                {event.title}
              </h1>
              <p className="mt-2 text-white/95 drop-shadow">
                📍                 {event.venue ? (
                  <Link href={venuePath(venueSlug(event.venue), lang)} className="underline decoration-white/50 underline-offset-2 hover:decoration-white">
                    {event.venue}
                  </Link>
                ) : "Las Vegas"}
              </p>
            </div>
          </div>
        ) : (
          <div className={`bg-gradient-to-br p-8 text-white ${event.canceled ? "from-ink/70 to-ink/50 grayscale" : "from-teal to-grape"}`}>
            <p className="text-sm font-700 uppercase tracking-wide text-white/80">
              {event.recurrence ? `${t(lang, "ev_next")} ` : ""}{formatWhen(whenStart, lang)}
              {event.end && !event.recurrence ? ` – ${formatWhen(event.end, lang).split(", ").pop()}` : ""}
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
              📍               {event.venue ? (
                <Link href={venuePath(venueSlug(event.venue), lang)} className="underline decoration-white/40 underline-offset-2 hover:decoration-white">
                  {event.venue}
                </Link>
              ) : "Las Vegas"}
            </p>
          </div>
        )}

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap gap-2">
            {event.neighborhood !== "unknown" && (
              <span className="rounded-full bg-grape/10 px-3 py-1 text-sm font-700 text-grape-dark">
                {hoodName}
              </span>
            )}
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
                  className="rounded-full border-2 border-teal/40 px-3 py-1 text-sm font-700 text-teal-btn"
                >
                  {a.emoji} {L.label} <span className="text-ink/70">{L.sublabel}</span>
                </span>
              );
            })}
          </div>

          <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-ink/80">
            {event.description}
          </p>

          {event.address && (
            <p className="mt-6 text-sm text-ink/70">
              <span className="font-700">{t(lang, "ev_address")}</span> {event.address}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <TrackedLink
              event="Get Directions"
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-teal-btn px-5 py-3 font-800 text-white shadow-pop transition hover:bg-teal-btnHover"
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
            {rsvpUrl && (
              <TrackedLink
                event="RSVP / Info"
                href={rsvpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-coral-btn px-5 py-3 font-800 text-white shadow-pop transition hover:bg-coral-btnHover"
              >
                {t(lang, "ev_rsvp")}
              </TrackedLink>
            )}
          </div>

          <div className="mt-6 border-t border-ink/10 pt-5">
            <p className="mb-2 text-sm font-700 text-ink/70">{t(lang, "ev_share")}</p>
            <ShareButtons url={shareUrl} title={event.title}
              text={`${event.title} — a kid-friendly event in ${hood.label}, Las Vegas`} />
          </div>

          <p className="mt-6 text-xs text-ink/70">
            {t(lang, "ev_disclaimer")}
          </p>
        </div>
      </div>

      {moreAtVenue.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-700">{t(lang, "ev_more_at")} {event.venue}</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {moreAtVenue.map((e, i) => <EventCard key={e.id} event={e} index={i} lang={lang} />)}
          </div>
        </section>
      )}

      {moreNearby.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-700">{t(lang, "ev_more_in")} {hoodName}</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {moreNearby.map((e, i) => <EventCard key={e.id} event={e} index={i} lang={lang} />)}
          </div>
        </section>
      )}
    </div>
  );
}
