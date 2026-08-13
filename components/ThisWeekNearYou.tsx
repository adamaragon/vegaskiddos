"use client";

import { useEffect, useMemo, useState } from "react";
import type { KidEvent } from "@/lib/types";
import { type Lang, t, hoodLabel } from "@/lib/i18n";
import { NEIGHBORHOODS, nearbyHoods, nearestHood, type NeighborhoodId } from "@/lib/constants";
import { nextOccurrenceISO } from "@/lib/recurrence";
import { getHood, saveHood } from "@/lib/favorites";
import { track } from "@/lib/track";
import { EventCard } from "./EventCard";
import { Star } from "./Doodles";

const WEEK_MS = 7 * 86_400_000;
const MAX = 10;

function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Personalized "what's on this week near me" strip. Pure progressive
// enhancement: it renders nothing on the server (personalization needs
// localStorage / geolocation), then resolves on the client after mount.
export function ThisWeekNearYou({ events, lang = "en" }: { events: KidEvent[]; lang?: Lang }) {
  const [mounted, setMounted] = useState(false);
  const [hood, setHood] = useState<NeighborhoodId | "">("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState("");

  useEffect(() => {
    setMounted(true);
    const sync = () => {
      const h = getHood();
      setHood(h && h !== "unknown" ? (h as NeighborhoodId) : "");
    };
    sync();
    window.addEventListener("vk-prefs", sync);
    return () => window.removeEventListener("vk-prefs", sync);
  }, []);

  // Events occurring within the next 7 days (next occurrence for recurring).
  const thisWeek = useMemo(() => {
    const now = Date.now();
    return events
      .map((e) => ({ e, occ: Date.parse(nextOccurrenceISO(e.start, e.recurrence, e.canceledDates)) }))
      .filter((x) => !Number.isNaN(x.occ) && x.occ >= now - 6 * 3_600_000 && x.occ <= now + WEEK_MS)
      .sort((a, b) => a.occ - b.occ);
  }, [events]);

  function useMyLocation() {
    if (!navigator.geolocation) { setGeoMsg(t(lang, "tw_geo_off")); return; }
    setGeoMsg(t(lang, "tw_locating"));
    track("This Week Locate");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude };
        setCoords(c);
        setGeoMsg("");
        saveHood(nearestHood(c.lat, c.lng)); // remember nearest area for next time
      },
      () => setGeoMsg(t(lang, "tw_geo_off")),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }

  function pick(id: NeighborhoodId | "") {
    setCoords(null);
    saveHood(id); // fires vk-prefs → sync()
    track("This Week Area", { area: id || "all" });
  }

  if (!mounted || !thisWeek.length) return null;

  // Build the personalized list.
  let list = thisWeek;
  let narrowedNote = false;
  let near = false;

  if (coords) {
    const c = coords;
    list = [...thisWeek].sort(
      (a, b) =>
        (a.e.lat ? milesBetween(c, { lat: a.e.lat, lng: a.e.lng }) : Infinity) -
        (b.e.lat ? milesBetween(c, { lat: b.e.lat, lng: b.e.lng }) : Infinity)
    );
    near = true;
  } else if (hood) {
    const areas = new Set(nearbyHoods(hood));
    const local = thisWeek.filter((x) => areas.has(x.e.neighborhood));
    if (local.length >= 3) { list = local; near = true; }
    else narrowedNote = true; // not enough nearby — fall back to all, with a note
  }

  const shown = list.slice(0, MAX);
  const title = t(lang, near ? "tw_title" : "tw_title_all");

  return (
    <section className="relative mt-8" aria-label={title}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-700 sm:text-3xl">
            <Star className="h-6 w-6 text-sunny" aria-hidden /> {title}
          </h2>
          <p className="mt-0.5 text-sm text-ink/70">{t(lang, "tw_sub")}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="tw-area">{t(lang, "tw_pick")}</label>
          <select
            id="tw-area"
            value={hood}
            onChange={(e) => pick(e.target.value as NeighborhoodId | "")}
            className="rounded-full border-2 border-ink/15 bg-white px-3 py-1.5 text-sm font-700 text-ink/80 focus:border-teal focus:outline-none"
          >
            <option value="">{t(lang, "tw_all")}</option>
            {NEIGHBORHOODS.map((n) => (
              <option key={n.id} value={n.id}>{hoodLabel(lang, n.id)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={useMyLocation}
            className="hover-pop whitespace-nowrap rounded-full bg-teal-btn px-3 py-1.5 text-sm font-800 text-white shadow-pop"
          >
            {geoMsg || t(lang, "tw_loc")}
          </button>
        </div>
      </div>

      {narrowedNote && (
        <p className="mb-3 text-sm text-ink/70">{t(lang, "tw_empty_area")}</p>
      )}

      {/* Horizontal scroll strip; cards snap into place. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:thin]">
        {shown.map(({ e }, i) => (
          <div key={e.id} className="w-[280px] shrink-0 snap-start sm:w-[300px]">
            <EventCard
              event={e}
              index={i}
              lang={lang}
              distanceMi={coords && e.lat ? milesBetween(coords, { lat: e.lat, lng: e.lng }) : undefined}
            />
          </div>
        ))}
      </div>

      <div className="mt-1">
        <a href="/this-weekend" className="text-sm font-800 text-coral-btn hover:underline">
          {t(lang, "tw_see_all")}
        </a>
      </div>
    </section>
  );
}
