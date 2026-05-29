import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCollection, getCollectionMeta } from "@/lib/collections";
import { CollectionView } from "@/components/CollectionView";

export const revalidate = 600;
const SLUG = "free";

export function generateMetadata(): Metadata {
  const m = getCollectionMeta(SLUG)!;
  return { title: `${m.title} | Vegas Kiddos`, description: m.description, alternates: { canonical: `https://vegaskiddos.com/${SLUG}` } };
}

export default async function Page() {
  const c = await getCollection(SLUG);
  if (!c) notFound();
  return <CollectionView meta={c.meta} events={c.events} />;
}
