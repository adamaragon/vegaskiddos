// Shared iCal (.ics) parsing helpers. Used by any source that exposes a
// standard iCalendar feed (Communico libraries, Google Calendar, etc.).

// Unfold iCal lines (continuation lines start with a space/tab) and split
// into VEVENT records keyed by property name (params like ;TZID= are dropped).
export function parseIcal(ics: string): Record<string, string>[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events: Record<string, string>[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") {
      if (cur) events.push(cur);
      cur = null;
    } else if (cur) {
      const i = line.indexOf(":");
      if (i > 0) {
        const key = line.slice(0, i).split(";")[0]; // drop params like ;TZID=
        cur[key] = line.slice(i + 1);
      }
    }
  }
  return events;
}

export function unescapeIcal(v: string): string {
  return v
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

// "20260602T173000Z" -> proper UTC ISO. The trailing Z is genuine UTC, so we
// keep it as UTC and let display (America/Los_Angeles) convert (17:30Z = 10:30 AM
// PDT). Floating times (no Z) are assumed Pacific.
export function icalToIso(dt: string): string | undefined {
  const m = dt.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) {
    // All-day dates (VALUE=DATE) arrive as YYYYMMDD with no time component.
    const d = dt.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (d) return `${d[1]}-${d[2]}-${d[3]}T00:00:00-07:00`;
    return undefined;
  }
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  const month = Number(mo);
  const offset = month >= 3 && month <= 10 ? "-07:00" : "-08:00"; // rough DST
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`;
}
