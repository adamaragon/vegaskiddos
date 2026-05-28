import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent, getEvents } from "@/lib/data";
import { ageTier, priceTier, neighborhood } from "@/lib/constants";
import { formatWhen } from "@/components/EventCard";

export const revalidate = 600;

export async function generateStaticParams() {
  const events = await getEvents();
  return events.map((e) => ({ id: e.id }));
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const price = priceTier(event.priceTier);
  const hood = neighborhood(event.neighborhood);
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    event.address || event.venue
  )}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/"
        className="text-sm font-700 text-teal-dark hover:underline"
      >
        ← All events
      </Link>

      <div className="mt-4 overflow-hidden rounded-blob border border-ink/10 bg-white shadow-card">
        <div className="bg-gradient-to-br from-teal to-grape p-8 text-white">
          <p className="text-sm font-700 uppercase tracking-wide text-white/80">
            {formatWhen(event.start)}
            {event.end ? ` – ${formatWhen(event.end).split(", ").pop()}` : ""}
          </p>
          <h1 className="mt-1 font-display text-3xl font-700 sm:text-4xl">
            {event.title}
          </h1>
          <p className="mt-2 text-white/90">📍 {event.venue}</p>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-grape/10 px-3 py-1 text-sm font-700 text-grape">
              {hood.label}
            </span>
            <span className="rounded-full bg-sand px-3 py-1 text-sm font-700 text-ink/70">
              {price.emoji} {event.priceText || price.label}
            </span>
            {event.indoor !== undefined && (
              <span className="rounded-full bg-sand px-3 py-1 text-sm font-700 text-ink/70">
                {event.indoor ? "🏠 Indoor" : "🌳 Outdoor"}
              </span>
            )}
            <span className="rounded-full bg-sand px-3 py-1 text-sm font-700 text-ink/70">
              via {event.source}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {event.ageTiers.map((aid) => {
              const a = ageTier(aid);
              return (
                <span
                  key={aid}
                  className="rounded-full border-2 border-teal/40 px-3 py-1 text-sm font-700 text-teal-dark"
                >
                  {a.emoji} {a.label} <span className="opacity-60">{a.sublabel}</span>
                </span>
              );
            })}
          </div>

          <p className="mt-6 text-lg leading-relaxed text-ink/80">
            {event.description}
          </p>

          {event.address && (
            <p className="mt-6 text-sm text-ink/60">
              <span className="font-700">Address:</span> {event.address}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-teal px-5 py-3 font-800 text-white shadow-pop transition hover:bg-teal-dark"
            >
              🗺️ Get directions
            </a>
            {event.url && (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-coral px-5 py-3 font-800 text-white shadow-pop transition hover:bg-coral-dark"
              >
                🔗 Event details / RSVP
              </a>
            )}
          </div>

          <p className="mt-6 text-xs text-ink/40">
            Vegas Kiddos aggregates public listings. Always confirm date, time, and
            price with the venue before heading out.
          </p>
        </div>
      </div>
    </div>
  );
}
