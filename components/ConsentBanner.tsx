"use client";

import { useEffect, useState } from "react";
import { t, type Lang } from "@/lib/i18n";

// Google Consent Mode v2 gate for GA4. The init script in the layout sets
// analytics_storage to "denied" by default; this component decides whether to
// grant it — and whether to even ask.
//
//  • EU / EEA / UK / Switzerland → opt-in required: show the banner, stay
//    denied until the visitor accepts.
//  • Everywhere else (most of the US + the rest of the world) → no consent
//    banner is legally required, so we default to granted and never show it.
//
// Region is read from Cloudflare's same-origin /cdn-cgi/trace endpoint (no API
// key, no third party). If it can't be determined (e.g. local dev), we treat
// the visitor as not-required and grant — matching "default to accepted."

const STORAGE_KEY = "vk-consent"; // "granted" | "denied"

// Opt-in consent regimes (GDPR / UK GDPR / Swiss FADP).
const CONSENT_REQUIRED = new Set([
  // EU 27
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
  // EEA (non-EU)
  "IS", "LI", "NO",
  // UK + Switzerland
  "GB", "CH",
]);

function updateConsent(granted: boolean) {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
  });
}

async function detectCountry(): Promise<string | null> {
  try {
    const res = await fetch("/cdn-cgi/trace", { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    const m = text.match(/^loc=([A-Z]{2})/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function ConsentBanner({ lang }: { lang: Lang }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Footer "Cookie settings" link re-opens the banner so anyone can change
    // their mind (and EU visitors can withdraw consent).
    const reopen = () => setShow(true);
    window.addEventListener("vk:cookie-settings", reopen);

    // Force the banner for design review regardless of region: ?cookies=show
    const forced =
      new URLSearchParams(window.location.search).get("cookies") === "show";

    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* private mode / blocked storage */
    }

    if (forced) {
      setShow(true);
    } else if (stored === "granted") {
      updateConsent(true);
    } else if (stored === "denied") {
      updateConsent(false);
    } else {
      // No prior choice — decide by region.
      detectCountry().then((country) => {
        if (cancelled) return;
        if (country && CONSENT_REQUIRED.has(country)) {
          setShow(true); // stays denied until they choose
        } else {
          updateConsent(true);
          try {
            localStorage.setItem(STORAGE_KEY, "granted");
          } catch {
            /* ignore */
          }
        }
      });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("vk:cookie-settings", reopen);
    };
  }, []);

  function choose(granted: boolean) {
    updateConsent(granted);
    try {
      localStorage.setItem(STORAGE_KEY, granted ? "granted" : "denied");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label={t(lang, "cc_title")}
      className="animate-consent-rise fixed inset-x-0 bottom-0 z-[1000] px-3 pb-3 sm:px-4 sm:pb-4"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-3 rounded-3xl border-2 border-ink/10 bg-white/95 p-4 shadow-pop backdrop-blur sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <div className="flex-1">
          <p className="font-display text-base font-700 text-ink">
            {t(lang, "cc_title")}
          </p>
          <p className="mt-0.5 text-sm leading-snug text-ink/70">
            {t(lang, "cc_msg")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => choose(false)}
            className="rounded-full px-4 py-2 text-sm font-700 text-ink/60 transition hover:text-ink"
          >
            {t(lang, "cc_decline")}
          </button>
          <button
            type="button"
            onClick={() => choose(true)}
            className="hover-pop rounded-full bg-sunny px-5 py-2 text-sm font-800 text-ink shadow-pop ring-1 ring-coral/30 transition hover:bg-sunny-dark"
          >
            {t(lang, "cc_accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
