import type { Metadata } from "next";
import { langAlternates } from "@/lib/seo";
import type { Lang } from "@/lib/i18n";

// submit/page.tsx is a client component and can't export metadata itself, so
// the route's title/description/canonical/hreflang live here.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = (await params) as { lang: Lang };
  const es = lang === "es";
  return {
    title: es ? "Agregar un evento — Vegas Kiddos" : "Add an Event — Vegas Kiddos",
    description: es
      ? "¿Conoces un evento para niños en Las Vegas? Envíalo y lo revisaremos para publicarlo."
      : "Know a kid-friendly Las Vegas event? Submit it and we'll review it for the site.",
    alternates: langAlternates(lang, "/submit"),
  };
}

export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return children;
}
