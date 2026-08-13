import type { KidEvent } from "./types";

const STREET_SUFFIX =
  "(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|Lane|Ln|Way|Parkway|Pkwy|Court|Ct|Place|Pl|Circle|Cir|Highway|Hwy|Terrace|Ter|Trail|Trl|Loop|Plaza)\\.?";

const DIR = "(?:North|South|East|West|[NSEW])\\.?";

// Trailing N/S/E/W only when it is a compass token, not the start of "Suite".
const TRAILING_DIR = `(?:\\s+${DIR}(?=\\s*(?:$|[,.]|\\bin\\b)))`;

// Numbered US-style street: "900 Las Vegas Blvd N", "27 S Stephanie St",
// "4215 S Grand Canyon Drive", "2651 Paseo Verde Parkway Suite 180".
const STREET_RE = new RegExp(
  String.raw`\b(\d{1,6}(?:-\d{1,6})?\s+` +
    String.raw`(?:${DIR}\s+)?` +
    String.raw`[A-Za-z0-9][A-Za-z0-9.'-]*(?:\s+[A-Za-z0-9][A-Za-z0-9.'-]*){0,4}\s+` +
    STREET_SUFFIX +
    String.raw`${TRAILING_DIR}?` +
    String.raw`(?:\s+(?:Suite|Ste|Unit|#)\.?\s*[A-Za-z0-9-]+)?)`,
  "i",
);

const COMPACT_MAX = 90;

function compact(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function isCompactLabel(s: string): boolean {
  return s.length > 0 && s.length <= COMPACT_MAX && !/[\n\r]/.test(s);
}

/** First numbered street-like snippet, or empty. Never returns a whole blurb. */
export function firstStreetFromText(text: string): string {
  const m = compact(text).match(STREET_RE);
  if (!m) return "";
  const street = compact(m[1]);
  return street.length <= COMPACT_MAX ? street : "";
}

function fromDedicated(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (isCompactLabel(value)) return compact(value);
  return firstStreetFromText(value);
}

/**
 * Place line for listing cards: venue, then address, then a street parsed
 * from the description. Empty when nothing trustworthy exists.
 */
export function cardPlaceLabel(
  event: Pick<KidEvent, "venue" | "address" | "description">,
): string {
  const venue = fromDedicated(event.venue || "");
  if (venue) return venue;

  const address = fromDedicated(event.address || "");
  if (address) return address;

  return firstStreetFromText(event.description || "");
}
