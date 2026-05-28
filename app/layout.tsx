import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";

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
  openGraph: {
    title: "Vegas Kiddos",
    description: "Kid-safe events across Las Vegas, sorted by age, price, and neighborhood.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
      <body className="font-body min-h-screen antialiased">
        <Header />
        <main>{children}</main>
        <footer className="mt-16 border-t border-ink/10 bg-white/60 py-8 text-center text-sm text-ink/60">
          <p className="font-display text-base text-ink/80">Vegas Kiddos 🌵</p>
          <p className="mt-1">
            A free community resource for Las Vegas families. Always confirm details with the venue.
          </p>
        </footer>
      </body>
    </html>
  );
}
