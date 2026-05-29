import { headers, cookies } from "next/headers";
import type { Lang } from "./i18n";

// Current locale for server components. The URL is authoritative: middleware
// sets `x-vk-lang` based on whether the path is under /es. Falls back to the
// vk_lang cookie for any route middleware doesn't cover.
export async function getLang(): Promise<Lang> {
  const h = await headers();
  const fromHeader = h.get("x-vk-lang");
  if (fromHeader === "es") return "es";
  if (fromHeader === "en") return "en";
  const c = await cookies();
  return c.get("vk_lang")?.value === "es" ? "es" : "en";
}

// Path with the /es prefix stripped (set by middleware), used to build the
// reciprocal hreflang / canonical URLs. Defaults to "/".
export async function getPath(): Promise<string> {
  const h = await headers();
  return h.get("x-vk-path") || "/";
}
