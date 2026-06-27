import type { Metadata } from "next";
import { langAlternates } from "@/lib/seo";
import type { Lang } from "@/lib/i18n";

// Per-locale metadata so /es/contact self-canonicals (not to the English URL)
// and ships reciprocal hreflang via langAlternates().
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = (await params) as { lang: Lang };
  const es = lang === "es";
  return {
    title: es ? "Contacto y comentarios — Vegas Kiddos" : "Contact & Feedback — Vegas Kiddos",
    description: es
      ? "¿Tienes comentarios, un dato de un evento o una idea para Vegas Kiddos? Escríbele al equipo."
      : "Got feedback, an event tip, or an idea for Vegas Kiddos? Send the team a message.",
    alternates: langAlternates(lang, "/contact"),
  };
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
