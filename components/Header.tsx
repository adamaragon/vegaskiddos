import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-[1000] border-b border-ink/10 bg-sand/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="animate-wiggle text-2xl">🌵</span>
          <span className="font-display text-2xl font-700 leading-none">
            <span className="text-coral">Vegas</span>{" "}
            <span className="text-teal">Kiddos</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-700 sm:gap-2">
          <Link
            href="/"
            className="rounded-full px-3 py-2 text-ink/70 transition hover:bg-white hover:text-ink"
          >
            Events
          </Link>
          <Link
            href="/features"
            className="hidden rounded-full px-3 py-2 text-ink/70 transition hover:bg-white hover:text-ink sm:block"
          >
            Ideas
          </Link>
          <Link
            href="/about"
            className="hidden rounded-full px-3 py-2 text-ink/70 transition hover:bg-white hover:text-ink sm:block"
          >
            About
          </Link>
          <Link
            href="/submit"
            className="whitespace-nowrap rounded-full bg-coral px-4 py-2 text-white shadow-pop transition hover:bg-coral-dark"
          >
            <span className="sm:hidden">+ Add</span>
            <span className="hidden sm:inline">+ Add an event</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
