"use client";

import { useCallback, useMemo, useState } from "react";
import type { KidEvent } from "@/lib/types";
import { priceTier } from "@/lib/constants";
import { recursOnDay } from "@/lib/recurrence";
import { EventCard } from "./EventCard";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PRICE_DOT: Record<string, string> = {
  free: "bg-teal",
  under10: "bg-sunny",
  mid: "bg-coral",
  premium: "bg-grape",
};
// Tinted label chips (used on larger screens instead of plain dots).
const PRICE_CHIP: Record<string, string> = {
  free: "bg-teal/15 text-teal-dark",
  under10: "bg-sunny/30 text-ink/80",
  mid: "bg-coral/15 text-coral-dark",
  premium: "bg-grape/15 text-grape",
};

// Day key in Las Vegas time, e.g. "2026-05-28".
const fmtKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function dayKey(iso: string) {
  return fmtKey.format(new Date(iso));
}
function keyOf(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function CalendarView({ events }: { events: KidEvent[] }) {
  // One-time events grouped by day; recurring events handled separately so they
  // appear on every matching day in the month.
  const { byDay, recurring } = useMemo(() => {
    const map = new Map<string, KidEvent[]>();
    const rec: KidEvent[] = [];
    for (const e of events) {
      if (e.recurrence) {
        rec.push(e);
        continue;
      }
      const k = dayKey(e.start);
      (map.get(k) ?? map.set(k, []).get(k)!).push(e);
    }
    return { byDay: map, recurring: rec };
  }, [events]);

  // All events (one-time + recurring) that land on a given calendar day.
  const eventsForDay = useCallback(
    (y: number, m: number, d: number): KidEvent[] => {
      const oneTime = byDay.get(keyOf(y, m, d)) ?? [];
      const rec = recurring.filter((e) => recursOnDay(e.start, e.recurrence, y, m, d));
      return [...oneTime, ...rec];
    },
    [byDay, recurring]
  );

  // Start on the month of the first upcoming event (fallback: today).
  const firstMonth = useMemo(() => {
    const earliest = events.reduce<string | null>(
      (a, e) => (!a || e.start < a ? e.start : a),
      null
    );
    const d = earliest ? new Date(earliest) : new Date();
    const parts = fmtKey.formatToParts(d);
    const y = Number(parts.find((p) => p.type === "year")!.value);
    const m = Number(parts.find((p) => p.type === "month")!.value) - 1;
    return { y, m };
  }, [events]);

  const [view, setView] = useState(firstMonth);
  const todayKey = dayKey(new Date().toISOString());
  const [selected, setSelected] = useState<string>(todayKey);

  const { y, m } = view;
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const monthLabel = new Date(y, m, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function shiftMonth(delta: number) {
    const d = new Date(y, m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  }

  const [sy, sm, sd] = selected.split("-").map(Number);
  const selectedEvents = eventsForDay(sy, sm - 1, sd)
    .slice()
    .sort((a, b) => a.start.slice(11).localeCompare(b.start.slice(11)));

  return (
    <div>
      <div className="rounded-blob border border-ink/10 bg-white p-3 shadow-card sm:p-5">
        {/* Month nav */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <button onClick={() => shiftMonth(-1)}
            className="flex items-center gap-1 rounded-full border-2 border-ink/15 px-3 py-1.5 text-sm font-800 text-ink/60 transition hover:border-teal hover:text-teal">
            ‹ {new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" })}
          </button>
          <h2 className="font-display text-lg font-700 sm:text-xl">{monthLabel}</h2>
          <button onClick={() => shiftMonth(1)}
            className="flex items-center gap-1 rounded-full border-2 border-ink/15 px-3 py-1.5 text-sm font-800 text-ink/60 transition hover:border-teal hover:text-teal">
            {new Date(y, m + 1, 1).toLocaleDateString("en-US", { month: "short" })} ›
          </button>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-800 text-ink/40">
          {DOW.map((d) => (
            <div key={d} className="py-1">
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`b${i}`} />;
            const k = keyOf(y, m, day);
            const dayEvents = eventsForDay(y, m, day);
            const isToday = k === todayKey;
            const isSelected = k === selected;
            return (
              <button
                key={k}
                onClick={() => setSelected(k)}
                className={`flex aspect-square flex-col items-center rounded-xl border-2 p-1 text-left align-top transition sm:aspect-auto sm:items-stretch ${
                  dayEvents.length ? "sm:min-h-[9rem]" : "sm:min-h-[4.5rem]"
                } ${
                  isSelected
                    ? "border-teal bg-teal/10"
                    : dayEvents.length
                    ? "border-ink/10 bg-sand hover:border-teal/50"
                    : "border-transparent hover:bg-sand"
                }`}
              >
                <span className={`self-center text-xs font-800 sm:self-start sm:text-sm ${isToday ? "flex h-5 w-5 items-center justify-center rounded-full bg-coral text-white" : "text-ink/70"}`}>
                  {day}
                </span>

                {dayEvents.length > 0 && (
                  <>
                    {/* Mobile: compact dots */}
                    <span className="mt-auto flex flex-wrap items-center justify-center gap-0.5 pb-0.5 sm:hidden">
                      {dayEvents.slice(0, 4).map((e, j) => (
                        <span key={j} className={`h-1.5 w-1.5 rounded-full ${PRICE_DOT[e.priceTier] || "bg-ink/40"}`} />
                      ))}
                    </span>
                    {/* Larger: up to ~6 event title labels */}
                    <span className="mt-1 hidden flex-col gap-0.5 sm:flex">
                      {dayEvents.slice(0, 6).map((e, j) => (
                        <span key={j} title={e.title}
                          className={`truncate rounded px-1 py-0.5 text-[10px] font-700 leading-tight ${PRICE_CHIP[e.priceTier] || "bg-ink/10 text-ink/70"}`}>
                          {e.recurrence ? "🔁 " : ""}{e.title}
                        </span>
                      ))}
                      {dayEvents.length > 6 && (
                        <span className="px-1 text-[10px] font-800 text-ink/45">+{dayEvents.length - 6} more</span>
                      )}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3 border-t border-ink/10 pt-3 text-xs font-700 text-ink/50">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal" /> Free</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sunny" /> $1–10</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-coral" /> $11–25</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-grape" /> $25+</span>
        </div>
      </div>

      {/* Selected-day events */}
      <div className="mt-6">
        <h3 className="font-display text-lg font-700">
          {new Date(selected + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          <span className="ml-2 text-base font-600 text-ink/50">
            {selectedEvents.length} {selectedEvents.length === 1 ? "event" : "events"}
          </span>
        </h3>
        {selectedEvents.length === 0 ? (
          <div className="mt-3 rounded-blob border border-dashed border-ink/20 bg-white py-12 text-center text-ink/50">
            <p className="text-2xl">🗓️</p>
            <p className="mt-2 font-700">Nothing on this day.</p>
            <p className="text-sm">Tap a day with dots to see what&apos;s on.</p>
          </div>
        ) : (
          <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {selectedEvents.map((e, i) => (
              <EventCard key={e.id} event={e} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
