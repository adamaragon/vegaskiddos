import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvents } from "@/lib/data";
import { venueSlug } from "@/lib/constants";
import { EventCard } from "@/components/EventCard";
import { nextOccurrenceISO } from "@/lib/recurrence";
import { getLang } from "@/lib/lang-server";
import type { Lang } from "@/lib/i18n";

// Dynamic so the vk_lang cookie can switch venue pages to Spanish; the
// Airtable fetch stays cached (revalidate: 600).
export const dynamic = "force-dynamic";

async function venueEvents(slug: string, lang: Lang = "en") {
  const events = await getEvents(lang);
  const list = events
    .filter((e) => venueSlug(e.venue) === slug)
    .sort((a, b) => nextOccurrenceISO(a.start, a.recurrence).localeCompare(nextOccurrenceISO(b.start, b.recurrence)));
  return { name: list[0]?.venue || "", list };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { name } = await venueEvents(slug);
  if (!name) return { title: "Venue — Vegas Kiddos" };
  return {
    title: `${name} — Kids events | Vegas Kiddos`,
    description: `Upcoming kid-friendly events at ${name} in Las Vegas.`,
  };
}

export default async function VenuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lang = await getLang();
  const { name, list } = await venueEvents(slug, lang);
  if (!name) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/" className="text-sm font-700 text-teal-dark hover:underline">← All events</Link>
      <h1 className="mt-3 font-display text-4xl font-700">{name}</h1>
      <p className="mt-1 text-ink/60">
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
