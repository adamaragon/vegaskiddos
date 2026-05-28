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

export function priceTier(id: PriceTierId) {
  return PRICE_TIERS.find((p) => p.id === id)!;
}
export function ageTier(id: AgeTierId) {
  return AGE_TIERS.find((a) => a.id === id)!;
}
export function neighborhood(id: NeighborhoodId) {
  return NEIGHBORHOODS.find((n) => n.id === id)!;
}
