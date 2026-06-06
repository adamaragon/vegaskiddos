import { headers } from "next/headers";
import type { Lang } from "./i18n";

// Current locale for server components. The URL is authoritative: middleware
// runs on every page route (see middleware `matcher`) and always sets
// `x-vk-lang` — "es" for the /es/* tree, "en" otherwise — and additionally
// redirects any vk_lang=es visitor off the English tree onto /es. So the
// header is guaranteed present on every server render and the vk_lang cookie
// is redundant for SSR; we read only the header here. (The cookie still drives
// the middleware redirect + client useLang(), so language persistence is
// unaffected.)
export async function getLang(): Promise<Lang> {
  const h = await headers();
  const fromHeader = h.get("x-vk-lang");
  return fromHeader === "es" ? "es" : "en";
}

// Path with the /es prefix stripped (set by middleware), used to build the
// reciprocal hreflang / canonical URLs. Defaults to "/".
export async function getPath(): Promise<string> {
  const h = await headers();
  return h.get("x-vk-path") || "/";
}
