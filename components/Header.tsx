import Link from "next/link";
import { t, type Lang } from "@/lib/i18n";
import { LangToggle } from "./LangToggle";

export function Header({ lang = "en" }: { lang?: Lang }) {
  return (
    <header className="sticky top-0 z-[1000] border-b-2 border-ink/10 bg-white/85 shadow-[0_4px_20px_-8px_rgba(45,42,50,0.25)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="animate-wiggle text-3xl sm:text-4xl">🌵</span>
          <span className="font-display text-3xl font-700 leading-none sm:text-4xl">
            <span className="text-coral-dark">Vegas</span>{" "}
            <span className="text-teal-dark">Kiddos</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-700 sm:gap-2">
          <Link
            href="/"
            className="rounded-full px-3 py-2 text-ink/70 transition hover:bg-white hover:text-ink"
          >
            {t(lang, "nav_events")}
          </Link>
          <Link
            href="/features"
            className="hidden rounded-full px-3 py-2 text-ink/70 transition hover:bg-white hover:text-ink sm:block"
          >
            {t(lang, "nav_ideas")}
          </Link>
          <Link
            href="/about"
            className="hidden rounded-full px-3 py-2 text-ink/70 transition hover:bg-white hover:text-ink sm:block"
          >
            {t(lang, "nav_about")}
          </Link>
          <Link
            href="/my-list"
            aria-label="My saved list"
            className="rounded-full px-3 py-2 text-ink/70 transition hover:bg-white hover:text-ink"
          >
            ❤️
          </Link>
          <LangToggle lang={lang} />
          <Link
            href="/submit"
            className="whitespace-nowrap rounded-full bg-coral px-4 py-2 text-white shadow-pop transition hover:bg-coral-dark"
          >
            <span className="sm:hidden">{t(lang, "nav_add_short")}</span>
            <span className="hidden sm:inline">{t(lang, "nav_add")}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
