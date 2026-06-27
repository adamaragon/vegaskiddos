import type { Metadata } from "next";
import { langAlternates } from "@/lib/seo";
import type { Lang } from "@/lib/i18n";

// Per-locale metadata so /es/features self-canonicals (not to the English URL)
// and ships reciprocal hreflang via langAlternates().
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = (await params) as { lang: Lang };
  const es = lang === "es";
  return {
    title: es ? "Vota por funciones — Vegas Kiddos" : "Vote on Features — Vegas Kiddos",
    description: es
      ? "Ayuda a dar forma a Vegas Kiddos. Vota lo que construimos a continuación, o sugiere tu propia idea."
      : "Help shape Vegas Kiddos. Vote on what we build next, or suggest your own idea.",
    alternates: langAlternates(lang, "/features"),
  };
}

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
