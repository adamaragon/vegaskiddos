// Heuristic classification for scraped events. Imperfect by design — every
// scraped event lands in the Airtable review queue (Approved=false), so a
// human corrects anything the heuristics get wrong before it goes live.

export type AgeTierId = "baby" | "toddler" | "kids" | "tweens";
export type PriceTierId = "free" | "under10" | "mid" | "premium";
export type NeighborhoodId =
  | "summerlin"
  | "henderson"
  | "north-lv"
  | "spring-valley"
  | "enterprise"
  | "downtown";

// Centers mirror lib/constants.ts (kept local so the scraper bundle has no
// dependency on Next app code).
const CENTERS: { id: NeighborhoodId; lat: number; lng: number }[] = [
  { id: "summerlin", lat: 36.1716, lng: -115.3286 },
  { id: "henderson", lat: 36.0395, lng: -114.9817 },
  { id: "north-lv", lat: 36.2333, lng: -115.1394 },
  { id: "spring-valley", lat: 36.0828, lng: -115.2628 },
  { id: "enterprise", lat: 36.0269, lng: -115.2547 },
  { id: "downtown", lat: 36.1663, lng: -115.1391 },
];

export function nearestNeighborhood(
  lat?: number | null,
  lng?: number | null
): NeighborhoodId | null {
  if (!lat || !lng) return null;
  let best: NeighborhoodId | null = null;
  let bestD = Infinity;
  for (const c of CENTERS) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c.id;
    }
  }
  // Guard: if the point is wildly outside the valley (>~40mi), reject.
  return bestD < 0.4 ? best : null;
}

export function neighborhoodFromZip(zip?: string | null): NeighborhoodId | null {
  if (!zip) return null;
  const z = zip.slice(0, 5);
  const map: Record<string, NeighborhoodId> = {
    // Summerlin / NW
    "89134": "summerlin", "89135": "summerlin", "89138": "summerlin",
    "89144": "summerlin", "89145": "summerlin",
    // Henderson
    "89002": "henderson", "89011": "henderson", "89012": "henderson",
    "89014": "henderson", "89015": "henderson", "89052": "henderson", "89074": "henderson",
    // North LV
    "89030": "north-lv", "89031": "north-lv", "89032": "north-lv", "89084": "north-lv", "89081": "north-lv",
    // Spring Valley
    "89117": "spring-valley", "89146": "spring-valley", "89147": "spring-valley", "89103": "spring-valley",
    // Enterprise / SW
    "89113": "enterprise", "89139": "enterprise", "89141": "enterprise",
    "89148": "enterprise", "89178": "enterprise", "89183": "enterprise", "89044": "enterprise",
    // Downtown / central
    "89101": "downtown", "89104": "downtown", "89106": "downtown", "89107": "downtown", "89102": "downtown",
  };
  return map[z] ?? null;
}

const FREE_RE = /\bfree\b|no cost|complimentary|\$0\b/i;

export function classifyPrice(
  cost?: string | null,
  text?: string
): PriceTierId | null {
  const c = (cost || "").trim();
  const blob = `${c} ${text || ""}`;
  if (!c && FREE_RE.test(text || "")) return "free";
  if (!c) return null; // unknown — let the reviewer decide
  if (FREE_RE.test(c)) return "free";
  const nums = (c.match(/\$?\s*(\d+(?:\.\d{1,2})?)/g) || [])
    .map((s) => parseFloat(s.replace(/[^\d.]/g, "")))
    .filter((n) => !isNaN(n));
  if (!nums.length) return FREE_RE.test(blob) ? "free" : null;
  const max = Math.max(...nums);
  if (max === 0) return "free";
  if (max <= 10) return "under10";
  if (max <= 25) return "mid";
  return "premium";
}

export function classifyAges(text: string): AgeTierId[] {
  const t = text.toLowerCase();
  const ages = new Set<AgeTierId>();
  if (/\bbab(y|ies)\b|infant|newborn|lapsit|lap sit|0-1|0 - 1|under 1/.test(t))
    ages.add("baby");
  if (/toddler|pre-?k\b|preschool|pre-school|little ones|2-3|ages 2|ages 1/.test(t))
    ages.add("toddler");
  if (/\bkids?\b|child|children|elementary|youth|grade|school age|ages 5|ages 6|ages 7|ages 8/.test(t))
    ages.add("kids");
  if (/tween|teen|middle school|ages 11|ages 12|ages 13|12\+/.test(t))
    ages.add("tweens");
  // "family" / "all ages" → broad
  if (!ages.size && /family|all ages|all-ages/.test(t)) {
    ages.add("toddler");
    ages.add("kids");
  }
  return [...ages];
}

const KID_INCLUDE =
  /\b(kid|kids|child|children|family|families|toddler|baby|babies|infant|storytime|story time|preschool|pre-?k|all ages|youth|tween|teen|sensory|lego|stem|craft|crafts|puppet|dino|story ?hour|read|reading|music & movement|sing|petting|playgroup|playdate|mommy|daddy|parent|nursery|junior)\b/i;

const ADULT_EXCLUDE =
  /\b(21\+|18\+|nightclub|night club|bar crawl|pub crawl|wine|winery|beer|brewery|cocktail|happy hour|ladies night|burlesque|casino|gambling|poker|blackjack|dispensary|cannabis|420|adult only|adults only|bogo|brunch|dating|singles|speed dating|hookah|vape|strip club|topless)\b/i;

export function isKidRelevant(
  text: string,
  categories: string[] = []
): boolean {
  const catBlob = categories.join(" ").toLowerCase();
  if (ADULT_EXCLUDE.test(text)) return false;
  if (/kids|moms|family|all ages|parks/.test(catBlob)) return true;
  return KID_INCLUDE.test(text);
}

export function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8211;|&#8212;/g, "–")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
