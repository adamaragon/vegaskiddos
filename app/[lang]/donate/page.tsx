import type { Metadata } from "next";
import { getEvents } from "@/lib/data";
import { venueSlug, NEIGHBORHOODS } from "@/lib/constants";
import { COLLECTIONS } from "@/lib/collections";
import { Reveal } from "@/components/Reveal";
import { ShareButtons } from "@/components/ShareButtons";
import { Sun, Cloud, Star, Heart, Scribble, Underline } from "@/components/Doodles";
import { SITE, langAlternates } from "@/lib/seo";
import type { Lang } from "@/lib/i18n";

export const revalidate = 86400;

// ThreeSided Studios' shared payout handles (same as bigblackcards).
const PAYPAL_URL = "https://paypal.me/threesided";
const VENMO_URL = "https://venmo.com/u/adamaragon";

// Bilingual copy for the support page (en canonical, es for the /es tree).
const COPY = {
  en: {
    metaTitle: "Support Vegas Kiddos | Vegas Kiddos",
    metaDesc:
      "Vegas Kiddos is free, ad-free, and built by two local parents. If it helped you find something fun to do with your kids, chip in to keep it running.",
    heroTitle: "Buy us a juice box",
    heroSub: "…or a tank of gas to the next splash pad. Whatever keeps Vegas Kiddos free.",
    intro1pre: "Hi 👋 You just used a free, ad-free guide to find something fun to do with your kids. ",
    intro1bold: "No ads. No popups. No “sign up for our newsletter” wall. No selling your data.",
    intro1post: " We don’t even track you.",
    intro2pre: "We’re two local parents — ",
    intro2bold: "Adam & Michelle",
    intro2post:
      " — who got tired of bouncing between a dozen flyers, Facebook groups, and dead library links just to find a storytime. So we built the thing we wished existed. For free. For every Vegas family.",
    intro3:
      "But “free for you” isn’t “free for us.” The servers, the database, and the little robots that hunt down new events all send a bill every month.",
    hoodH2: "🛠️ A peek under the hood",
    hoodSub: "None of this was a job. It was nap times, late nights, and “just one more fix.”",
    hoodFoot:
      "Plus scrapers that comb the city for new events while you sleep, and a fresh English + Spanish translation for every single one.",
    costH2: "💸 What keeps the lights on",
    costCloser:
      "We’re not a charity — it’s a labor of love that quietly charges us real money every month. Anything you toss in the jar offsets the bill and tells us to keep building features instead of letting it quietly lapse.",
    donateH2: "🪙 Toss a coin in the jar",
    donateBtnSub: "Donate ↗",
    emailPre: "Prefer something else (Apple Cash, a coffee gift card, an IOU)? Email us at ",
    emailPost: ".",
    freeH2: "🌵 Tight on cash? Totally fine — here’s how to help for free",
    free1bold: "Tell another parent.",
    free1rest: " Word of mouth is how this thing grows.",
    free2link: "Submit an event",
    free2rest: " you know about — the calendar grows on local tips.",
    free3link: "Vote on what we build next",
    free3rest: " — we read every single one.",
    free4bold: "Just keep using it.",
    free4rest: " Honestly, that’s the whole point.",
    closerPre: "Made with ",
    closerMid: " and a truly unreasonable number of late nights by ",
    closerNames: "Adam & Michelle Aragon",
    closer2pre: "A ",
    closer2link: "Threesided Studios",
    closer2post: " project 🌵",
    shareText:
      "Vegas Kiddos — a free guide to kid-safe Las Vegas family events by age, price & neighborhood",
  },
  es: {
    metaTitle: "Apoya a Vegas Kiddos | Vegas Kiddos",
    metaDesc:
      "Vegas Kiddos es gratis, sin anuncios, y hecho por dos papás locales. Si te ayudó a encontrar algo divertido que hacer con tus hijos, aporta para mantenerlo en marcha.",
    heroTitle: "Invítanos un juguito",
    heroSub:
      "…o un tanque de gasolina para el próximo parque acuático. Lo que sea para mantener Vegas Kiddos gratis.",
    intro1pre:
      "Hola 👋 Acabas de usar una guía gratuita y sin anuncios para encontrar algo divertido que hacer con tus hijos. ",
    intro1bold:
      "Sin anuncios. Sin ventanas emergentes. Sin muros de “suscríbete al boletín”. Sin vender tus datos.",
    intro1post: " Ni siquiera te rastreamos.",
    intro2pre: "Somos dos papás locales — ",
    intro2bold: "Adam y Michelle",
    intro2post:
      " — que nos cansamos de rebotar entre mil volantes, grupos de Facebook y enlaces muertos de la biblioteca solo para encontrar una hora del cuento. Así que construimos lo que deseábamos que existiera. Gratis. Para cada familia de Las Vegas.",
    intro3:
      "Pero “gratis para ti” no es “gratis para nosotros”. Los servidores, la base de datos y los pequeños robots que rastrean nuevos eventos mandan una factura cada mes.",
    hoodH2: "🛠️ Un vistazo tras bambalinas",
    hoodSub: "Nada de esto fue un trabajo. Fueron siestas, desvelos y “solo un arreglito más”.",
    hoodFoot:
      "Además, rastreadores que peinan la ciudad en busca de nuevos eventos mientras duermes, y una traducción al inglés y español para cada uno.",
    costH2: "💸 Lo que mantiene las luces encendidas",
    costCloser:
      "No somos una organización benéfica — es un trabajo de amor que nos cuesta dinero real cada mes. Lo que eches al bote ayuda a cubrir la cuenta y nos dice que sigamos construyendo en vez de dejarlo morir en silencio.",
    donateH2: "🪙 Echa una moneda al bote",
    donateBtnSub: "Donar ↗",
    emailPre:
      "¿Prefieres otra cosa (Apple Cash, una tarjeta de regalo, un pagaré)? Escríbenos a ",
    emailPost: ".",
    freeH2: "🌵 ¿Sin dinero? No hay problema — así puedes ayudar gratis",
    free1bold: "Cuéntale a otra mamá o papá.",
    free1rest: " El boca a boca es como crece esto.",
    free2link: "Envía un evento",
    free2rest: " que conozcas — el calendario crece con datos locales.",
    free3link: "Vota por lo que construimos después",
    free3rest: " — leemos cada uno.",
    free4bold: "Solo sigue usándolo.",
    free4rest: " En serio, ese es todo el punto.",
    closerPre: "Hecho con ",
    closerMid: " y una cantidad verdaderamente irracional de desvelos por ",
    closerNames: "Adam y Michelle Aragon",
    closer2pre: "Un proyecto de ",
    closer2link: "Threesided Studios",
    closer2post: " 🌵",
    shareText:
      "Vegas Kiddos — una guía gratuita de eventos familiares seguros en Las Vegas por edad, precio y vecindario",
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = (await params) as { lang: Lang };
  const c = COPY[lang] ?? COPY.en;
  return {
    title: c.metaTitle,
    description: c.metaDesc,
    alternates: langAlternates(lang, "/donate"),
  };
}

export default async function DonatePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = (await params) as { lang: Lang };
  const es = lang === "es";
  const c = COPY[lang] ?? COPY.en;

  const events = await getEvents();
  const eventCount = events.length;
  const venueCount = new Set(
    events.map((e) => venueSlug(e.venue || "")).filter(Boolean)
  ).size;
  const hoods = NEIGHBORHOODS.length;
  const guides = COLLECTIONS.length;
  const nf = (n: number) => n.toLocaleString("en-US");

  const stats: [string, string][] = es
    ? [
        [nf(eventCount), "eventos para niños — y creciendo cada día"],
        [nf(venueCount), `lugares en ${hoods} vecindarios de Las Vegas`],
        [`${guides}`, "guías hechas a mano — parques acuáticos, hora del cuento, escapa del calor…"],
        ["2", "idiomas — cada evento en inglés y español"],
        ["10,000+", "líneas de código, escritas después de que los niños se durmieron"],
        ["100+", "commits de madrugada (y contando)"],
      ]
    : [
        [nf(eventCount), "kid-friendly events listed — and growing every day"],
        [nf(venueCount), `venues across ${hoods} Las Vegas neighborhoods`],
        [`${guides}`, "hand-built guides — splash pads, storytime, beat-the-heat…"],
        ["2", "languages — every event in English and Spanish"],
        ["10,000+", "lines of code, written after the kids went to bed"],
        ["100+", "late-night commits (and counting)"],
      ];

  const costs: [string, string][] = es
    ? [
        ["Cloudflare", "sirviendo el sitio rápido, en todas partes"],
        ["Airtable", "la base de datos detrás de cada evento"],
        ["OpenAI", "traduciendo cada evento al español y llenando los huecos"],
        ["Resend", "los correos de recordatorio de los eventos que guardas"],
        ["vegaskiddos.com", "la renta anual del nombre"],
      ]
    : [
        ["Cloudflare", "serving the site fast, everywhere"],
        ["Airtable", "the events database behind every listing"],
        ["OpenAI", "translating every event to Spanish + filling in the gaps"],
        ["Resend", "the reminder emails for events you save"],
        ["vegaskiddos.com", "the annual rent on the name"],
      ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Hero */}
      <header className="relative text-center">
        <Sun className="pointer-events-none absolute -right-4 -top-2 h-16 w-16 animate-spin-slow opacity-70" />
        <h1 className="font-display text-4xl font-700 leading-tight sm:text-5xl">
          {c.heroTitle} <span aria-hidden>🧃</span>
        </h1>
        <Underline className="mx-auto -mt-1 h-5 w-64 max-w-[80%] text-coral" />
        <p className="mt-3 text-lg text-ink/70">{c.heroSub}</p>
      </header>

      {/* Guilt-trip intro */}
      <Reveal as="section" variant="pop" className="mt-8">
        <div className="relative overflow-hidden rounded-blob bg-gradient-to-br from-coral via-coral-dark to-coral-btn p-6 text-white shadow-card sm:p-8">
          <Cloud className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 text-white/15" />
          <div className="relative space-y-3 text-base leading-relaxed [text-shadow:0_1px_3px_rgb(0_0_0/0.28)] sm:text-lg">
            <p>
              {c.intro1pre}
              <span className="font-800">{c.intro1bold}</span>
              {c.intro1post}
            </p>
            <p>
              {c.intro2pre}
              <span className="font-700">{c.intro2bold}</span>
              {c.intro2post}
            </p>
            <p className="text-white/90">{c.intro3}</p>
          </div>
        </div>
      </Reveal>

      {/* Under the hood — the work */}
      <Reveal as="section" variant="pop" className="mt-8">
        <div className="rounded-blob border-2 border-dashed border-ink/15 bg-white p-6 shadow-card sm:p-8">
          <h2 className="font-display text-2xl font-700 text-ink">{c.hoodH2}</h2>
          <p className="mt-1 text-sm text-ink/70">{c.hoodSub}</p>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
            {stats.map(([num, label]) => (
              <div key={label}>
                <dt className="font-display text-3xl font-800 text-coral-dark sm:text-4xl">
                  {num}
                </dt>
                <dd className="mt-1 text-sm leading-snug text-ink/70">{label}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 border-t border-ink/10 pt-4 text-sm text-ink/70">{c.hoodFoot}</p>
        </div>
      </Reveal>

      {/* What it costs */}
      <Reveal as="section" variant="pop" className="mt-8">
        <div className="rounded-blob bg-sand/60 p-6 shadow-card sm:p-8">
          <h2 className="font-display text-2xl font-700 text-ink">{c.costH2}</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-ink/80 sm:text-base">
            {costs.map(([name, desc]) => (
              <li key={name} className="flex items-baseline gap-3">
                <span className="w-28 shrink-0 font-700 text-teal-btn">{name}</span>
                <span className="flex-1 text-ink/70">{desc}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-ink/10 pt-4 text-sm leading-relaxed text-ink/70">
            {c.costCloser}
          </p>
        </div>
      </Reveal>

      {/* Donate buttons */}
      <Reveal as="section" variant="pop" className="mt-8">
        <h2 className="text-center font-display text-2xl font-700 text-ink">{c.donateH2}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a
            href={PAYPAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover-pop flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-[#0070ba] bg-[#0070ba]/10 py-5 transition hover:bg-[#0070ba]/20"
          >
            <span className="font-display text-2xl font-800 text-[#0070ba]">PayPal</span>
            <span className="text-xs font-800 uppercase tracking-[0.2em] text-[#0070ba]/80">
              {c.donateBtnSub}
            </span>
          </a>
          <a
            href={VENMO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover-pop flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-[#3d95ce] bg-[#3d95ce]/10 py-5 transition hover:bg-[#3d95ce]/20"
          >
            <span className="font-display text-2xl font-800 text-[#3d95ce]">Venmo</span>
            <span className="text-xs font-800 uppercase tracking-[0.2em] text-[#3d95ce]/80">
              venmo.com ↗
            </span>
          </a>
        </div>
        <p className="mt-3 text-center text-sm text-ink/70">
          {c.emailPre}
          <a href="mailto:hello@vegaskiddos.com" className="font-700 text-coral hover:underline">
            hello@vegaskiddos.com
          </a>
          {c.emailPost}
        </p>
      </Reveal>

      {/* Free ways to help */}
      <Reveal as="section" variant="pop" className="mt-8">
        <div className="relative overflow-hidden rounded-blob bg-gradient-to-br from-grape to-teal-btn p-6 text-white shadow-card [text-shadow:0_1px_2px_rgb(0_0_0/0.25)] sm:p-8">
          <Scribble className="pointer-events-none absolute right-5 top-4 hidden h-12 w-12 text-white/15 sm:block" />
          <h2 className="font-display text-2xl font-700">{c.freeH2}</h2>
          <ul className="mt-4 space-y-2.5 text-base">
            <li className="flex gap-2">
              <Star className="mt-1 h-4 w-4 shrink-0 text-sunny" />
              <span>
                <span className="font-700">{c.free1bold}</span>
                {c.free1rest}
              </span>
            </li>
            <li className="flex gap-2">
              <Star className="mt-1 h-4 w-4 shrink-0 text-sunny" />
              <span>
                <a href="/submit" className="font-700 underline decoration-white/40 underline-offset-2 hover:decoration-white">
                  {c.free2link}
                </a>
                {c.free2rest}
              </span>
            </li>
            <li className="flex gap-2">
              <Star className="mt-1 h-4 w-4 shrink-0 text-sunny" />
              <span>
                <a href="/features" className="font-700 underline decoration-white/40 underline-offset-2 hover:decoration-white">
                  {c.free3link}
                </a>
                {c.free3rest}
              </span>
            </li>
            <li className="flex gap-2">
              <Star className="mt-1 h-4 w-4 shrink-0 text-sunny" />
              <span>
                <span className="font-700">{c.free4bold}</span>
                {c.free4rest}
              </span>
            </li>
          </ul>
          <div className="mt-5 flex flex-col items-center gap-2 border-t border-white/20 pt-5 text-center">
            <ShareButtons url={SITE} title="Vegas Kiddos" text={c.shareText} />
          </div>
        </div>
      </Reveal>

      {/* Closer */}
      <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-sm italic text-ink/70">
        {c.closerPre}
        <Heart className="inline h-4 w-4 text-coral" />
        {c.closerMid}
        <span className="font-700 not-italic text-ink/80">{c.closerNames}</span>
      </p>
      <p className="mt-1 text-center text-xs text-ink/60">
        {c.closer2pre}
        <a href="https://threesided.com" target="_blank" rel="noopener noreferrer" className="font-700 text-grape underline">
          {c.closer2link}
        </a>
        {c.closer2post}
      </p>
    </div>
  );
}
