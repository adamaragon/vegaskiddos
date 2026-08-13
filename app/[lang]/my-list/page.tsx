import type { Metadata } from "next";
import { getEvents } from "@/lib/data";
import { MyList } from "@/components/MyList";
import { langAlternates } from "@/lib/seo";
import type { Lang } from "@/lib/i18n";
import { PAGE_REVALIDATE } from "@/lib/pageCache";

export const revalidate = PAGE_REVALIDATE;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = (await params) as { lang: Lang };
  return {
    title: "My List — Vegas Kiddos",
    description: "Your saved kid-friendly events for weekend planning.",
    alternates: langAlternates(lang, "/my-list"),
  };
}

export default async function MyListPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = (await params) as { lang: Lang };
  const events = await getEvents(lang);
  return <MyList events={events} lang={lang} />;
}
