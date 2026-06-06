// Small structured-data helpers shared across pages.

import type { Lang } from "./i18n";

export const SITE = "https://vegaskiddos.com";

// Canonical + reciprocal hreflang for a content path. English is canonical at
// the root; Spanish lives under /es. Pass the un-prefixed path the page lives
// at ("/", "/today", "/event/abc"). Returns a Metadata["alternates"] object.
// Replaces the old getPath()/headers() approach so pages stay statically
// rendered (locale now comes from the [lang] route segment, not a request header).
export function langAlternates(lang: Lang, path: string) {
  const suffix = path === "/" ? "" : path;
  const enUrl = `${SITE}${suffix}`;
  const esUrl = `${SITE}/es${suffix}`;
  return {
    canonical: lang === "es" ? esUrl : enUrl,
    languages: { en: enUrl, es: esUrl, "x-default": enUrl },
  };
}

// schema.org BreadcrumbList from an ordered list of { name, url }.
export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
