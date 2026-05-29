// Lightweight bilingual support (English / Spanish). Locale is stored in the
// `vk_lang` cookie; server components read it and render the right strings, the
// LangToggle sets it and reloads. Event titles/descriptions are translated at
// scrape time and stored in Airtable (TitleEs/DescriptionEs); the data layer
// swaps them in when lang === "es".

import {
  AGE_TIERS,
  PRICE_TIERS,
  NEIGHBORHOODS,
  type AgeTierId,
  type PriceTierId,
  type NeighborhoodId,
} from "./constants";

export type Lang = "en" | "es";

export const STRINGS = {
  // header / nav
  nav_events: { en: "Events", es: "Eventos" },
  nav_ideas: { en: "Ideas", es: "Ideas" },
  nav_about: { en: "About", es: "Acerca de" },
  nav_add: { en: "+ Add an event", es: "+ Añadir evento" },
  nav_add_short: { en: "+ Add", es: "+ Añadir" },
  // hero
  hero_title: { en: "Kid-safe fun, all over Las Vegas.", es: "Diversión segura para niños, por todo Las Vegas." },
  hero_sub: {
    en: "Find the right event for the right little human — sorted by age, price, and neighborhood. Made by local parents, for local parents.",
    es: "Encuentra el evento ideal para cada pequeño — por edad, precio y vecindario. Hecho por papás locales, para papás locales.",
  },
  // CTA
  cta_title: { en: "Know a great kid event?", es: "¿Conoces un buen evento para niños?" },
  cta_sub: {
    en: "Help other Vegas families find it. Submit it in a minute — we review every one.",
    es: "Ayuda a otras familias de Las Vegas a encontrarlo. Envíalo en un minuto — revisamos cada uno.",
  },
  cta_share: { en: "Love it? Share Vegas Kiddos with other parents", es: "¿Te gusta? Comparte Vegas Kiddos con otros papás" },
  // footer
  foot_tagline: { en: "A free, kid-safe guide to Las Vegas family events — sorted by age, price, and neighborhood.", es: "Una guía gratuita y segura de eventos familiares en Las Vegas — por edad, precio y vecindario." },
  foot_explore: { en: "Explore", es: "Explorar" },
  foot_more: { en: "More", es: "Más" },
  foot_madeby: { en: "Made with", es: "Hecho con" },
  foot_confirm: { en: "Always confirm details with the venue.", es: "Confirma siempre los detalles con el lugar." },
  // browse / filters
  search_ph: { en: "🔍 Search events, venues, activities…", es: "🔍 Busca eventos, lugares, actividades…" },
  f_when: { en: "When", es: "Cuándo" },
  f_age: { en: "Age", es: "Edad" },
  f_price: { en: "Price", es: "Precio" },
  f_where: { en: "Where", es: "Dónde" },
  f_area: { en: "Area", es: "Zona" },
  f_near: { en: "Near you", es: "Cerca de ti" },
  v_list: { en: "📋 List", es: "📋 Lista" },
  v_calendar: { en: "📅 Calendar", es: "📅 Calendario" },
  v_map: { en: "🗺️ Map", es: "🗺️ Mapa" },
  events_n: { en: "events", es: "eventos" },
  event_1: { en: "event", es: "evento" },
  show_more: { en: "Show more events", es: "Ver más eventos" },
  loading_more: { en: "Loading more fun…", es: "Cargando más diversión…" },
  clear_all: { en: "✕ Clear all filters", es: "✕ Borrar filtros" },
  anywhere: { en: "Anywhere", es: "Cualquier lugar" },
  indoor: { en: "🏠 Indoor", es: "🏠 Interior" },
  outdoor: { en: "🌳 Outdoor", es: "🌳 Aire libre" },
  zip_ph: { en: "Enter ZIP code", es: "Código postal" },
  // quick picks
  quick_picks: { en: "Quick picks:", es: "Atajos:" },
  qp_free_weekend: { en: "✨ Free this weekend", es: "✨ Gratis este finde" },
  qp_free_near: { en: "📍 Free near me", es: "📍 Gratis cerca de mí" },
  qp_today: { en: "Today", es: "Hoy" },
  qp_filters: { en: "Filters", es: "Filtros" },
  qp_hide_filters: { en: "Hide filters", es: "Ocultar filtros" },
  my_list: { en: "❤️ My List", es: "❤️ Mi lista" },
  // date filters
  d_any: { en: "Any time", es: "Cualquier día" },
  d_today: { en: "Today", es: "Hoy" },
  d_weekend: { en: "This weekend", es: "Este finde" },
  d_week: { en: "This week", es: "Esta semana" },
  d_month: { en: "This month", es: "Este mes" },
  d_next_month: { en: "Next month", es: "Próximo mes" },
  // geolocation / zip notes
  geo_unavailable: { en: "Location isn't available on this device.", es: "La ubicación no está disponible en este dispositivo." },
  geo_finding: { en: "Finding events near you…", es: "Buscando eventos cerca de ti…" },
  geo_sorted: { en: "📍 Sorted by distance from you", es: "📍 Ordenado por distancia desde ti" },
  geo_failed: { en: "Couldn't get your location — allow location access and try again.", es: "No pudimos obtener tu ubicación — permite el acceso e inténtalo de nuevo." },
  no_match: { en: "No events match those filters.", es: "Ningún evento coincide con esos filtros." },
  no_match_hint: { en: "Try clearing a filter or two.", es: "Prueba a quitar uno o dos filtros." },
  // event detail page
  ev_back: { en: "← All events", es: "← Todos los eventos" },
  ev_next: { en: "Next:", es: "Próximo:" },
  ev_repeats: { en: "🔁 Repeats", es: "🔁 Se repite" },
  ev_via: { en: "via", es: "vía" },
  ev_directions: { en: "🗺️ Get directions", es: "🗺️ Cómo llegar" },
  ev_calendar: { en: "📅 Add to calendar", es: "📅 Añadir al calendario" },
  ev_rsvp: { en: "🔗 Event details / RSVP", es: "🔗 Detalles / Reservar" },
  ev_address: { en: "Address:", es: "Dirección:" },
  ev_share: { en: "Share this event", es: "Comparte este evento" },
  ev_disclaimer: {
    en: "Vegas Kiddos aggregates public listings. Always confirm date, time, and price with the venue before heading out.",
    es: "Vegas Kiddos reúne listados públicos. Confirma siempre la fecha, hora y precio con el lugar antes de salir.",
  },
  ev_more_at: { en: "More at", es: "Más en" },
  ev_more_in: { en: "More in", es: "Más en" },
  nl_title: { en: "📬 This week's kid events, in your inbox", es: "📬 Los eventos para niños de esta semana, en tu correo" },
  nl_sub: {
    en: "Free weekly email — the best upcoming events for Vegas families.",
    es: "Correo semanal gratis — los mejores eventos para las familias de Las Vegas.",
  },
  nl_email_ph: { en: "you@email.com", es: "tu@correo.com" },
  nl_all_areas: { en: "All areas", es: "Todas las zonas" },
  nl_area_label: { en: "Your area (optional)", es: "Tu zona (opcional)" },
  nl_button: { en: "Get the digest", es: "Recibir el boletín" },
  nl_perk_curated: { en: "Hand-picked, kid-safe events", es: "Eventos seleccionados y seguros para niños" },
  nl_perk_local: { en: "Tailored to your neighborhood", es: "Adaptado a tu zona" },
  nl_perk_free: { en: "Free — unsubscribe anytime", es: "Gratis — cancela cuando quieras" },
  nl_note: { en: "One email a week. No spam, ever.", es: "Un correo por semana. Nada de spam, nunca." },
  nl_done: { en: "🎉 You're in! Watch your inbox each week.", es: "🎉 ¡Listo! Revisa tu correo cada semana." },
  nl_err_again: { en: "Try again.", es: "Inténtalo de nuevo." },
  nl_err_generic: { en: "Something went wrong.", es: "Algo salió mal." },
} as const;

