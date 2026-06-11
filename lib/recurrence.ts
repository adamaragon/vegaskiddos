// Helpers for recurring events. A recurring event stores one instance's Start
// (giving the time + weekday) plus a human label in `recurrence`. We compute the
// next real occurrence on the fly so the series never shows a stale past date.
//
// A series can have INDIVIDUAL occurrences cancelled (e.g. the library cancels
// next Tuesday's storytime but the weekly series continues). Those are recorded
// as `canceledDates` — a list of "YYYY-MM-DD" Las Vegas calendar days — and the
// helpers below skip them, so a single cancelled instance never removes the
// whole series; it just drops that one date.

// Las Vegas calendar day ("YYYY-MM-DD") for an instant — the canonical key for
// matching a cancelled occurrence to a computed one regardless of how the source
// ISO was formatted (Z vs offset).
export function laDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function isRecurring(recurrence?: string): boolean {
  return Boolean(recurrence && recurrence.trim());
}

export function isDateCanceled(canceledDates: string[] | undefined, key: string): boolean {
  return Boolean(canceledDates && canceledDates.includes(key));
}

// Returns the next occurrence ISO at/after now, SKIPPING any cancelled dates.
// For one-time (or still-upcoming non-recurring) events this is just the stored
// start (one-time cancellations use the whole-event `canceled` flag instead).
export function nextOccurrenceISO(
  startIso: string,
  recurrence?: string,
  canceledDates?: string[]
): string {
  const start = new Date(startIso);
  const now = new Date();
  if (!isRecurring(recurrence)) return startIso;

  const cancelled = canceledDates && canceledDates.length ? new Set(canceledDates) : null;
  const isCancelled = (d: Date) => (cancelled ? cancelled.has(laDateKey(d)) : false);

  // Start from the stored instance; if it's in the past, move it to today first
  // (keeping the time-of-day), then walk forward to the next valid occurrence.
  const result = new Date(start);
  if (start < now) {
    result.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
  }
  const daily = /daily|multiple days/i.test(recurrence!);
  const targetDow = start.getDay();

  // Advance day-by-day to the next slot that is the right weekday (weekly),
  // on/after now, and not cancelled. Guard covers several cancelled weeks.
  let guard = 0;
  while (guard < 120) {
    const rightDay = daily || result.getDay() === targetDow;
    if (rightDay && result >= now && !isCancelled(result)) return result.toISOString();
    result.setDate(result.getDate() + 1);
    result.setHours(start.getHours(), start.getMinutes(), 0, 0);
    guard++;
  }
  return result.toISOString();
}

// Does a weekly/daily recurring event fall on a given calendar day (y, m, d)?
// A cancelled occurrence on that day returns false (it doesn't happen).
export function recursOnDay(
  startIso: string,
  recurrence: string | undefined,
  y: number,
  m: number,
  d: number,
  canceledDates?: string[]
): boolean {
  if (!isRecurring(recurrence)) return false;
  const cell = new Date(y, m, d);
  const start = new Date(startIso);
  // Only from the series' first date onward.
  if (cell < new Date(start.getFullYear(), start.getMonth(), start.getDate())) return false;
  const onDay = /daily|multiple days/i.test(recurrence!) ? true : cell.getDay() === start.getDay();
  if (!onDay) return false;
  // Skip a specifically-cancelled occurrence. Compare the calendar cell directly
  // (the canceledDates are calendar days, same basis as the grid).
  if (canceledDates && canceledDates.length) {
    const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (canceledDates.includes(key)) return false;
  }
  return true;
}
