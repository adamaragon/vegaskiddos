import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import { Sun, Star, Heart, Cloud, Squiggle, Scribble, Arrow, Underline } from "@/components/Doodles";
import { langAlternates } from "@/lib/seo";
import type { Lang } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = (await params) as { lang: Lang };
  return {
    title: "Style Guide — Vegas Kiddos",
    description: "The Vegas Kiddos design system — desert-sunset palette, Fredoka + Nunito type, components, and motion.",
    alternates: langAlternates(lang, "/style-guide"),
  };
}

const COLORS = [
  { name: "Coral", var: "bg-coral", hex: "#FF6B5E", use: "Primary / CTAs" },
  { name: "Sunny", var: "bg-sunny", hex: "#FFC93C", use: "Highlights / $1–10" },
  { name: "Teal", var: "bg-teal", hex: "#23C4B5", use: "Secondary / Free" },
  { name: "Grape", var: "bg-grape", hex: "#7B5EA7", use: "Accents / neighborhoods" },
  { name: "Ink", var: "bg-ink", hex: "#2D2A32", use: "Text" },
  { name: "Sand", var: "bg-sand", hex: "#FFF8EE", use: "Background" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal as="section" className="mt-12">
      <h2 className="font-display text-2xl font-700 text-ink">{title}</h2>
      <Squiggle className="mb-4 mt-1 h-4 w-40 text-coral" />
      {children}
    </Reveal>
  );
}

export default function StyleGuidePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="relative">
        <Sun className="pointer-events-none absolute -right-2 -top-4 h-16 w-16 animate-spin-slow opacity-70" />
        <h1 className="font-display text-4xl font-700 sm:text-5xl">Style Guide</h1>
        <p className="mt-2 max-w-xl text-lg text-ink/70">
          The bright, playful, crayon-flavored design system behind Vegas Kiddos.
        </p>
      </header>

      <Section title="Colors">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLORS.map((c) => (
            <div key={c.name} className="overflow-hidden rounded-blob border border-ink/10 bg-white shadow-card">
              <div className={`${c.var} h-20`} />
              <div className="p-3">
                <p className="font-display font-600">{c.name}</p>
                <p className="text-xs text-ink/70">{c.hex}</p>
                <p className="mt-1 text-xs text-ink/70">{c.use}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="space-y-3 rounded-blob border border-ink/10 bg-white p-6 shadow-card">
          <p className="font-display text-4xl font-700">Fredoka — Display</p>
          <p className="font-display text-xl font-500">Rounded, friendly, used for headings & the logo.</p>
          <hr className="border-ink/10" />
          <p className="font-body text-lg">Nunito — Body text. Warm and highly readable for parents skimming on a phone at the park.</p>
          <p className="font-body text-sm text-ink/70">Small print and metadata live here.</p>
        </div>
      </Section>

      <Section title="Crayon doodles">
        <div className="flex flex-wrap items-center gap-6 rounded-blob border border-ink/10 bg-white p-6 shadow-card text-ink/80">
          <Sun className="h-14 w-14" /><Star className="h-14 w-14" /><Heart className="h-14 w-14" />
          <Cloud className="h-12 w-20" /><Scribble className="h-14 w-14" /><Arrow className="h-12 w-16" />
          <Squiggle className="h-6 w-40" />
        </div>
        <p className="mt-2 text-sm text-ink/70">
          Hand-drawn SVGs with a turbulence filter for that waxy, child-drawn edge. All decorative &amp; <code>aria-hidden</code>.
        </p>
      </Section>

      <Section title="Buttons & chips">
        <div className="flex flex-wrap items-center gap-3 rounded-blob border border-ink/10 bg-white p-6 shadow-card">
          <button className="hover-pop rounded-full bg-coral-btn px-5 py-3 font-800 text-white shadow-pop">Primary</button>
          <button className="rounded-full bg-teal-btn px-5 py-3 font-800 text-white shadow-pop">Secondary</button>
          <button className="rounded-full border-2 border-ink/15 px-4 py-2 font-700 text-ink/70">Filter chip</button>
          <span className="rounded-full bg-teal-btn px-3 py-1 text-xs font-800 text-white">🆓 Free</span>
          <span className="rounded-full bg-sunny px-3 py-1 text-xs font-800 text-ink">💵 $1–10</span>
          <span className="rounded-full bg-coral-btn px-3 py-1 text-xs font-800 text-white">💳 $11–25</span>
          <span className="rounded-full bg-grape px-3 py-1 text-xs font-800 text-white">✨ $25+</span>
        </div>
      </Section>

      <Section title="Motion">
        <div className="flex flex-wrap items-center gap-8 rounded-blob border border-ink/10 bg-white p-6 shadow-card">
          <div className="text-center"><div className="animate-wiggle text-4xl">🌵</div><p className="mt-1 text-xs text-ink/70">wiggle</p></div>
          <div className="text-center"><div className="animate-float text-4xl">🎈</div><p className="mt-1 text-xs text-ink/70">float</p></div>
          <div className="text-center"><div className="animate-bob text-4xl">⭐</div><p className="mt-1 text-xs text-ink/70">bob</p></div>
          <div className="text-center"><div className="animate-spin-slow text-4xl">☀️</div><p className="mt-1 text-xs text-ink/70">spin-slow</p></div>
          <div className="text-center"><div className="hover-pop text-4xl">🧸</div><p className="mt-1 text-xs text-ink/70">hover-pop</p></div>
        </div>
        <p className="mt-2 text-sm text-ink/70">
          Everything respects <code>prefers-reduced-motion</code>. Scroll reveals fire once on entry.
        </p>
      </Section>

      <div className="mt-12 flex items-center justify-center gap-3 text-ink/40">
        <Underline className="h-5 w-48 text-sunny" />
      </div>
    </div>
  );
}
