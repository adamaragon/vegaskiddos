"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { KidEvent } from "@/lib/types";
import { EventCard } from "./EventCard";
import {
  AGE_TIERS,
  PRICE_TIERS,
  NEIGHBORHOODS,
  neighborhoodsForZip,
  neighborhood as hoodById,
  type AgeTierId,
  type PriceTierId,
  type NeighborhoodId,
} from "@/lib/constants";

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
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-700 transition ${
        active
          ? "border-coral bg-coral text-white shadow-pop"
          : "border-ink/15 bg-white text-ink/70 hover:border-coral/50"
      }`}
    >
      {children}
    </button>
  );
}

export function EventBrowser({ events }: { events: KidEvent[] }) {
  const [view, setView] = useState<View>("list");
  const [ages, setAges] = useState<Set<AgeTierId>>(new Set());
  const [prices, setPrices] = useState<Set<PriceTierId>>(new Set());
  const [hoods, setHoods] = useState<Set<NeighborhoodId>>(new Set());
  const [dateRange, setDateRange] = useState<DateRangeId>("any");
  const [zip, setZip] = useState("");
  const [zipNote, setZipNote] = useState("");

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
        setZipNote(`Showing ${near.map((n) => hoodById(n).label.split(" / ")[0]).join(", ")} near ${z}`);
      } else {
        setZipNote(`We don't recognize ${z} yet — try picking an area below.`);
      }
    } else {
      setZipNote("");
    }
  }

  const PAGE = 30;
  const [visible, setVisible] = useState(PAGE);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (ages.size && !e.ageTiers.some((a) => ages.has(a))) return false;
      if (prices.size && !prices.has(e.priceTier)) return false;
      if (hoods.size && !hoods.has(e.neighborhood)) return false;
      if (!inDateRange(e.start, dateRange)) return false;
      return true;
    });
  }, [events, ages, prices, hoods, dateRange]);

  // Reset the visible window whenever the filter set changes.
  useEffect(() => setVisible(PAGE), [ages, prices, hoods, dateRange]);

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
    ages.size + prices.size + hoods.size + (dateRange !== "any" ? 1 : 0);

  function clearAll() {
    setAges(new Set());
    setPrices(new Set());
    setHoods(new Set());
    setDateRange("any");
    setZip("");
    setZipNote("");
  }

  return (
    <div>
      {/* Filter panel */}
      <div className="rounded-blob border border-ink/10 bg-white p-4 shadow-card sm:p-6">
        <FilterRow label="When">
          {DATE_FILTERS.map((d) => (
            <Chip key={d.id} active={dateRange === d.id} onClick={() => setDateRange(d.id)}>
              {d.label}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Age">
          {AGE_TIERS.map((a) => (
            <Chip key={a.id} active={ages.has(a.id)} onClick={() => toggle(ages, a.id, setAges)}>
              {a.emoji} {a.label} <span className="font-400 opacity-90">{a.sublabel}</span>
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Price">
          {PRICE_TIERS.map((p) => (
            <Chip key={p.id} active={prices.has(p.id)} onClick={() => toggle(prices, p.id, setPrices)}>
              {p.emoji} {p.label}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Area">
          {NEIGHBORHOODS.map((n) => (
            <Chip key={n.id} active={hoods.has(n.id)} onClick={() => toggle(hoods, n.id, setHoods)}>
              {n.label}
            </Chip>
          ))}
        </FilterRow>

        {/* ZIP on its own clean row */}
        <FilterRow label="Near you">
          <div className="flex flex-wrap items-center gap-2">
            <input
              inputMode="numeric"
              value={zip}
              onChange={(e) => applyZip(e.target.value)}
              placeholder="Enter ZIP code"
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
              ✕ Clear all filters ({activeCount})
            </button>
          </div>
        )}
      </div>

      {/* Results header + view toggle */}
      <div className="mt-6 flex items-center justify-between">
        <p className="font-700 text-ink/70">
          {filtered.length} {filtered.length === 1 ? "event" : "events"}
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
              {v === "list" ? "📋 List" : v === "calendar" ? "📅 Calendar" : "🗺️ Map"}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="mt-4">
        {filtered.length === 0 ? (
          <div className="rounded-blob border border-dashed border-ink/20 bg-white py-16 text-center text-ink/50">
            <p className="text-2xl">🔍</p>
            <p className="mt-2 font-700">No events match those filters.</p>
            <p className="text-sm">Try clearing a filter or two.</p>
          </div>
        ) : view === "list" ? (
          <>
            <h2 className="sr-only">Upcoming events</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.slice(0, visible).map((e, i) => (
                <EventCard key={e.id} event={e} index={i} />
              ))}
            </div>
            {visible < filtered.length && (
              <div ref={sentinelRef} className="mt-8 flex items-center justify-center gap-2 py-4 text-ink/40">
                <span className="h-3 w-3 animate-bounce rounded-full bg-coral" />
                <span className="h-3 w-3 animate-bounce rounded-full bg-sunny" style={{ animationDelay: "0.15s" }} />
                <span className="h-3 w-3 animate-bounce rounded-full bg-teal" style={{ animationDelay: "0.3s" }} />
                <span className="ml-2 text-sm font-700">Loading more fun…</span>
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
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-1.5 last:mb-0 sm:flex-row sm:items-start sm:gap-3">
      <span className="shrink-0 pt-1.5 font-display text-sm font-600 text-ink/50 sm:w-20">
        {label}
      </span>
      <div className="flex flex-1 flex-wrap gap-2">{children}</div>
    </div>
  );
}
