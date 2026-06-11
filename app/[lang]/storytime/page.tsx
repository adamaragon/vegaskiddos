import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCollection, getCollectionMeta } from "@/lib/collections";
import { CollectionView } from "@/components/CollectionView";
import { langAlternates } from "@/lib/seo";
import type { Lang } from "@/lib/i18n";

export const revalidate = 86400;
const SLUG = "storytime";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = (await params) as { lang: Lang };
  const m = getCollectionMeta(SLUG)!;
  return {
    title: `${m.title} | Vegas Kiddos`,
    description: m.description,
    alternates: langAlternates(lang, `/${SLUG}`),
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = (await params) as { lang: Lang };
  const c = await getCollection(SLUG, lang);
  if (!c) notFound();
  return <CollectionView meta={c.meta} events={c.events} lang={lang} />;
}
