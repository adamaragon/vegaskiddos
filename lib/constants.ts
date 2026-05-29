// Shared taxonomy for Vegas Kiddos — ages, prices, neighborhoods.

export const AGE_TIERS = [
  { id: "baby", label: "Baby", sublabel: "0–1 yr", emoji: "👶" },
  { id: "toddler", label: "Toddler", sublabel: "1–3 yr", emoji: "🧸" },
  { id: "kids", label: "Kids", sublabel: "3–12 yr", emoji: "🎨" },
  { id: "tweens", label: "Tweens", sublabel: "12+ yr", emoji: "🛹" },
] as const;

export type AgeTierId = (typeof AGE_TIERS)[number]["id"];

export const PRICE_TIERS = [
  { id: "free", label: "Free", emoji: "🆓", color: "teal" },
  { id: "under10", label: "$1–10", emoji: "💵", color: "sunny" },
  { id: "mid", label: "$11–25", emoji: "💳", color: "coral" },
  { id: "premium", label: "$25+", emoji: "✨", color: "grape" },
] as const;

export type PriceTierId = (typeof PRICE_TIERS)[number]["id"];

export const NEIGHBORHOODS = [
  { id: "summerlin", label: "Summerlin / West", center: [36.1716, -115.3286] },
  { id: "henderson", label: "Henderson / Southeast", center: [36.0395, -114.9817] },
  { id: "north-lv", label: "North Las Vegas", center: [36.2333, -115.1394] },
  { id: "spring-valley", label: "Spring Valley", center: [36.0828, -115.2628] },
  { id: "enterprise", label: "Enterprise / Southwest", center: [36.0269, -115.2547] },
  { id: "downtown", label: "Downtown / Arts District", center: [36.1663, -115.1391] },
] as const;

export type NeighborhoodId = (typeof NEIGHBORHOODS)[number]["id"];

export const LV_CENTER: [number, number] = [36.1147, -115.1728];

// Las Vegas ZIP → primary neighborhood (client-safe; mirrors the scraper map).
const ZIP_TO_NEIGHBORHOOD: Record<string, NeighborhoodId> = {
  "89134": "summerlin", "89135": "summerlin", "89138": "summerlin", "89144": "summerlin", "89145": "summerlin", "89128": "summerlin", "89129": "summerlin",
  "89002": "henderson", "89011": "henderson", "89012": "henderson", "89014": "henderson", "89015": "henderson", "89052": "henderson", "89074": "henderson", "89044": "henderson",
  "89030": "north-lv", "89031": "north-lv", "89032": "north-lv", "89084": "north-lv", "89081": "north-lv", "89086": "north-lv", "89085": "north-lv",
  "89117": "spring-valley", "89146": "spring-valley", "89147": "spring-valley", "89103": "spring-valley", "89102": "spring-valley", "89148": "spring-valley",
  "89113": "enterprise", "89139": "enterprise", "89141": "enterprise", "89178": "enterprise", "89183": "enterprise", "89123": "enterprise",
  "89101": "downtown", "89104": "downtown", "89106": "downtown", "89107": "downtown", "89109": "downtown", "89169": "downtown",
};

// Geographic adjacency for "this area + nearby".
const NEARBY: Record<NeighborhoodId, NeighborhoodId[]> = {
  summerlin: ["spring-valley", "downtown"],
  "spring-valley": ["summerlin", "enterprise", "downtown"],
  enterprise: ["spring-valley", "henderson"],
  henderson: ["enterprise", "downtown"],
  "north-lv": ["downtown"],
  downtown: ["north-lv", "spring-valley", "summerlin", "henderson"],
};

// Returns the neighborhoods to filter for a given ZIP: its own + adjacent.
export function neighborhoodsForZip(zip: string): NeighborhoodId[] {
  const primary = ZIP_TO_NEIGHBORHOOD[zip.slice(0, 5)];
  if (!primary) return [];
  return [primary, ...NEARBY[primary]];
}

export const venueSlug = (v: string) =>
  (v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function priceTier(id: PriceTierId) {
  return PRICE_TIERS.find((p) => p.id === id)!;
}
export function ageTier(id: AgeTierId) {
  return AGE_TIERS.find((a) => a.id === id)!;
}
export function neighborhood(id: NeighborhoodId) {
  return NEIGHBORHOODS.find((n) => n.id === id)!;
}
