"use client";

import type { Lang } from "@/lib/i18n";

// EN/ES toggle. Sets the vk_lang cookie and reloads so server components
// re-render in the chosen language.
export function LangToggle({ lang }: { lang: Lang }) {
  function set(next: Lang) {
    if (next === lang) return;
    document.cookie = `vk_lang=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    window.location.reload();
  }
  return (
    <div className="flex items-center rounded-full border-2 border-ink/15 bg-white text-xs font-800">
      {(["en", "es"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => set(l)}
          aria-label={l === "en" ? "English" : "Español"}
          className={`rounded-full px-2.5 py-1 transition ${lang === l ? "bg-teal text-white" : "text-ink/50"}`}
        >
          {l === "en" ? "EN" : "ES"}
        </button>
      ))}
    </div>
  );
}
