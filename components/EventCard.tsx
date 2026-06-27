import Link from "next/link";
import type { KidEvent } from "@/lib/types";
import { ageTier, priceTier, neighborhood } from "@/lib/constants";
import { nextOccurrenceISO } from "@/lib/recurrence";
import { t, type Lang } from "@/lib/i18n";
import { EventThumb } from "./EventThumb";
import { FavButton } from "./FavButton";

const PRICE_BG: Record<string, string> = {
  teal: "bg-teal-btn text-white",
  sunny: "bg-sunny text-ink",
  coral: "bg-coral-btn text-white",
  grape: "bg-grape text-white",
};

export function formatWhen(iso: string) {
  const d = new Date(iso);
  // Pin to Las Vegas time so server and client render identically (no hydration drift).
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

export function EventCard({ event, index = 0, distanceMi, lang = "en", priority = false }: { event: KidEvent; index?: number; distanceMi?: number; lang?: Lang; priority?: boolean }) {
  const price = priceTier(event.priceTier);
  const hood = neighborhood(event.neighborhood);
  const when = nextOccurrenceISO(event.start, event.recurrence, event.canceledDates);
  // Stagger the dramatic entrance within each loaded batch.
  const delay = (index % 30) * 45;
  return (
    <Link
      href={`/event/${event.id}`}
      style={{ animationDelay: `${delay}ms` }}
      className={`animate-card-in group flex h-full flex-col overflow-hidden rounded-blob border bg-white shadow-card transition-shadow hover:-translate-y-1 hover:shadow-lg ${event.canceled ? "border-coral-dark/40" : "border-ink/10"}`}
    >
      <div className="relative">
        <div className={event.canceled ? "grayscale-[55%]" : ""}>
          <EventThumb event={event} priority={priority} />
        </div>
        {/* Big diagonal "CANCELED" sash across the thumbnail + dimming scrim. */}
        {event.canceled && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-ink/45" aria-hidden />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
              <span className="w-[160%] rotate-[-10deg] bg-coral-btn py-1 text-center font-display text-sm font-extrabold uppercase tracking-[0.25em] text-white shadow-lg ring-1 ring-white/40">
                {t(lang, "cancel_badge")}
              </span>
            </div>
          </>
        )}
        <FavButton id={event.id} className="absolute right-2 top-2" />
        {typeof distanceMi === "number" && (
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-xs font-800 text-ink/70 shadow-pop">
            📍 {distanceMi < 10 ? distanceMi.toFixed(1) : Math.round(distanceMi)} mi
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-2 p-5 pb-3">
        <div>
          <p className="flex flex-wrap items-center gap-1.5 text-xs font-700 uppercase tracking-wide text-teal-btn">
            {formatWhen(when)}
            {event.recurrence && (
              <span className="rounded-full bg-grape/15 px-1.5 py-1 text-[10px] normal-case tracking-normal text-grape-dark">
                🔁 {event.recurrence}
              </span>
            )}
          </p>
          <h3 className="mt-1 font-display text-xl font-600 leading-tight text-ink group-hover:text-coral">
            {event.title}
          </h3>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-800 ${PRICE_BG[price.color]}`}
        >
          {price.emoji} {price.label}
        </span>
      </div>

      <p className="px-5 text-sm text-ink/70 line-clamp-2">{event.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5 px-5">
        {event.ageTiers.map((id) => {
          const a = ageTier(id);
          return (
            <span
              key={id}
              className="rounded-full bg-sand px-2.5 py-1 text-xs font-700 text-ink/70"
            >
              {a.emoji} {a.label}
            </span>
          );
        })}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-ink/10 px-5 py-3 text-xs text-ink/70">
        <span className="font-700">📍 {event.venue}</span>
        <span className="rounded-full bg-grape/10 px-2 py-1 font-700 text-grape-dark">
          {hood.label}
        </span>
      </div>
    </Link>
  );
}
