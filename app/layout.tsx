import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { CrayonDefs, Heart } from "@/components/Doodles";
import { PWARegister } from "@/components/PWARegister";
import { LangToggle } from "@/components/LangToggle";
import { getLang, getPath } from "@/lib/lang-server";
import { t } from "@/lib/i18n";
import type { Viewport } from "next";
import Script from "next/script";
import Link from "next/link";

// Privacy-friendly, cookieless analytics (Plausible). Site-specific script.
const PLAUSIBLE_SRC = "https://plausible.io/js/pa-pzyYa6yNV14PH2tAZYFUG.js";

export const viewport: Viewport = {
  themeColor: "#FF6B5E",
};

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fredoka",
});
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-nunito",
});

const SITE = "https://vegaskiddos.com";

// Per-request metadata: localizes title/description for the /es tree and emits
// canonical + reciprocal hreflang so Google indexes both languages correctly.
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const path = await getPath();
  const suffix = path === "/" ? "" : path;
  const enUrl = `${SITE}${suffix}`;
  const esUrl = `${SITE}/es${suffix}`;
  const canonical = lang === "es" ? esUrl : enUrl;
  const title = t(lang, "meta_title");
  const description = t(lang, "meta_desc");
  return {
    title,
    description,
    metadataBase: new URL(SITE),
    keywords: [
      "Las Vegas kids events", "Las Vegas family events", "toddler activities Las Vegas",
      "free kids events Las Vegas", "things to do with kids Las Vegas", "Summerlin", "Henderson",
    ],
    alternates: {
      canonical,
      languages: { en: enUrl, es: esUrl, "x-default": enUrl },
    },
    openGraph: {
      title: "Vegas Kiddos",
      description,
      type: "website",
      url: canonical,
      siteName: "Vegas Kiddos",
      locale: lang === "es" ? "es_US" : "en_US",
      alternateLocale: lang === "es" ? "en_US" : "es_US",
    },
    twitter: {
      card: "summary_large_image",
      title: "Vegas Kiddos",
      description,
    },
    verification: process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : undefined,
    appleWebApp: { capable: true, title: "Vegas Kiddos", statusBarStyle: "default" },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${fredoka.variable} ${nunito.variable}`}>
      <body className="font-body min-h-screen antialiased">
        <Script defer src={PLAUSIBLE_SRC} strategy="afterInteractive" />
        <Script id="plausible-init" strategy="afterInteractive">
          {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`}
        </Script>
        <PWARegister />
        <CrayonDefs />
        <Header lang={lang} />
        <main>{children}</main>
        <footer className="mt-16 border-t-2 border-dashed border-ink/15 bg-white/70">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3">
            <div>
              <p className="font-display text-xl font-700">
                <span className="text-coral-dark">Vegas</span> <span className="text-teal-btn">Kiddos</span> 🌵
              </p>
              <p className="mt-2 text-sm text-ink/70">{t(lang, "foot_tagline")}</p>
              <div className="mt-3"><LangToggle lang={lang} /></div>
            </div>
            <nav className="text-sm">
              <p className="font-display font-600 text-ink/80">{t(lang, "foot_explore")}</p>
              <ul className="mt-2 space-y-1.5 text-ink/70">
                {[
                  ["/", "All events"],
                  ["/this-weekend", "This weekend"],
                  ["/free", "Free events"],
                  ["/today", "Today"],
                  ["/beat-the-heat", "Beat the heat"],
                  ["/splash-pads", "Splash pads"],
                  ["/storytime", "Storytime"],
                  ["/arts-and-crafts", "Arts & crafts"],
                  ["/stem", "STEM & science"],
                  ["/features", "Vote on features"],
                  ["/about", "About"],
                ].map(([href, label]) => (
                  <li key={href}>
                    <Link href={href} className="hover:text-coral">{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav className="text-sm">
              <p className="font-display font-600 text-ink/80">{t(lang, "foot_more")}</p>
              <ul className="mt-2 space-y-1.5 text-ink/70">
                {[
                  ["/submit", "Add an event"],
                  ["/contact", "Contact & feedback"],
                  ["/style-guide", "Style guide"],
                  ["/admin", "Admin"],
                ].map(([href, label]) => (
                  <li key={href}>
                    <Link href={href} className="hover:text-coral">{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="border-t border-ink/10 py-5 text-center text-sm text-ink/70">
            <p className="flex items-center justify-center gap-1.5">
              {t(lang, "foot_madeby")} <Heart className="inline h-4 w-4 text-coral" /> {lang === "es" ? "por" : "by"}{" "}
              <span className="font-700 text-ink/80">Adam &amp; Michelle Aragon</span>
            </p>
            <p className="mt-1 text-xs text-ink/70">
              A{" "}
              <a href="https://threesided.com" target="_blank" rel="noopener noreferrer"
                className="font-700 text-grape underline">
                Threesided Studios
              </a>{" "}
              · {t(lang, "foot_confirm")}
            </p>
            <p className="mt-2 text-[11px] text-ink/70">
              Hero model:{" "}
              <a href="https://sketchfab.com/3d-models/baby-dino-7f6990157fd44a0c88c5834b5fe04413"
                target="_blank" rel="noopener noreferrer" className="underline">
                &ldquo;Baby Dino&rdquo;
              </a>{" "}
              by rickymorgue, licensed under{" "}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline">
                CC-BY-4.0
              </a>.{" "}
              <a href="https://github.com/adamaragon-neo/vegaskiddos/blob/main/CODE_OF_CONDUCT.md"
                target="_blank" rel="noopener noreferrer" className="underline">
                Code of Conduct
              </a>.
            </p>
            <p className="mt-3">
              <a href="https://www.netlify.com" target="_blank" rel="noopener noreferrer"
                aria-label="This site is powered by Netlify">
                <img
                  src="https://www.netlify.com/img/global/badges/netlify-color-accent.svg"
                  alt="Powered by Netlify"
                  width="114"
                  height="51"
                  className="mx-auto"
                />
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
