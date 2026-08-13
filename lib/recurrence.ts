// Helpers for recurring events. A recurring event stores one instance's Start
// (giving the time + weekday) plus a human label in `recurrence`. We compute the
// next real occurrence on the fly so the series never shows a stale past date.
//
// Civil-date math is always America/Los_Angeles — Cloudflare Workers are UTC,
// and evening PT events sit on the next UTC day.

const LA = "America/Los_Angeles";
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function laParts(d: Date) {
  const map: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone: LA,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    weekday: DOW.indexOf(map.weekday),
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function fromLosAngeles(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const civil = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;
  for (const off of ["-07:00", "-08:00"] as const) {
    const d = new Date(`${civil}${off}`);
    const p = laParts(d);
    if (p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute) {
      return d;
    }
  }
  return new Date(`${civil}-07:00`);
}

export function laDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function isRecurring(recurrence?: string): boolean {
  return Boolean(recurrence && recurrence.trim());
}

export function isListedEvent(
  event: { start: string; recurrence?: string },
  now: Date = new Date(),
): boolean {
  if (isRecurring(event.recurrence)) return true;
  return new Date(event.start).getTime() > now.getTime() - 86_400_000;
}

export function eventHasEnded(startIso: string, recurrence?: string, now: Date = new Date()): boolean {
  if (isRecurring(recurrence)) return false;
  return !isListedEvent({ start: startIso, recurrence }, now);
}

export function isDateCanceled(canceledDates: string[] | undefined, key: string): boolean {
  return Boolean(canceledDates && canceledDates.includes(key));
}

export function nextOccurrenceISO(
  startIso: string,
  recurrence?: string,
  canceledDates?: string[]
): string {
  const start = new Date(startIso);
  const now = new Date();
  if (!isRecurring(recurrence)) return startIso;

  const cancelled = canceledDates && canceledDates.length ? new Set(canceledDates) : null;
  const startP = laParts(start);
  const nowP = laParts(now);
  const daily = /daily|multiple days/i.test(recurrence!);
  const targetDow = startP.weekday;

  let y = nowP.year;
  let m = nowP.month;
  let d = nowP.day;
  if (start > now) {
    y = startP.year;
    m = startP.month;
    d = startP.day;
  }

  let guard = 0;
  while (guard < 120) {
    const instant = fromLosAngeles(y, m, d, startP.hour, startP.minute);
    const key = `${y}-${pad(m)}-${pad(d)}`;
    const rightDay = daily || laParts(instant).weekday === targetDow;
    if (rightDay && instant >= now && !(cancelled && cancelled.has(key))) {
      return instant.toISOString();
    }
    const next = fromLosAngeles(y, m, d, 12, 0);
    next.setUTCDate(next.getUTCDate() + 1);
    const np = laParts(next);
    y = np.year;
    m = np.month;
    d = np.day;
    guard++;
  }
  return fromLosAngeles(y, m, d, startP.hour, startP.minute).toISOString();
}

export function recursOnDay(
  startIso: string,
  recurrence: string | undefined,
  y: number,
  m: number,
  d: number,
  canceledDates?: string[]
): boolean {
  if (!isRecurring(recurrence)) return false;
  const startP = laParts(new Date(startIso));
  const cell = fromLosAngeles(y, m + 1, d, 12, 0);
  const startDay = fromLosAngeles(startP.year, startP.month, startP.day, 0, 0);
  if (cell < startDay) return false;
  const onDay = /daily|multiple days/i.test(recurrence!)
    ? true
    : laParts(cell).weekday === startP.weekday;
  if (!onDay) return false;
  if (canceledDates && canceledDates.length) {
    const key = `${y}-${pad(m + 1)}-${pad(d)}`;
    if (canceledDates.includes(key)) return false;
  }
  return true;
}
