"use client";

import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n";
import { track } from "@/lib/track";

// EN/ES toggle. Language lives in the URL (/es/*), so switching navigates to
// the equivalent path in the other tree and sets the preference cookie. The
// middleware handles keeping the visitor in their chosen language thereafter.
export function LangToggle({ lang }: { lang: Lang }) {
  const router = useRouter();

  function set(next: Lang) {
    if (next === lang) return;
    track("Lang Toggle", { to: next });
    document.cookie = `vk_lang=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    // window.location is the *visible* browser path — reliable even though
    // middleware rewrites /es/* internally. Strip/add the /es prefix.
    const visible = window.location.pathname;
    const bare = visible === "/es" ? "/" : visible.replace(/^\/es(?=\/)/, "");
    const target = next === "es" ? (bare === "/" ? "/es" : `/es${bare}`) : bare;
    router.push(target);
    router.refresh();
  }

  return (
    <div className="flex items-center rounded-full border-2 border-ink/15 bg-white text-xs font-800">
      {(["en", "es"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => set(l)}
          aria-label={l === "en" ? "English" : "Español"}
          className={`rounded-full px-2.5 py-1 transition ${lang === l ? "bg-teal text-white" : "text-ink/70"}`}
        >
          {l === "en" ? "EN" : "ES"}
        </button>
      ))}
    </div>
  );
}