export type StringKey = keyof typeof STRINGS;

export function t(lang: Lang, key: StringKey): string {
  return STRINGS[key][lang] ?? STRINGS[key].en;
}

// ── Localized taxonomy labels ──────────────────────────────────────────────
// Spanish overrides for the shared age/price/neighborhood taxonomy. English
// falls back to the canonical labels in constants.ts.
const AGE_ES: Record<AgeTierId, { label: string; sublabel: string }> = {
  baby: { label: "Bebé", sublabel: "0–1 año" },
  toddler: { label: "Pequeñín", sublabel: "1–3 años" },
  kids: { label: "Niños", sublabel: "3–12 años" },
  tweens: { label: "Preadolescentes", sublabel: "12+ años" },
};
const PRICE_ES: Record<PriceTierId, string> = {
  free: "Gratis",
  under10: "$1–10",
  mid: "$11–25",
  premium: "$25+",
};
const HOOD_ES: Record<NeighborhoodId, string> = {
  summerlin: "Summerlin / Oeste",
  henderson: "Henderson / Sureste",
  "north-lv": "Norte de Las Vegas",
  "spring-valley": "Spring Valley",
  enterprise: "Enterprise / Suroeste",
  downtown: "Centro / Distrito de Arte",
};

export function ageLabel(lang: Lang, id: AgeTierId): { label: string; sublabel: string } {
  const a = AGE_TIERS.find((x) => x.id === id)!;
  return lang === "es" ? AGE_ES[id] : { label: a.label, sublabel: a.sublabel };
}
export function priceLabel(lang: Lang, id: PriceTierId): string {
  if (lang === "es") return PRICE_ES[id];
  return PRICE_TIERS.find((x) => x.id === id)!.label;
}
export function hoodLabel(lang: Lang, id: NeighborhoodId): string {
  if (lang === "es") return HOOD_ES[id];
  return NEIGHBORHOODS.find((x) => x.id === id)!.label;
}
