"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { KidEvent } from "@/lib/types";
import { getFavorites } from "@/lib/favorites";
import { t, type Lang } from "@/lib/i18n";
import { homePath, myListAbsUrl } from "@/lib/eventUrl";
import { EventCard } from "./EventCard";
import { ShareButtons } from "./ShareButtons";
import { RemindMe } from "./RemindMe";

export function MyList({ events, lang = "en" }: { events: KidEvent[]; lang?: Lang }) {
  const [ids, setIds] = useState<string[] | null>(null);
  const [shared, setShared] = useState(false);
  const [extra, setExtra] = useState<KidEvent[]>([]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const sharedIds = p.get("ids");
    setShared(!!sharedIds);
    setIds(sharedIds ? sharedIds.split(",").filter(Boolean) : getFavorites());
    const sync = () => {
      if (!new URLSearchParams(window.location.search).get("ids")) setIds(getFavorites());
    };
    window.addEventListener("vk-prefs", sync);
    return () => window.removeEventListener("vk-prefs", sync);
  }, []);

  useEffect(() => {
    if (!ids) return;
    const have = new Set(events.map((e) => e.id));
    const missing = ids.filter((id) => !have.has(id)).slice(0, 40);
    if (!missing.length) {
      setExtra([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/events?ids=${encodeURIComponent(missing.join(","))}&lang=${lang}`)
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d: { events?: KidEvent[] }) => {
        if (!cancelled) setExtra(d.events || []);
      })
      .catch(() => {
        if (!cancelled) setExtra([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ids, events, lang]);

  if (ids === null) return <p className="py-16 text-center text-ink/70">{t(lang, "list_loading")}</p>;

  const byId = new Map([...events, ...extra].map((e) => [e.id, e]));
  const mine = ids.map((id) => byId.get(id)).filter(Boolean) as KidEvent[];
  const shareUrl = myListAbsUrl(ids, lang);

  if (!mine.length) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-5xl">❤️</p>
        <h1 className="mt-3 font-display text-3xl font-700">{t(lang, "list_empty_h")}</h1>
        <p className="mt-2 text-ink/70">{t(lang, "list_empty_p")}</p>
        <Link href={homePath(lang)} className="hover-pop mt-5 inline-block rounded-full bg-coral-btn px-5 py-3 font-800 text-white shadow-pop">{t(lang, "list_browse")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href={homePath(lang)} className="text-sm font-700 text-teal-btn hover:underline">{t(lang, "ev_back")}</Link>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-700 sm:text-4xl">{t(lang, "list_h")}</h1>
          <p className="mt-1 text-ink/70">{mine.length} {mine.length === 1 ? t(lang, "list_saved_1") : t(lang, "list_saved_n")}</p>
        </div>
        <ShareButtons url={shareUrl} title={t(lang, "list_share_title")} text={t(lang, "list_share_text")} compact />
      </header>
      {!shared && (
        <div className="mt-5">
          <RemindMe favoriteIds={ids} lang={lang} />
        </div>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mine.map((e, i) => (
          <EventCard key={e.id} event={e} index={i} lang={lang} />
        ))}
      </div>
    </div>
  );
}
