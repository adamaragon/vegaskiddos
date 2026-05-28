"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { KidEvent } from "@/lib/types";
import { EventCard } from "./EventCard";
import {
  AGE_TIERS,
  PRICE_TIERS,
  NEIGHBORHOODS,
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

type View = "list" | "map";

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

  function toggle<T>(set: Set<T>, value: T, update: (s: Set<T>) => void) {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    update(next);
  }

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (ages.size && !e.ageTiers.some((a) => ages.has(a))) return false;
      if (prices.size && !prices.has(e.priceTier)) return false;
      if (hoods.size && !hoods.has(e.neighborhood)) return false;
      return true;
    });
  }, [events, ages, prices, hoods]);

  const activeCount = ages.size + prices.size + hoods.size;

  return (
    <div>
      {/* Filter panel */}
      <div className="rounded-blob border border-ink/10 bg-white p-5 shadow-card">
        <FilterRow label="Age">
          {AGE_TIERS.map((a) => (
            <Chip
              key={a.id}
              active={ages.has(a.id)}
              onClick={() => toggle(ages, a.id, setAges)}
            >
              {a.emoji} {a.label}{" "}
              <span className="font-400 opacity-70">{a.sublabel}</span>
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Price">
          {PRICE_TIERS.map((p) => (
            <Chip
              key={p.id}
              active={prices.has(p.id)}
              onClick={() => toggle(prices, p.id, setPrices)}
            >
              {p.emoji} {p.label}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Area">
          {NEIGHBORHOODS.map((n) => (
            <Chip
              key={n.id}
              active={hoods.has(n.id)}
              onClick={() => toggle(hoods, n.id, setHoods)}
            >
              {n.label}
            </Chip>
          ))}
        </FilterRow>

        {activeCount > 0 && (
          <button
            onClick={() => {
              setAges(new Set());
              setPrices(new Set());
              setHoods(new Set());
            }}
            className="mt-1 text-sm font-700 text-coral underline-offset-2 hover:underline"
          >
            Clear all filters ({activeCount})
          </button>
        )}
      </div>

      {/* Results header + view toggle */}
      <div className="mt-6 flex items-center justify-between">
        <p className="font-700 text-ink/70">
          {filtered.length} {filtered.length === 1 ? "event" : "events"}
        </p>
        <div className="flex rounded-full border-2 border-ink/15 bg-white p-1">
          {(["list", "map"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-4 py-1.5 text-sm font-800 capitalize transition ${
                view === v ? "bg-teal text-white" : "text-ink/60"
              }`}
            >
              {v === "list" ? "📋 List" : "🗺️ Map"}
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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
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
    <div className="mb-3 flex flex-col gap-2 last:mb-0 sm:flex-row sm:items-center">
      <span className="w-14 shrink-0 font-display text-sm font-600 text-ink/50">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
