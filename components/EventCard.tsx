import Link from "next/link";
import type { KidEvent } from "@/lib/types";
import { ageTier, priceTier, neighborhood } from "@/lib/constants";

const PRICE_BG: Record<string, string> = {
  teal: "bg-teal text-white",
  sunny: "bg-sunny text-ink",
  coral: "bg-coral text-white",
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

export function EventCard({ event, index = 0 }: { event: KidEvent; index?: number }) {
  const price = priceTier(event.priceTier);
  const hood = neighborhood(event.neighborhood);
  // Stagger the dramatic entrance within each loaded batch.
  const delay = (index % 30) * 45;
  return (
    <Link
      href={`/event/${event.id}`}
      style={{ animationDelay: `${delay}ms` }}
      className="animate-card-in group flex flex-col overflow-hidden rounded-blob border border-ink/10 bg-white shadow-card transition-shadow hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-2 p-5 pb-3">
        <div>
          <p className="text-xs font-700 uppercase tracking-wide text-teal-dark">
            {formatWhen(event.start)}
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

      <div className="mt-4 flex items-center justify-between border-t border-ink/10 px-5 py-3 text-xs text-ink/60">
        <span className="font-700">📍 {event.venue}</span>
        <span className="rounded-full bg-grape/10 px-2 py-0.5 font-700 text-grape">
          {hood.label}
        </span>
      </div>
    </Link>
  );
}
