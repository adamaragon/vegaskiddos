import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCollection, getCollectionMeta } from "@/lib/collections";
import { CollectionView } from "@/components/CollectionView";
import { getLang } from "@/lib/lang-server";

export const revalidate = 600;
const SLUG = "stem";

export function generateMetadata(): Metadata {
  const m = getCollectionMeta(SLUG)!;
  return { title: `${m.title} | Vegas Kiddos`, description: m.description };
}

export default async function Page() {
  const lang = await getLang();
  const c = await getCollection(SLUG, lang);
  if (!c) notFound();
  return <CollectionView meta={c.meta} events={c.events} />;
}
