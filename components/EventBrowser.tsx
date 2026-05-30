"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { KidEvent } from "@/lib/types";
import { t as i18nT, ageLabel, priceLabel, hoodLabel, type Lang, type StringKey } from "@/lib/i18n";
import { EventCard } from "./EventCard";
import { track } from "@/lib/track";
import {
  AGE_TIERS,
  PRICE_TIERS,
  NEIGHBORHOODS,
  neighborhoodsForZip,
  type AgeTierId,
  type PriceTierId,
  type NeighborhoodId,
} from "@/lib/constants";
import { getFavorites, getSavedAges, saveAges } from "@/lib/favorites";

const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] min-h-[420px] w-full items-center justify-center rounded-blob border border-ink/10 bg-white text-ink/40">
      Loading map…
    </div>
  ),
});

const CalendarView = dynamic(() => import("./CalendarView").then((m) => m.CalendarView), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[420px] w-full items-center justify-center rounded-blob border border-ink/10 bg-white text-ink/40">
      Loading calendar…
    </div>
  ),
});

type View = "list" | "calendar" | "map";

// Infer indoor/outdoor from venue + title keywords (most scraped events don't
// carry the flag). Returns "indoor" | "outdoor" | null.
const INDOOR_RE = /library|museum|\bcenter\b|indoor|gallery|theat(er|re)|studio|\bgym\b|arena|hall|academy|clinic|store|shop|mall/i;
const OUTDOOR_RE = /\bpark\b|trail|\bpool\b|splash|garden|farmers? market|festival|outdoor|plaza|field|preserve|\bhike\b|amphitheater|ballfield|playground|courtyard/i;
function eventEnv(e: KidEvent): "indoor" | "outdoor" | null {
  if (e.indoor === true) return "indoor";
  if (e.indoor === false) return "outdoor";
  const t = `${e.title} ${e.venue}`;
  if (OUTDOOR_RE.test(t)) return "outdoor";
  if (INDOOR_RE.test(t)) return "indoor";
  return null;
}
// Distance in miles between two lat/lng (haversine).
function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3959, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

type DateRangeId = "any" | "today" | "weekend" | "week" | "month" | "next-month";
const DATE_FILTERS: { id: DateRangeId; label: string }[] = [
  { id: "any", label: "Any time" },
  { id: "today", label: "Today" },
  { id: "weekend", label: "This weekend" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "next-month", label: "Next month" },
];

// Returns true if an event's ISO start falls within the chosen range.
function inDateRange(iso: string, range: DateRangeId): boolean {
  if (range === "any") return true;
  const t = new Date(iso).getTime();
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const DAY = 86400000;
  switch (range) {
    case "today":
      return t >= startToday && t < startToday + DAY;
    case "weekend": {
      // Upcoming Saturday 00:00 through Monday 00:00.
      const dow = now.getDay(); // 0 Sun … 6 Sat
      const toSat = (6 - dow + 7) % 7;
      const sat = startToday + toSat * DAY;
      return t >= Math.max(sat, startToday) && t < sat + 2 * DAY;
    }
    case "week": {
      // Today through end of Sunday (end of the current week).
      const dow = now.getDay();
      const toSun = (7 - dow) % 7; // days until Sunday
      const end = startToday + (toSun + 1) * DAY;
      return t >= startToday && t < end;
    }
    case "month": {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      return t >= startToday && t < end;
    }
    case "next-month": {
      const start = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 1).getTime();
      return t >= start && t < end;
    }
    default:
      return true;
  }
}

function Chip({
  active,
  onClick,
  scroll = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  // When true, the chip sizes to its content on mobile (so the row scrolls
  // instead of squishing) and only stretches to equal width at sm+.
  scroll?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`border-l border-ink/10 px-2.5 py-2 text-center text-xs font-700 transition first:border-l-0 sm:text-sm ${
        scroll ? "flex-none whitespace-nowrap sm:flex-1 sm:truncate" : "flex-1 truncate"
      } ${
        active
          ? "bg-coral text-white"
          : "bg-white text-ink/70 hover:bg-coral/10"
      }`}
    >
      {children}
    </button>
  );
}

