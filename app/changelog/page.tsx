import { CHANGELOG, type ChangeTag } from "@/lib/changelog";
import { Reveal } from "@/components/Reveal";
import { Sun, Star, Squiggle } from "@/components/Doodles";

export const metadata = { title: "What's New — Vegas Kiddos" };

const TAG_STYLE: Record<ChangeTag, string> = {
  Launch: "bg-coral text-white",
  Feature: "bg-teal text-white",
  Design: "bg-grape text-white",
  Data: "bg-sunny text-ink",
  Fix: "bg-ink/80 text-white",
};

function fmt(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

export default function ChangelogPage() {
  return (
    <div className="relative mx-auto max-w-2xl px-4 py-10">
      <Sun className="pointer-events-none absolute -right-6 top-6 h-20 w-20 animate-spin-slow opacity-70" />
      <header className="relative">
        <h1 className="font-display text-4xl font-700 sm:text-5xl">What&apos;s New</h1>
        <Squiggle className="mt-1 h-5 w-56 text-teal" />
        <p className="mt-3 text-lg text-ink/70">
          We&apos;re building Vegas Kiddos in the open. Here&apos;s everything we&apos;ve shipped.
        </p>
      </header>

      <div className="relative mt-10">
        {/* vertical crayon timeline */}
        <div className="absolute left-[7px] top-2 h-full w-1 rounded bg-ink/10 sm:left-[9px]" aria-hidden />
        <div className="space-y-8">
          {CHANGELOG.map((e, i) => (
            <Reveal key={e.date + i} variant="pop" delay={i * 40}>
              <article className="relative pl-8 sm:pl-10">
                <span className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-4 border-sand bg-coral sm:h-5 sm:w-5" aria-hidden />
                <div className="flex flex-wrap items-center gap-3">
                  <time className="text-sm font-700 text-ink/50">{fmt(e.date)}</time>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-800 ${TAG_STYLE[e.tag]}`}>
                    {e.tag}
                  </span>
                </div>
                <h2 className="mt-1 font-display text-2xl font-600">{e.title}</h2>
                <ul className="mt-2 space-y-1.5">
                  {e.items.map((it, j) => (
                    <li key={j} className="flex gap-2 text-ink/80">
                      <Star className="mt-1 h-3.5 w-3.5 shrink-0 text-sunny" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
