import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { Header } from "@/components/Header";
import { CrayonDefs, Heart } from "@/components/Doodles";
import { PWARegister } from "@/components/PWARegister";
import { ChunkErrorGuard } from "@/components/ChunkErrorGuard";
import { LangToggle } from "@/components/LangToggle";
import { ConsentBanner } from "@/components/ConsentBanner";
import { CookieSettingsLink } from "@/components/CookieSettingsLink";
import { t, type Lang } from "@/lib/i18n";
import { SITE } from "@/lib/seo";
import type { Viewport } from "next";
import Script from "next/script";
import Link from "next/link";

// Google Analytics 4 — the sole analytics vendor (Plausible removed 2026-06).
const GA_ID = "G-QDXDVLCLGC";

export const viewport: Viewport = {
  themeColor: "#FF6B5E",
};

// Locale is a route segment now, so both language trees prerender statically.
// generateStaticParams enumerates them; an unknown :lang 404s (see below).
export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "es" }];
}

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

// Base metadata shared by every page. Per-page canonical + reciprocal hreflang
// are supplied by each page's own generateMetadata via langAlternates() (the
// layout no longer knows the path, since locale comes from params, not headers).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = (await params) as { lang: Lang };
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
    openGraph: {
      title: "Vegas Kiddos",
      description,
      type: "website",
      siteName: "Vegas Kiddos",
      locale: lang === "es" ? "es_US" : "en_US",
      alternateLocale: lang === "es" ? "en_US" : "es_US",
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: "Vegas Kiddos",
      description,
      images: ["/opengraph-image"],
    },
    verification: process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : undefined,
    appleWebApp: { capable: true, title: "Vegas Kiddos", statusBarStyle: "default" },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = (await params) as { lang: Lang };
  // Only en/es trees exist; anything else (e.g. /fr) is a real 404.
  if (lang !== "en" && lang !== "es") notFound();

  return (
    <html lang={lang} className={`${fredoka.variable} ${nunito.variable}`}>
      <body className="font-body min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only rounded-full bg-ink px-4 py-2 font-700 text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100]"
        >
          {lang === "es" ? "Saltar al contenido" : "Skip to content"}
        </a>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});gtag('js',new Date());gtag('config','${GA_ID}');`}
        </Script>
        <ChunkErrorGuard />
        <PWARegister />
        <ConsentBanner lang={lang} />
        <CrayonDefs />
        <Header lang={lang} />
        <main id="main">{children}</main>
        <footer className="mt-16 border-t-2 border-dashed border-ink/15 bg-white/70">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3">
            <div>
              <p className="font-display text-xl font-700">
                <span className="text-coral-dark">Vegas</span> <span className="text-teal-btn">Kiddos</span> 🌵
              </p>
              <p className="mt-2 text-sm text-ink/70">{t(lang, "foot_tagline")}</p>
              <div className="mt-3"><LangToggle lang={lang} /></div>
              <div className="mt-4">
                <Link
                  href="/donate"
                  className="hover-pop inline-flex items-center gap-1.5 rounded-full bg-sunny px-4 py-2 font-800 text-ink shadow-pop ring-1 ring-coral/30 transition hover:bg-sunny-dark"
                >
                  🧃 {t(lang, "nav_donate")}
                </Link>
              </div>
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
                <li>
                  <CookieSettingsLink label={t(lang, "cc_settings")} />
                </li>
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
              <a href="https://github.com/adamaragon/vegaskiddos/blob/main/CODE_OF_CONDUCT.md"
                target="_blank" rel="noopener noreferrer" className="underline">
                Code of Conduct
              </a>.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
