"use client";

import { useEffect, useState } from "react";
import type { Lang } from "./i18n";

// Client-side locale. The URL is authoritative (pages under /es are Spanish),
// so we check the path first and fall back to the vk_lang cookie. Starts "en"
// to match SSR, then resolves on mount — a one-frame flash on the few
// client-only pages, an acceptable tradeoff for not threading lang everywhere.
export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    if (window.location.pathname === "/es" || window.location.pathname.startsWith("/es/")) {
      setLang("es");
      return;
    }
    const m = document.cookie.match(/(?:^|;\s*)vk_lang=([^;]+)/);
    if (m && decodeURIComponent(m[1]) === "es") setLang("es");
  }, []);
  return lang;
}
