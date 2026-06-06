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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = (await params) as { lang: Lang };
  return {
    title: "Support Vegas Kiddos | Vegas Kiddos",
    description:
      "Vegas Kiddos is free, ad-free, and built by two local parents. If it helped you find something fun to do with your kids, chip in to keep it running.",
    alternates: langAlternates(lang, "/donate"),
  };
}

export default async function DonatePage() {
  const events = await getEvents();
  const eventCount = events.length;
  const venueCount = new Set(
    events.map((e) => venueSlug(e.venue || "")).filter(Boolean)
  ).size;
  const hoods = NEIGHBORHOODS.length;
  const guides = COLLECTIONS.length;
  const nf = (n: number) => n.toLocaleString("en-US");

  const stats: [string, string][] = [
    [nf(eventCount), "kid-friendly events listed — and growing every day"],
    [nf(venueCount), `venues across ${hoods} Las Vegas neighborhoods`],
    [`${guides}`, "hand-built guides — splash pads, storytime, beat-the-heat…"],
    ["2", "languages — every event in English and Spanish"],
    ["10,000+", "lines of code, written after the kids went to bed"],
    ["100+", "late-night commits (and counting)"],
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Hero */}
      <header className="relative text-center">
        <Sun className="pointer-events-none absolute -right-4 -top-2 h-16 w-16 animate-spin-slow opacity-70" />
        <h1 className="font-display text-4xl font-700 leading-tight sm:text-5xl">
          Buy us a juice box <span aria-hidden>🧃</span>
        </h1>
        <Underline className="mx-auto -mt-1 h-5 w-64 max-w-[80%] text-coral" />
        <p className="mt-3 text-lg text-ink/70">
          …or a tank of gas to the next splash pad. Whatever keeps Vegas Kiddos free.
        </p>
      </header>

      {/* Guilt-trip intro */}
      <Reveal as="section" variant="pop" className="mt-8">
        <div className="relative overflow-hidden rounded-blob bg-gradient-to-br from-coral to-sunny p-6 text-white shadow-card sm:p-8">
          <Cloud className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 text-white/15" />
          <div className="relative space-y-3 text-base leading-relaxed sm:text-lg">
            <p>
              Hi 👋 You just used a free, ad-free guide to find something fun to do with
              your kids.{" "}
              <span className="font-800">
                No ads. No popups. No “sign up for our newsletter” wall. No selling your
                data.
              </span>{" "}
              We don’t even track you.
            </p>
            <p>
              We’re two local parents — <span className="font-700">Adam &amp; Michelle</span>{" "}
              — who got tired of bouncing between a dozen flyers, Facebook groups, and dead
              library links just to find a storytime. So we built the thing we wished
              existed. For free. For every Vegas family.
            </p>
            <p className="text-white/90">
              But “free for you” isn’t “free for us.” The servers, the database, and the
              little robots that hunt down new events all send a bill every month.
            </p>
          </div>
        </div>
      </Reveal>

      {/* Under the hood — the work */}
      <Reveal as="section" variant="pop" className="mt-8">
        <div className="rounded-blob border-2 border-dashed border-ink/15 bg-white p-6 shadow-card sm:p-8">
          <h2 className="font-display text-2xl font-700 text-ink">
            🛠️ A peek under the hood
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            None of this was a job. It was nap times, late nights, and “just one more fix.”
          </p>
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
          <p className="mt-5 border-t border-ink/10 pt-4 text-sm text-ink/70">
            Plus scrapers that comb the city for new events while you sleep, and a fresh
            English + Spanish translation for every single one.
          </p>
        </div>
      </Reveal>

      {/* What it costs */}
      <Reveal as="section" variant="pop" className="mt-8">
        <div className="rounded-blob bg-sand/60 p-6 shadow-card sm:p-8">
          <h2 className="font-display text-2xl font-700 text-ink">
            💸 What keeps the lights on
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm text-ink/80 sm:text-base">
            {[
              ["Cloudflare", "serving the site fast, everywhere"],
              ["Airtable", "the events database behind every listing"],
              ["OpenAI", "translating every event to Spanish + filling in the gaps"],
              ["Resend", "the reminder emails for events you save"],
              ["vegaskiddos.com", "the annual rent on the name"],
            ].map(([name, desc]) => (
              <li key={name} className="flex items-baseline gap-3">
                <span className="w-28 shrink-0 font-700 text-teal-btn">{name}</span>
                <span className="flex-1 text-ink/70">{desc}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-ink/10 pt-4 text-sm leading-relaxed text-ink/70">
            We’re not a charity — it’s a labor of love that quietly charges us real money
            every month. Anything you toss in the jar offsets the bill and tells us to keep
            building features instead of letting it quietly lapse.
          </p>
        </div>
      </Reveal>

      {/* Donate buttons */}
      <Reveal as="section" variant="pop" className="mt-8">
        <h2 className="text-center font-display text-2xl font-700 text-ink">
          🪙 Toss a coin in the jar
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a
            href={PAYPAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover-pop flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-[#0070ba] bg-[#0070ba]/10 py-5 transition hover:bg-[#0070ba]/20"
          >
            <span className="font-display text-2xl font-800 text-[#0070ba]">PayPal</span>
            <span className="text-xs font-800 uppercase tracking-[0.2em] text-[#0070ba]/80">
              Donate ↗
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
          Prefer something else (Apple Cash, a coffee gift card, an IOU)? Email us at{" "}
          <a href="mailto:hello@vegaskiddos.com" className="font-700 text-coral hover:underline">
            hello@vegaskiddos.com
          </a>
          .
        </p>
      </Reveal>

      {/* Free ways to help */}
      <Reveal as="section" variant="pop" className="mt-8">
        <div className="relative overflow-hidden rounded-blob bg-gradient-to-br from-grape to-teal p-6 text-white shadow-card sm:p-8">
          <Scribble className="pointer-events-none absolute right-5 top-4 hidden h-12 w-12 text-white/15 sm:block" />
          <h2 className="font-display text-2xl font-700">
            🌵 Tight on cash? Totally fine — here’s how to help for free
          </h2>
          <ul className="mt-4 space-y-2.5 text-base">
            <li className="flex gap-2">
              <Star className="mt-1 h-4 w-4 shrink-0 text-sunny" />
              <span>
                <span className="font-700">Tell another parent.</span> Word of mouth is how
                this thing grows.
              </span>
            </li>
            <li className="flex gap-2">
              <Star className="mt-1 h-4 w-4 shrink-0 text-sunny" />
              <span>
                <a href="/submit" className="font-700 underline decoration-white/40 underline-offset-2 hover:decoration-white">
                  Submit an event
                </a>{" "}
                you know about — the calendar grows on local tips.
              </span>
            </li>
            <li className="flex gap-2">
              <Star className="mt-1 h-4 w-4 shrink-0 text-sunny" />
              <span>
                <a href="/features" className="font-700 underline decoration-white/40 underline-offset-2 hover:decoration-white">
                  Vote on what we build next
                </a>{" "}
                — we read every single one.
              </span>
            </li>
            <li className="flex gap-2">
              <Star className="mt-1 h-4 w-4 shrink-0 text-sunny" />
              <span>
                <span className="font-700">Just keep using it.</span> Honestly, that’s the
                whole point.
              </span>
            </li>
          </ul>
          <div className="mt-5 flex flex-col items-center gap-2 border-t border-white/20 pt-5 text-center">
            <ShareButtons
              url={SITE}
              title="Vegas Kiddos"
              text="Vegas Kiddos — a free guide to kid-safe Las Vegas family events by age, price & neighborhood"
            />
          </div>
        </div>
      </Reveal>

      {/* Closer */}
      <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-sm italic text-ink/70">
        Made with <Heart className="inline h-4 w-4 text-coral" /> and a truly unreasonable
        number of late nights by{" "}
        <span className="font-700 not-italic text-ink/80">Adam &amp; Michelle Aragon</span>
      </p>
      <p className="mt-1 text-center text-xs text-ink/60">
        A{" "}
        <a href="https://threesided.com" target="_blank" rel="noopener noreferrer" className="font-700 text-grape underline">
          Threesided Studios
        </a>{" "}
        project 🌵
      </p>
    </div>
  );
}
