import { SITE } from "./seo";
import type { Lang } from "./i18n";

export function homePath(lang: Lang = "en"): string {
  return lang === "es" ? "/es" : "/";
}

export function eventPath(id: string, lang: Lang = "en"): string {
  return lang === "es" ? `/es/event/${id}` : `/event/${id}`;
}

export function eventAbsUrl(id: string, lang: Lang = "en"): string {
  return `${SITE}${eventPath(id, lang)}`;
}

export function venuePath(slug: string, lang: Lang = "en"): string {
  return lang === "es" ? `/es/venue/${slug}` : `/venue/${slug}`;
}

export function myListAbsUrl(ids?: string[], lang: Lang = "en"): string {
  const base = lang === "es" ? `${SITE}/es/my-list` : `${SITE}/my-list`;
  if (!ids?.length) return base;
  return `${base}?ids=${encodeURIComponent(ids.join(","))}`;
}
