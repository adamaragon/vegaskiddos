// Lightweight bilingual support (English / Spanish). Locale is stored in the
// `vk_lang` cookie; server components read it and render the right strings, the
// LangToggle sets it and reloads. Event content stays in its source language.

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
} as const;

export type StringKey = keyof typeof STRINGS;

export function t(lang: Lang, key: StringKey): string {
  return STRINGS[key][lang] ?? STRINGS[key].en;
}
