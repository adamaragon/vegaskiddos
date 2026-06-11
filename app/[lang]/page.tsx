import type { Metadata } from "next";
import { getEvents } from "@/lib/data";
import { EventBrowser } from "@/components/EventBrowser";
import { ThisWeekNearYou } from "@/components/ThisWeekNearYou";
import { Reveal } from "@/components/Reveal";
import { HeroCanvas } from "@/components/HeroCanvas";
import { ShareButtons } from "@/components/ShareButtons";
import { SubscribeBox } from "@/components/SubscribeBox";
import { JsonLd } from "@/components/JsonLd";
import { Cloud, Star, Underline, Scribble } from "@/components/Doodles";
import { WeatherPill } from "@/components/WeatherPill";
import { t, type Lang } from "@/lib/i18n";
import { SITE, langAlternates } from "@/lib/seo";

export const revalidate = 86400;

const siteLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Vegas Kiddos",
    url: SITE,
    description:
      "Find kid-safe Las Vegas family events by age, price, and neighborhood.",
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Vegas Kiddos",
    url: SITE,
    founder: ["Adam Aragon", "Michelle Aragon"],
    parentOrganization: { "@type": "Organization", name: "Threesided Studios", url: "https://threesided.com" },
  },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = (await params) as { lang: Lang };
  return { alternates: langAlternates(lang, "/") };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = (await params) as { lang: Lang };
  const events = await getEvents(lang);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd data={siteLd} />
      {/* Hero with Three.js backdrop */}
      <section className="relative isolate overflow-hidden rounded-blob bg-gradient-to-br from-coral via-coral to-sunny p-8 text-white shadow-card sm:p-12">
        <HeroCanvas />
        <WeatherPill />
        <Cloud className="pointer-events-none absolute bottom-4 left-8 hidden h-16 w-24 animate-float opacity-30 sm:block" color="#FFFFFF" />
        <div className="relative z-10">
          <h1 className="font-display text-4xl font-700 leading-tight drop-shadow-sm sm:text-5xl">
            {t(lang, "hero_title")}
          </h1>
          <Underline className="-mt-1 h-5 w-64 max-w-[80%]" color="#FFFFFF" />
          <p className="mt-3 max-w-xl text-lg text-white/90">
            {t(lang, "hero_sub")}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm font-700">
            {["👶 Baby", "🧸 Toddler", "🎨 Kids", "🛹 Tweens"].map((tag) => (
              <span key={tag}
                className="hover-pop cursor-default rounded-full bg-white/20 px-3 py-1.5 backdrop-blur-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Weekly digest signup */}
      <Reveal as="section" variant="pop" className="mt-8">
        <div className="relative overflow-hidden rounded-blob bg-gradient-to-br from-grape to-teal px-4 py-4 text-white shadow-card sm:px-4 sm:py-5">
          {/* Decorative doodles fill the negative space */}
          <Star className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rotate-12 text-white/10" />
          <Cloud className="pointer-events-none absolute -bottom-2 left-1/4 hidden h-14 w-14 text-white/10 lg:block" />
          <div className="relative grid items-center gap-8 lg:grid-cols-5">
            <div className="text-center lg:col-span-3 lg:text-left">
              <h2 className="font-display text-2xl font-800 leading-tight sm:text-3xl">{t(lang, "nl_title")}</h2>
              <p className="mt-3 text-base text-white/90 sm:text-lg">{t(lang, "nl_sub")}</p>
              <ul className="mx-auto mt-5 inline-flex flex-col gap-2.5 text-left text-[19px] font-600 text-white/95 lg:mx-0">
                <li className="flex items-center gap-2"><span aria-hidden>✅</span>{t(lang, "nl_perk_curated")}</li>
                <li className="flex items-center gap-2"><span aria-hidden>📍</span>{t(lang, "nl_perk_local")}</li>
                <li className="flex items-center gap-2"><span aria-hidden>🎉</span>{t(lang, "nl_perk_free")}</li>
              </ul>
            </div>
            <div className="w-full rounded-3xl bg-white/12 p-5 sm:p-6 lg:col-span-2 lg:mt-3">
              <SubscribeBox lang={lang} stacked />
              <p className="mt-3 text-center text-sm text-white/70">{t(lang, "nl_note")}</p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Personalized "this week near you" strip (client-only, progressive) */}
      <ThisWeekNearYou events={events} lang={lang} />

      {/* Browser */}
      <section className="mt-8">
        <EventBrowser events={events} lang={lang} />
      </section>

      {/* Friendly footer nudge */}
      <Reveal as="section" variant="pop" className="mt-12">
        <div className="relative overflow-hidden rounded-blob border-2 border-dashed border-ink/15 bg-white p-8 text-center shadow-card">
          <Star className="pointer-events-none absolute -left-3 top-2 h-12 w-12 animate-bob text-sunny" />
          <Star className="pointer-events-none absolute right-4 bottom-2 h-8 w-8 animate-float text-teal" />
          <Scribble className="pointer-events-none absolute right-8 top-3 hidden h-14 w-14 text-coral/60 sm:block" />
          <Scribble className="pointer-events-none absolute left-10 bottom-3 hidden h-10 w-10 text-grape/50 sm:block" />
          <h2 className="font-display text-2xl font-700">{t(lang, "cta_title")}</h2>
          <p className="mx-auto mt-2 max-w-md text-ink/70">{t(lang, "cta_sub")}</p>
          <a href="/submit" className="hover-pop mt-4 inline-block rounded-full bg-coral-btn px-6 py-3 font-800 text-white shadow-pop">
            {t(lang, "nav_add")}
          </a>
          <div className="mt-6 flex flex-col items-center gap-2 border-t border-ink/10 pt-5">
            <p className="text-sm font-700 text-ink/70">{t(lang, "cta_share")}</p>
            <ShareButtons url={SITE} title="Vegas Kiddos"
              text="Vegas Kiddos — find kid-safe Las Vegas family events by age, price & neighborhood" />
          </div>
        </div>
      </Reveal>
    </div>
  );
}
