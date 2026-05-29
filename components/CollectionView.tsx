import Link from "next/link";
import type { KidEvent } from "@/lib/types";
import type { Collection } from "@/lib/collections";
import { EventCard } from "./EventCard";
import { JsonLd } from "./JsonLd";

const SITE = "https://vegaskiddos.com";

export function CollectionView({ meta, events }: { meta: Collection; events: KidEvent[] }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: meta.title,
    numberOfItems: events.length,
    itemListElement: events.slice(0, 30).map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE}/event/${e.id}`,
      name: e.title,
    })),
  };
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd data={ld} />
      <Link href="/" className="text-sm font-700 text-teal-dark hover:underline">← All events</Link>
      <header className="mt-3">
        <h1 className="font-display text-3xl font-700 sm:text-4xl">
          {meta.emoji} {meta.heading}
        </h1>
        <p className="mt-2 max-w-2xl text-ink/70">{meta.description}</p>
        <p className="mt-1 text-sm font-700 text-ink/50">{events.length} {events.length === 1 ? "event" : "events"}</p>
      </header>
      {events.length === 0 ? (
        <div className="mt-6 rounded-blob border border-dashed border-ink/20 bg-white py-16 text-center text-ink/50">
          <p className="text-2xl">🗓️</p>
          <p className="mt-2 font-700">Nothing here right now — check back soon!</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e, i) => (
            <EventCard key={e.id} event={e} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
