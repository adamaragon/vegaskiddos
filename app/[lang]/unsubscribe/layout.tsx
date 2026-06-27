import type { Metadata } from "next";
import type { Lang } from "@/lib/i18n";

// Unsubscribe is a transactional page reached from an email link — give it a
// title but keep it out of the index.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = (await params) as { lang: Lang };
  const es = lang === "es";
  return {
    title: es ? "Cancelar suscripción — Vegas Kiddos" : "Unsubscribe — Vegas Kiddos",
    robots: { index: false, follow: false },
  };
}

export default function UnsubscribeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
