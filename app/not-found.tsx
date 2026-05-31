import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="animate-wiggle text-7xl">🌵</p>
      <h1 className="mt-4 font-display text-4xl font-700">Lost in the desert</h1>
      <p className="mt-2 text-ink/70">
        We couldn&apos;t find that page. The event may have ended or the link moved.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="hover-pop rounded-full bg-coral-btn px-5 py-3 font-800 text-white shadow-pop">
          Browse all events
        </Link>
        <Link href="/this-weekend" className="rounded-full border-2 border-ink/15 px-5 py-3 font-800 text-ink/70 transition hover:border-teal">
          This weekend
        </Link>
      </div>
    </div>
  );
}
