import type { KidEvent } from "./types";

// Most scraped events don't carry the indoor/outdoor flag, so infer it from
// venue + title keywords. Indoor signals (library, museum, theater…) are
// checked first because they're reliable even when the venue name also
// contains an outdoor-ish word (e.g. "Centennial Hills Park Library").
// Returns "indoor" | "outdoor" | null (genuinely unknown).
const INDOOR_RE =
  /library|museum|\bcenter\b|indoor|gallery|theat(er|re)|studio|\bgym\b|arena|hall|academy|clinic|store|shop|mall/i;
const OUTDOOR_RE =
  /\bpark\b|trail|\bpool\b|splash|garden|farmers? market|festival|outdoor|plaza|field|preserve|\bhike\b|amphitheater|ballfield|playground|courtyard/i;

export function eventEnv(e: KidEvent): "indoor" | "outdoor" | null {
  if (e.indoor === true) return "indoor";
  if (e.indoor === false) return "outdoor";
  const t = `${e.title} ${e.venue}`;
  if (INDOOR_RE.test(t)) return "indoor";
  if (OUTDOOR_RE.test(t)) return "outdoor";
  return null;
}
