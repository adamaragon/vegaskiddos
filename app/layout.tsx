import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { CrayonDefs, Star } from "@/components/Doodles";
import { PWARegister } from "@/components/PWARegister";
import type { Viewport } from "next";
import Link from "next/link";

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

export const metadata: Metadata = {
  title: "Vegas Kiddos — Kid-safe events across Las Vegas",
  description:
    "Find baby, toddler, kid, and tween events near you in Las Vegas. Filter by neighborhood, age, and price. A free resource for local parents.",
  metadataBase: new URL("https://vegaskiddos.com"),
  keywords: [
    "Las Vegas kids events", "Las Vegas family events", "toddler activities Las Vegas",
    "free kids events Las Vegas", "things to do with kids Las Vegas", "Summerlin", "Henderson",
  ],
  alternates: { canonical: "https://vegaskiddos.com" },
  openGraph: {
    title: "Vegas Kiddos",
    description: "Kid-safe events across Las Vegas, sorted by age, price, and neighborhood.",
    type: "website",
    url: "https://vegaskiddos.com",
    siteName: "Vegas Kiddos",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vegas Kiddos",
    description: "Kid-safe events across Las Vegas, sorted by age, price, and neighborhood.",
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  appleWebApp: { capable: true, title: "Vegas Kiddos", statusBarStyle: "default" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
      <body className="font-body min-h-screen antialiased">
        <PWARegister />
        <CrayonDefs />
        <Header />
        <main>{children}</main>
        <footer className="mt-16 border-t-2 border-dashed border-ink/15 bg-white/70">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3">
            <div>
              <p className="font-display text-xl font-700">
                <span className="text-coral-dark">Vegas</span> <span className="text-teal-dark">Kiddos</span> 🌵
              </p>
              <p className="mt-2 text-sm text-ink/60">
                A free, kid-safe guide to Las Vegas family events — sorted by age, price, and neighborhood.
              </p>
            </div>
            <nav className="text-sm">
              <p className="font-display font-600 text-ink/80">Explore</p>
              <ul className="mt-2 space-y-1.5 text-ink/60">
                {[
                  ["/", "Events"],
                  ["/features", "Vote on features"],
                  ["/changelog", "What's new"],
                  ["/about", "About"],
                ].map(([href, label]) => (
                  <li key={href}>
                    <Link href={href} className="hover:text-coral">{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav className="text-sm">
              <p className="font-display font-600 text-ink/80">More</p>
              <ul className="mt-2 space-y-1.5 text-ink/60">
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
          <div className="border-t border-ink/10 py-5 text-center text-sm text-ink/60">
            <p className="flex items-center justify-center gap-1.5">
              Made with <Star className="inline h-4 w-4 text-coral" /> by{" "}
              <span className="font-700 text-ink/80">Adam &amp; Michelle Aragon</span>
            </p>
            <p className="mt-1 text-xs text-ink/50">
              A{" "}
              <a href="https://threesided.com" target="_blank" rel="noopener noreferrer"
                className="font-700 text-grape underline">
                Threesided Studios
              </a>{" "}
              project · Always confirm details with the venue.
            </p>
            <p className="mt-2 text-[11px] text-ink/40">
              Hero model:{" "}
              <a href="https://sketchfab.com/3d-models/baby-dino-7f6990157fd44a0c88c5834b5fe04413"
                target="_blank" rel="noopener noreferrer" className="underline">
                &ldquo;Baby Dino&rdquo;
              </a>{" "}
              by rickymorgue, licensed under{" "}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline">
                CC-BY-4.0
              </a>.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
