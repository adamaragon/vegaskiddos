import Link from "next/link";
import { t, type Lang } from "@/lib/i18n";
import { homePath } from "@/lib/eventUrl";

// This boundary must not touch headers() or cookies(). Next renders it inside
// whatever page called notFound(), so a request read here de-opts that page
// from static to dynamic at runtime — which is exactly what the event
// permalinks (ISR, revalidate 600) were tripping on for every dead event id.
//
// It also renders in Next's bare `__next_error__` shell, NOT inside
// app/[lang]/layout.tsx (this app has no root layout above the [lang]
// segment), so there is no server-rendered <html lang> to read either. Both
// languages render and the inline script below sets <html lang> from the URL
// before the body paints, which is the hook the CSS uses. React's hydration
// re-renders <html> from the [lang] layout and strips attributes it does not
// own, so lang is the only durable channel here — it is also what the layout
// itself sets, so the two agree instead of fighting. No script (or no /es)
// leaves English, which is the default.
const PICK_LANG = `(function(){var p=location.pathname;
var es=p==="/es"||p.slice(0,4)==="/es/"||/(?:^|;\\s*)vk_lang=es(?:;|$)/.test(document.cookie);
document.documentElement.lang=es?"es":"en";})()`;

function NotFoundBody({ lang }: { lang: Lang }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="animate-wiggle text-7xl">🌵</p>
      <h1 className="mt-4 font-display text-4xl font-700">{t(lang, "nf_title")}</h1>
      <p className="mt-2 text-ink/70">{t(lang, "nf_body")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href={homePath(lang)} className="hover-pop rounded-full bg-coral-btn px-5 py-3 font-800 text-white shadow-pop">
          {t(lang, "nf_browse")}
        </Link>
        <Link href={lang === "es" ? "/es/this-weekend" : "/this-weekend"} className="rounded-full border-2 border-ink/15 px-5 py-3 font-800 text-ink/70 transition hover:border-teal">
          {t(lang, "nf_weekend")}
        </Link>
      </div>
    </div>
  );
}

export default function NotFound() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PICK_LANG }} />
      <div className="nf-lang nf-lang-en">
        <NotFoundBody lang="en" />
      </div>
      <div className="nf-lang nf-lang-es">
        <NotFoundBody lang="es" />
      </div>
    </>
  );
}
