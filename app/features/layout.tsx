import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vote on Features — Vegas Kiddos",
  description:
    "Help shape Vegas Kiddos. Vote on what we build next, or suggest your own idea.",
  alternates: { canonical: "https://vegaskiddos.com/features" },
};

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
