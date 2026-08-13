import Link from "next/link";
import type { KidEvent } from "@/lib/types";
import { ageTier, priceTier } from "@/lib/constants";
import { nextOccurrenceISO } from "@/lib/recurrence";
import { t, ageLabel, priceLabel, hoodLabel, type Lang } from "@/lib/i18n";
import { eventPath } from "@/lib/eventUrl";
import { cardPlaceLabel } from "@/lib/eventPlace";
import { EventThumb } from "./EventThumb";
import { FavButton } from "./FavButton";

export const PRICE_BG: Record<string, string> = {
  teal: "bg-teal-btn text-white",
  sunny: "bg-sunny text-ink",
  coral: "bg-coral-btn text-white",
  grape: "bg-grape text-white",
};

export function formatWhen(iso: string, lang: Lang = "en") {
  const d = new Date(iso);
  return d.toLocaleString(lang === "es" ? "es-US" : "en-US", {
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
  const hoodName = hoodLabel(lang, event.neighborhood);
  const place = cardPlaceLabel(event);
  const when = nextOccurrenceISO(event.start, event.recurrence, event.canceledDates);
  // Stagger the dramatic entrance within each loaded batch.
  const delay = (index % 30) * 45;
  return (
    <Link
      href={eventPath(event.id, lang)}
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
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-700 uppercase tracking-wide text-teal-btn">
          {formatWhen(when, lang)}
        </p>
        <h3 className="mt-1.5 font-display text-2xl font-semibold leading-tight text-ink group-hover:text-coral">
          {event.title}
        </h3>
        <p className="mt-1.5 text-sm leading-snug text-ink/70 line-clamp-3">{event.description}</p>

        <div className="flex-1" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <span
            className={`flex min-h-[2.5rem] min-w-0 items-center justify-center rounded-xl px-2.5 py-1.5 text-center text-xs font-800 leading-snug ${PRICE_BG[price.color]}`}
          >
            {price.emoji} {event.priceText || priceLabel(lang, event.priceTier)}
          </span>
          {event.recurrence && (
            <span className="flex min-h-[2.5rem] min-w-0 items-center justify-center rounded-xl border border-grape/20 bg-grape/15 px-2.5 py-1.5 text-center text-xs font-700 leading-snug text-grape-dark">
              🔁 {event.recurrence}
            </span>
          )}
          {event.ageTiers.length > 0 && (
            <span className="flex min-h-[2.5rem] min-w-0 items-center justify-center rounded-xl border border-ink/10 bg-sunny/25 px-2.5 py-1.5 text-center text-xs font-700 leading-snug text-ink/80">
              {event.ageTiers
                .map((id) => `${ageTier(id).emoji} ${ageLabel(lang, id).label}`)
                .join(" · ")}
            </span>
          )}
          {event.neighborhood !== "unknown" && (
            <span className="flex min-h-[2.5rem] min-w-0 items-center justify-center rounded-xl border border-grape/20 bg-grape/10 px-2.5 py-1.5 text-center text-xs font-700 leading-snug text-grape-dark">
              {hoodName}
            </span>
          )}
        </div>

        {place && (
          <p className="mt-3 border-t border-ink/10 pt-3 text-xs font-700 leading-snug text-ink/70">
            📍 {place}
          </p>
        )}
      </div>
    </Link>
  );
}
