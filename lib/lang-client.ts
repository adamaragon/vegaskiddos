"use client";

import { useEffect, useState } from "react";
import type { Lang } from "./i18n";

// Client-side locale, read from the vk_lang cookie. Starts "en" to match SSR
// (the cookie isn't available during server render of client components), then
// resolves on mount — a one-frame flash on the few client-only pages, which is
// an acceptable tradeoff for not threading lang through every layout.
export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)vk_lang=([^;]+)/);
    if (m && decodeURIComponent(m[1]) === "es") setLang("es");
  }, []);
  return lang;
}
