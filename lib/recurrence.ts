// Helpers for recurring events. A recurring event stores one instance's Start
// (giving the time + weekday) plus a human label in `recurrence`. We compute the
// next real occurrence on the fly so the series never shows a stale past date.

export function isRecurring(recurrence?: string): boolean {
  return Boolean(recurrence && recurrence.trim());
}

// Returns the next occurrence ISO at/after now. For one-time (or still-upcoming)
// events this is just the stored start.
export function nextOccurrenceISO(startIso: string, recurrence?: string): string {
  const start = new Date(startIso);
  const now = new Date();
  if (!isRecurring(recurrence) || start >= now) return startIso;

  const result = new Date(start);
  result.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());

  if (/daily|multiple days/i.test(recurrence!)) {
    if (result < now) result.setDate(result.getDate() + 1);
    return result.toISOString();
  }
  // Weekly: advance to the original weekday, on/after today.
  const targetDow = start.getDay();
  let guard = 0;
  while ((result.getDay() !== targetDow || result < now) && guard < 14) {
    result.setDate(result.getDate() + 1);
    guard++;
  }
  return result.toISOString();
}

// Does a weekly/daily recurring event fall on a given calendar day (y, m, d)?
export function recursOnDay(
  startIso: string,
  recurrence: string | undefined,
  y: number,
  m: number,
  d: number
): boolean {
  if (!isRecurring(recurrence)) return false;
  const cell = new Date(y, m, d);
  const start = new Date(startIso);
  // Only from the series' first date onward.
  if (cell < new Date(start.getFullYear(), start.getMonth(), start.getDate())) return false;
  if (/daily|multiple days/i.test(recurrence!)) return true;
  return cell.getDay() === start.getDay(); // weekly
}
