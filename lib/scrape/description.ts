// Shared threshold for "has a real description" — used by upsert (don't clobber)
// and fill-blank-descriptions (generate when under this length).
export const DESCRIPTION_MIN_LEN = 15;

export function hasSubstantialDescription(text: string | undefined | null): boolean {
  return (text || "").trim().length >= DESCRIPTION_MIN_LEN;
}