export function EventBrowser({ events, lang = "en" }: { events: KidEvent[]; lang?: Lang }) {
  const tr = (k: StringKey) => i18nT(lang, k);
  // Localized label for a date-range chip (maps id → "d_*" string key).
  const dateLabel = (id: DateRangeId) => tr(`d_${id.replace(/-/g, "_")}` as StringKey);
  const [view, setView] = useState<View>("list");
  const [showFilters, setShowFilters] = useState(false);
  const [ages, setAges] = useState<Set<AgeTierId>>(new Set());
  const [prices, setPrices] = useState<Set<PriceTierId>>(new Set());
  const [hoods, setHoods] = useState<Set<NeighborhoodId>>(new Set());
  const [dateRange, setDateRange] = useState<DateRangeId>("any");
  const [zip, setZip] = useState("");
  const [zipNote, setZipNote] = useState("");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState("");
  const [q, setQ] = useState("");
  const [env, setEnv] = useState<"any" | "indoor" | "outdoor">("any");

  // On mount: hydrate filters from the URL (shareable links), else saved ages.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const has = [...p.keys()].length > 0;
    if (p.get("ages")) setAges(new Set(p.get("ages")!.split(",") as AgeTierId[]));
    else if (!has) { const saved = getSavedAges(); if (saved.length) setAges(new Set(saved as AgeTierId[])); }
    if (p.get("price")) setPrices(new Set(p.get("price")!.split(",") as PriceTierId[]));
    if (p.get("area")) setHoods(new Set(p.get("area")!.split(",") as NeighborhoodId[]));
    if (p.get("when")) setDateRange(p.get("when") as DateRangeId);
    if (p.get("q")) setQ(p.get("q")!);
    if (p.get("env")) setEnv(p.get("env") as "indoor" | "outdoor");
    if (p.get("fav") === "1") setOnlyFavs(true);
    // If the visitor arrived with filters in the URL, reveal the panel so the
    // active filters are visible (not hidden behind the collapsed toggle).
    if (["ages", "price", "area", "when", "env"].some((k) => p.get(k))) setShowFilters(true);
    const sync = () => setFavs(new Set(getFavorites()));
    sync();
    window.addEventListener("vk-prefs", sync);
    return () => window.removeEventListener("vk-prefs", sync);
  }, []);

  // Keep the URL in sync so any filter view is shareable/bookmarkable.
  useEffect(() => {
    const p = new URLSearchParams();
    if (ages.size) p.set("ages", [...ages].join(","));
    if (prices.size) p.set("price", [...prices].join(","));
    if (hoods.size) p.set("area", [...hoods].join(","));
    if (dateRange !== "any") p.set("when", dateRange);
    if (q.trim()) p.set("q", q.trim());
    if (env !== "any") p.set("env", env);
    if (onlyFavs) p.set("fav", "1");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [ages, prices, hoods, dateRange, q, env, onlyFavs]);

  function setAgesPersist(next: Set<AgeTierId>) {
    setAges(next);
    saveAges([...next]);
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setGeoMsg(tr("geo_unavailable")); return; }
    setGeoMsg(tr("geo_finding"));
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoMsg(tr("geo_sorted")); },
      () => setGeoMsg(tr("geo_failed")),
      { timeout: 8000 }
    );
  }

  function toggle<T>(set: Set<T>, value: T, update: (s: Set<T>) => void) {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    update(next);
  }

  function applyZip(raw: string) {
    const z = raw.replace(/\D/g, "").slice(0, 5);
    setZip(z);
    if (z.length === 5) {
      const near = neighborhoodsForZip(z);
      if (near.length) {
        setHoods(new Set(near));
        const areas = near.map((n) => hoodLabel(lang, n).split(" / ")[0]).join(", ");
        setZipNote(lang === "es" ? `Mostrando ${areas} cerca de ${z}` : `Showing ${areas} near ${z}`);
      } else {
        setZipNote(lang === "es"
          ? `Aún no reconocemos ${z} — prueba a elegir una zona abajo.`
          : `We don't recognize ${z} yet — try picking an area below.`);
      }
    } else {
      setZipNote("");
    }
  }

  const PAGE = 30;
  const [visible, setVisible] = useState(PAGE);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = events.filter((e) => {
      if (onlyFavs && !favs.has(e.id)) return false;
      if (ages.size && !e.ageTiers.some((a) => ages.has(a))) return false;
      if (prices.size && !prices.has(e.priceTier)) return false;
      if (hoods.size && !hoods.has(e.neighborhood)) return false;
      if (!inDateRange(e.start, dateRange)) return false;
      if (env !== "any" && eventEnv(e) !== env) return false;
      if (needle && !`${e.title} ${e.description} ${e.venue}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    if (coords) {
      const d = (e: KidEvent) =>
        e.lat && e.lng ? (e.lat - coords.lat) ** 2 + (e.lng - coords.lng) ** 2 : Infinity;
      list.sort((a, b) => d(a) - d(b));
    }
    return list;
  }, [events, ages, prices, hoods, dateRange, onlyFavs, favs, coords, q, env]);

  // Reset the visible window whenever the filter set changes.
  useEffect(() => setVisible(PAGE), [ages, prices, hoods, dateRange, onlyFavs, coords, q, env]);

  // Auto-load more as the sentinel scrolls into view (infinite scroll).
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || view !== "list") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisible((v) => v + PAGE);
      },
      { rootMargin: "600px 0px" } // prefetch before it's actually visible
    );
    io.observe(el);
    return () => io.disconnect();
  }, [view, filtered.length]);

  const activeCount =
    ages.size + prices.size + hoods.size + (dateRange !== "any" ? 1 : 0) +
    (env !== "any" ? 1 : 0) + (q.trim() ? 1 : 0) + (onlyFavs ? 1 : 0);

  function clearAll() {
    setAgesPersist(new Set());
    setPrices(new Set());
    setHoods(new Set());
    setDateRange("any");
    setZip("");
    setZipNote("");
    setOnlyFavs(false);
    setCoords(null);
    setGeoMsg("");
    setQ("");
    setEnv("any");
  }

  return (
    <div>
      {/* Search + filters grouped in one soft panel, set apart from the
          results grid below to cut the "floating pills" clutter. */}
      <div className="rounded-blob border border-ink/10 bg-gradient-to-br from-white to-sand/70 p-4 shadow-sm sm:p-5">
      {/* Search (left half) + the 4 quick-picks inline (right half) */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr("search_ph")}
          aria-label="Search events"
          className="w-full rounded-full border-2 border-ink/15 bg-white px-5 py-3 font-700 text-ink/80 outline-none transition focus:border-teal sm:w-1/2"
        />
        <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
          <button onClick={() => { track("Quick Pick", { pick: "free_weekend" }); setPrices(new Set(["free"])); setDateRange("weekend"); }}
            className="hover-pop rounded-full bg-teal px-3.5 py-1.5 text-sm font-800 text-white shadow-pop">{tr("qp_free_weekend")}</button>
          <button onClick={() => { track("Quick Pick", { pick: "free_near" }); setPrices(new Set(["free"])); useMyLocation(); }}
            className="hover-pop rounded-full bg-coral px-3.5 py-1.5 text-sm font-800 text-white shadow-pop">{tr("qp_free_near")}</button>
          <button onClick={() => { track("Quick Pick", { pick: "today" }); setDateRange("today"); }}
            className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-700 transition ${dateRange === "today" ? "border-teal bg-teal text-white" : "border-ink/15 bg-white text-ink/70 hover:border-teal"}`}>{tr("qp_today")}</button>
          <button onClick={() => { if (!onlyFavs) track("Quick Pick", { pick: "my_list" }); setOnlyFavs((v) => !v); }}
            className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-800 transition ${onlyFavs ? "border-coral bg-coral text-white" : "border-ink/15 bg-white text-ink/70 hover:border-coral"}`}>
            {tr("my_list")}{favs.size ? ` (${favs.size})` : ""}
          </button>
        </div>
      </div>

      {/* Filters toggle — detailed filter rows live behind it to cut clutter. */}
      <div className="mb-3 flex">
        <button
          onClick={() => { if (!showFilters) track("Filters Opened"); setShowFilters((v) => !v); }}
          aria-expanded={showFilters}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-sm font-800 transition ${
            showFilters || activeCount
              ? "border-grape bg-grape text-white"
              : "border-ink/15 bg-white text-ink/70 hover:border-grape"
          }`}
        >
          <span>⚙</span>
          {showFilters ? tr("qp_hide_filters") : tr("qp_filters")}
          {activeCount > 0 && (
            <span className={`ml-0.5 rounded-full px-1.5 text-xs ${showFilters || activeCount ? "bg-white/25" : "bg-grape/15 text-grape"}`}>
              {activeCount}
            </span>
          )}
        </button>
      </div>
      {geoMsg && <p className="mb-3 text-sm font-700 text-teal-dark">{geoMsg}</p>}

      {/* Collapsible filter panel */}
      {showFilters && (
      <div className="animate-card-in mt-1 rounded-2xl bg-white/70 p-4 sm:p-5">
        <FilterRow label={tr("f_when")} scroll>
          {DATE_FILTERS.map((d) => (
            <Chip key={d.id} scroll active={dateRange === d.id} onClick={() => setDateRange(d.id)}>
              {dateLabel(d.id)}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label={tr("f_age")}>
          {AGE_TIERS.map((a) => {
            const L = ageLabel(lang, a.id);
            return (
              <Chip key={a.id} active={ages.has(a.id)} onClick={() => toggle(ages, a.id, setAgesPersist)}>
                {a.emoji} {L.label}
              </Chip>
            );
          })}
        </FilterRow>

        <FilterRow label={tr("f_price")}>
          {PRICE_TIERS.map((p) => (
            <Chip key={p.id} active={prices.has(p.id)} onClick={() => toggle(prices, p.id, setPrices)}>
              {p.emoji} {priceLabel(lang, p.id)}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label={tr("f_where")}>
          {([["any", tr("anywhere")], ["indoor", tr("indoor")], ["outdoor", tr("outdoor")]] as const).map(([id, label]) => (
            <Chip key={id} active={env === id} onClick={() => setEnv(id)}>{label}</Chip>
          ))}
        </FilterRow>

        <FilterRow label={tr("f_area")} scroll>
          {NEIGHBORHOODS.map((n) => (
            <Chip key={n.id} scroll active={hoods.has(n.id)} onClick={() => toggle(hoods, n.id, setHoods)}>
              {hoodLabel(lang, n.id).split(" / ")[0]}
            </Chip>
          ))}
        </FilterRow>

        {/* ZIP on its own clean row */}
        <FilterRow label={tr("f_near")} plain>
          <div className="flex flex-wrap items-center gap-2">
            <input
              inputMode="numeric"
              value={zip}
              onChange={(e) => applyZip(e.target.value)}
              placeholder={tr("zip_ph")}
              aria-label="Find events near a ZIP code"
              className="w-40 rounded-full border-2 border-ink/15 bg-white px-4 py-1.5 text-sm font-700 text-ink/80 outline-none transition focus:border-teal"
            />
            {zipNote && <span className="text-sm font-700 text-teal-dark">{zipNote}</span>}
          </div>
        </FilterRow>

        {activeCount > 0 && (
          <div className="mt-3 border-t border-ink/10 pt-3">
            <button
              onClick={clearAll}
              className="text-sm font-700 text-coral underline-offset-2 hover:underline"
            >
              {tr("clear_all")} ({activeCount})
            </button>
          </div>
        )}
      </div>
      )}
      </div>

      {/* Results header + view toggle */}
      <div className="mt-6 flex items-center justify-between">
        <p className="font-700 text-ink/70">
          {filtered.length} {filtered.length === 1 ? tr("event_1") : tr("events_n")}
        </p>
        <div className="flex rounded-full border-2 border-ink/15 bg-white p-1">
          {(["list", "calendar", "map"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1.5 text-sm font-800 capitalize transition sm:px-4 ${
                view === v ? "bg-teal text-white" : "text-ink/60"
              }`}
            >
              {v === "list" ? tr("v_list") : v === "calendar" ? tr("v_calendar") : tr("v_map")}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="mt-4">
        {filtered.length === 0 ? (
          <div className="rounded-blob border border-dashed border-ink/20 bg-white py-16 text-center text-ink/50">
            <p className="text-2xl">🔍</p>
            <p className="mt-2 font-700">{tr("no_match")}</p>
            <p className="text-sm">{tr("no_match_hint")}</p>
          </div>
        ) : view === "list" ? (
          <>
            <h2 className="sr-only">Upcoming events</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.slice(0, visible).map((e, i) => (
                <EventCard
                  key={e.id}
                  event={e}
                  index={i}
                  distanceMi={coords && e.lat && e.lng ? milesBetween(coords, { lat: e.lat, lng: e.lng }) : undefined}
                />
              ))}
            </div>
            {visible < filtered.length && (
              <div ref={sentinelRef} className="mt-8 flex items-center justify-center gap-2 py-4 text-ink/40">
                <span className="h-3 w-3 animate-bounce rounded-full bg-coral" />
                <span className="h-3 w-3 animate-bounce rounded-full bg-sunny" style={{ animationDelay: "0.15s" }} />
                <span className="h-3 w-3 animate-bounce rounded-full bg-teal" style={{ animationDelay: "0.3s" }} />
                <span className="ml-2 text-sm font-700">{tr("loading_more")}</span>
              </div>
            )}
          </>
        ) : view === "calendar" ? (
          <CalendarView events={filtered} />
        ) : (
          <MapView events={filtered} />
        )}
      </div>
    </div>
  );
}

function FilterRow({
  label,
  children,
  plain = false,
  scroll = false,
}: {
  label: string;
  children: React.ReactNode;
  plain?: boolean;
  // For rows with many options (When, Area): scroll horizontally on phones
  // rather than crushing 6 segments into illegible slivers.
  scroll?: boolean;
}) {
  return (
    <div className="mb-3 flex flex-col gap-1.5 last:mb-0 sm:flex-row sm:items-center sm:gap-3">
      <span className="shrink-0 font-display text-sm font-600 text-ink/50 sm:w-20">
        {label}
      </span>
      {plain ? (
        <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      ) : (
        // Continuous segmented bar — options stretch to fill equal widths so
        // every row is the same length and reads as one cohesive control.
        // Crowded rows (scroll) instead swipe sideways on mobile, then snap
        // back to the equal-fill bar at sm+.
        <div
          className={`flex flex-1 rounded-full border-2 border-ink/15 bg-white ${
            scroll
              ? "overflow-x-auto sm:overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : "overflow-hidden"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
