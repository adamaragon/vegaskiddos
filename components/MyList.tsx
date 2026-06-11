"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { KidEvent } from "@/lib/types";
import { getFavorites } from "@/lib/favorites";
import { EventCard } from "./EventCard";
import { ShareButtons } from "./ShareButtons";
import { RemindMe } from "./RemindMe";

export function MyList({ events, lang = "en" }: { events: KidEvent[]; lang?: "en" | "es" }) {
  const [ids, setIds] = useState<string[] | null>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    // A shared list passes ?ids=; otherwise use this device's saved favorites.
    const p = new URLSearchParams(window.location.search);
    const shared = p.get("ids");
    setShared(!!shared);
    setIds(shared ? shared.split(",").filter(Boolean) : getFavorites());
    const sync = () => {
      if (!new URLSearchParams(window.location.search).get("ids")) setIds(getFavorites());
    };
    window.addEventListener("vk-prefs", sync);
    return () => window.removeEventListener("vk-prefs", sync);
  }, []);

  if (ids === null) return <p className="py-16 text-center text-ink/70">Loading…</p>;

  const mine = ids.map((id) => events.find((e) => e.id === id)).filter(Boolean) as KidEvent[];
  const shareUrl = ids.length
    ? `https://vegaskiddos.com/my-list?ids=${encodeURIComponent(ids.join(","))}`
    : "https://vegaskiddos.com/my-list";

  if (!mine.length) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-5xl">❤️</p>
        <h1 className="mt-3 font-display text-3xl font-700">Your list is empty</h1>
        <p className="mt-2 text-ink/70">Tap the ❤️ on any event to save it here for your weekend planning.</p>
        <Link href="/" className="hover-pop mt-5 inline-block rounded-full bg-coral-btn px-5 py-3 font-800 text-white shadow-pop">Browse events</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/" className="text-sm font-700 text-teal-btn hover:underline">← All events</Link>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-700 sm:text-4xl">❤️ My list</h1>
          <p className="mt-1 text-ink/70">{mine.length} saved {mine.length === 1 ? "event" : "events"}</p>
        </div>
        <ShareButtons url={shareUrl} title="My Vegas Kiddos list" text="Check out these kid events I saved on Vegas Kiddos" compact />
      </header>
      {!shared && (
        <div className="mt-5">
          <RemindMe favoriteIds={ids} lang={lang} />
        </div>
      )}
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {mine.map((e, i) => (
          <EventCard key={e.id} event={e} index={i} lang={lang} />
        ))}
      </div>
    </div>
  );
}
