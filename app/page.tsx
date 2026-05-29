import { getEvents } from "@/lib/data";
import { EventBrowser } from "@/components/EventBrowser";
import { Reveal } from "@/components/Reveal";
import { HeroCanvas } from "@/components/HeroCanvas";
import { ShareButtons } from "@/components/ShareButtons";
import { SubscribeBox } from "@/components/SubscribeBox";
import { JsonLd } from "@/components/JsonLd";
import { Sun, Cloud, Star, Underline, Scribble } from "@/components/Doodles";
import { getLang } from "@/lib/lang-server";
import { t } from "@/lib/i18n";

export const revalidate = 600;

const SITE = "https://vegaskiddos.com";
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

export default async function HomePage() {
  const lang = await getLang();
  const events = await getEvents(lang);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd data={siteLd} />
      {/* Hero with Three.js backdrop */}
      <section className="relative isolate overflow-hidden rounded-blob bg-gradient-to-br from-coral via-coral to-sunny p-8 text-white shadow-card sm:p-12">
        <HeroCanvas />
        <Sun className="pointer-events-none absolute right-6 top-6 h-24 w-24 animate-spin-slow opacity-30" color="#FFFFFF" />
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
        <div className="flex flex-col items-center gap-3 rounded-blob bg-gradient-to-br from-teal to-grape p-6 text-center text-white shadow-card sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="font-display text-xl font-700">{t(lang, "nl_title")}</h2>
            <p className="text-sm text-white/90">{t(lang, "nl_sub")}</p>
          </div>
          <div className="w-full max-w-sm rounded-full bg-white/10 p-1.5 sm:w-auto">
            <SubscribeBox lang={lang} />
          </div>
        </div>
      </Reveal>

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
          <a href="/submit" className="hover-pop mt-4 inline-block rounded-full bg-coral px-6 py-3 font-800 text-white shadow-pop">
            {t(lang, "nav_add")}
          </a>
          <div className="mt-6 flex flex-col items-center gap-2 border-t border-ink/10 pt-5">
            <p className="text-sm font-700 text-ink/60">{t(lang, "cta_share")}</p>
            <ShareButtons url={SITE} title="Vegas Kiddos"
              text="Vegas Kiddos — find kid-safe Las Vegas family events by age, price & neighborhood" />
          </div>
        </div>
      </Reveal>
    </div>
  );
}
