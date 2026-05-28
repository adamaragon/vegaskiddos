import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact & Feedback — Vegas Kiddos",
  description:
    "Got feedback, an event tip, or an idea for Vegas Kiddos? Send the team a message.",
  alternates: { canonical: "https://vegaskiddos.com/contact" },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
