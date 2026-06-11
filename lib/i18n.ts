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
  nav_donate: { en: "Donate", es: "Donar" },
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

  // ── About page ──
  ab_title: { en: "About", es: "Acerca de" },
  ab_lead: {
    en: "Vegas Kiddos is a free resource that helps Las Vegas parents find safe, age-appropriate events for their children — every day of the week.",
    es: "Vegas Kiddos es un recurso gratuito que ayuda a los padres de Las Vegas a encontrar eventos seguros y apropiados para la edad de sus hijos — todos los días de la semana.",
  },
  ab_p2: {
    en: "We pull events from local libraries, parks & rec departments, children's museums, and trusted community submissions, then sort them by age, price, and neighborhood so you can find the right thing for your little one in seconds.",
    es: "Reunimos eventos de bibliotecas locales, departamentos de parques y recreación, museos infantiles y aportes confiables de la comunidad, y los organizamos por edad, precio y vecindario para que encuentres lo ideal para tu pequeño en segundos.",
  },
  ab_sources_h: { en: "Where our events come from", es: "De dónde vienen nuestros eventos" },
  ab_src_1: { en: "Las Vegas–Clark County Library District", es: "Distrito de Bibliotecas de Las Vegas–Clark County" },
  ab_src_2: { en: "Henderson Libraries & North Las Vegas Library", es: "Bibliotecas de Henderson y North Las Vegas" },
  ab_src_3: { en: "City & County Parks & Recreation calendars", es: "Calendarios de Parques y Recreación de la ciudad y el condado" },
  ab_src_4: { en: "DISCOVERY Children's Museum, Springs Preserve, and more", es: "DISCOVERY Children's Museum, Springs Preserve y más" },
  ab_src_5: { en: "Community submissions from parents & local organizers", es: "Aportes de la comunidad: padres y organizadores locales" },
  ab_safety_h: { en: "A note on safety", es: "Una nota sobre seguridad" },
  ab_safety_p: {
    en: "We focus on family-friendly, kid-safe programming. Listings are aggregated from public sources — please always confirm the details with the venue before you go.",
    es: "Nos enfocamos en actividades familiares y seguras para niños. Los listados se recopilan de fuentes públicas — confirma siempre los detalles con el lugar antes de ir.",
  },

  // ── Contact page ──
  ct_type_feedback: { en: "💬 Feedback", es: "💬 Comentarios" },
  ct_type_suggestion: { en: "💡 Suggestion", es: "💡 Sugerencia" },
  ct_type_eventtip: { en: "📅 Event tip", es: "📅 Aviso de evento" },
  ct_type_bug: { en: "🐛 Something's broken", es: "🐛 Algo no funciona" },
  ct_done_h: { en: "Thank you!", es: "¡Gracias!" },
  ct_done_p: { en: "We read every message. If you left an email, we might just write back.", es: "Leemos cada mensaje. Si dejaste un correo, quizá te respondamos." },
  ct_send_another: { en: "Send another", es: "Enviar otro" },
  ct_h: { en: "Say hello 👋", es: "Saluda 👋" },
  ct_intro: {
    en: "Got feedback, a great event we missed, or an idea to make Vegas Kiddos better? We'd love to hear it.",
    es: "¿Tienes comentarios, un buen evento que se nos pasó, o una idea para mejorar Vegas Kiddos? Nos encantaría saberlo.",
  },
  ct_about_q: { en: "What's this about?", es: "¿De qué se trata?" },
  ct_name: { en: "Your name", es: "Tu nombre" },
  ct_name_ph: { en: "Optional", es: "Opcional" },
  ct_email: { en: "Email", es: "Correo" },
  ct_email_ph: { en: "So we can reply (optional)", es: "Para poder responder (opcional)" },
  ct_msg: { en: "Message *", es: "Mensaje *" },
  ct_msg_ph: { en: "Tell us what's on your mind…", es: "Cuéntanos qué piensas…" },
  ct_err: { en: "Hmm, that didn't send. Please try again.", es: "Mmm, no se envió. Inténtalo de nuevo." },
  ct_send: { en: "Send message", es: "Enviar mensaje" },
  ct_sending: { en: "Sending…", es: "Enviando…" },

  // ── Features / ideas page ──
  ft_h: { en: "Help shape Vegas Kiddos", es: "Ayuda a dar forma a Vegas Kiddos" },
  ft_intro: {
    en: "Vote on what we build next — or pitch your own idea. The most-loved ideas jump to the top of our list.",
    es: "Vota por lo que construimos a continuación — o propón tu propia idea. Las ideas más queridas suben a lo más alto de nuestra lista.",
  },
  ft_suggest: { en: "💡 Suggest an idea", es: "💡 Propón una idea" },
  ft_idea_title_ph: { en: "Your idea in a sentence", es: "Tu idea en una frase" },
  ft_idea_desc_ph: { en: "Any details? (optional)", es: "¿Algún detalle? (opcional)" },
  ft_add: { en: "Add my idea", es: "Agregar mi idea" },
  ft_adding: { en: "Adding…", es: "Agregando…" },
  ft_loading: { en: "Loading ideas…", es: "Cargando ideas…" },
  ft_empty: { en: "No ideas yet — be the first!", es: "Aún no hay ideas — ¡sé el primero!" },
  ft_footer: { en: "Your vote really does steer the roadmap.", es: "Tu voto sí guía nuestro plan." },
  ft_status_idea: { en: "idea", es: "idea" },
  ft_status_planned: { en: "planned", es: "planeado" },
  ft_status_building: { en: "building", es: "en desarrollo" },
  ft_status_shipped: { en: "shipped", es: "lanzado" },
  ft_shipped_h: { en: "Success! 🎉", es: "¡Listo! 🎉" },
  ft_shipped_intro: {
    en: "Ideas your votes helped us build — already live on the site.",
    es: "Ideas que sus votos ayudaron a construir — ya están en vivo.",
  },
  ft_success_badge: { en: "Success!", es: "¡Listo!" },

  // ── Weather pill (homepage hero) ──
  wx_very_hot: { en: "Very Hot", es: "Muy Caluroso" },
  wx_hot: { en: "Hot", es: "Caluroso" },
  wx_nice: { en: "Nice", es: "Agradable" },
  wx_chilly: { en: "Chilly", es: "Fresco" },
  wx_cold: { en: "Cold", es: "Frío" },
  wx_rainy: { en: "Rainy", es: "Lluvioso" },
  wx_snow: { en: "Snowy", es: "Nevado" },
  wx_storm: { en: "Storm", es: "Tormenta" },
  wx_windy: { en: "Windy", es: "Ventoso" },
  wx_fog: { en: "Foggy", es: "Brumoso" },
  wx_cloudy: { en: "Cloudy", es: "Nublado" },
  wx_indoor_hint: { en: "indoor day?", es: "¿día bajo techo?" },

  // ── Changelog page ──
  cl_h: { en: "What's New", es: "Novedades" },
  cl_intro: {
    en: "We're building Vegas Kiddos in the open. Here's everything we've shipped.",
    es: "Estamos construyendo Vegas Kiddos a la vista de todos. Esto es todo lo que hemos lanzado.",
  },
  // <head> metadata (localized per /es vs / URL for SEO)
  meta_title: {
    en: "Vegas Kiddos — Kid-safe events across Las Vegas",
    es: "Vegas Kiddos — Eventos seguros para niños en Las Vegas",
  },
  meta_desc: {
    en: "Find baby, toddler, kid, and tween events near you in Las Vegas. Filter by neighborhood, age, and price. A free resource for local parents.",
    es: "Encuentra eventos para bebés, niños pequeños y preadolescentes cerca de ti en Las Vegas. Filtra por vecindario, edad y precio. Un recurso gratuito para papás locales.",
  },
  // "This week near you" personalization strip
  tw_title: { en: "This week near you", es: "Esta semana cerca de ti" },
  tw_title_all: { en: "This week in Las Vegas", es: "Esta semana en Las Vegas" },
  tw_sub: { en: "Happening in the next 7 days", es: "En los próximos 7 días" },
  tw_pick: { en: "Pick your area", es: "Elige tu zona" },
  tw_all: { en: "All of Las Vegas", es: "Todo Las Vegas" },
  tw_loc: { en: "📍 Use my location", es: "📍 Usar mi ubicación" },
  tw_locating: { en: "Locating…", es: "Ubicando…" },
  tw_geo_off: { en: "Location unavailable", es: "Ubicación no disponible" },
  tw_empty_area: {
    en: "Nothing in your area this week — here's what's on across the valley.",
    es: "Nada en tu zona esta semana — esto es lo que hay por todo el valle.",
  },
  tw_see_all: { en: "See all events →", es: "Ver todos los eventos →" },

  // ── Cookie consent banner ──
  cc_title: { en: "Cookies 🍪", es: "Cookies 🍪" },
  cc_msg: {
    en: "We use a couple of cookies to see how families use the site — never for ads, never sold. The site works just the same if you say no.",
    es: "Usamos un par de cookies para ver cómo las familias usan el sitio — nunca para anuncios, nunca se venden. El sitio funciona igual si dices que no.",
  },
  cc_accept: { en: "Accept", es: "Aceptar" },
  cc_decline: { en: "Decline", es: "Rechazar" },
  cc_settings: { en: "Cookie settings", es: "Preferencias de cookies" },

  // ── Cancelled-event banner ──
  cancel_badge: { en: "Canceled", es: "Cancelado" },
  cancel_banner: { en: "This event has been canceled", es: "Este evento ha sido cancelado" },
  cancel_note: {
    en: "The source pulled this event after we listed it, so don't head out — and always confirm details with the venue.",
    es: "La fuente retiró este evento después de publicarlo, así que no vayas — y confirma siempre los detalles con el lugar.",
  },
  cancel_dates_note: {
    en: "Heads up — these upcoming sessions are canceled (the rest of the series still runs):",
    es: "Aviso — estas próximas sesiones están canceladas (el resto de la serie continúa):",
  },
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
