// Editorial parent guides — static content pages at /guides/[slug].
// Collections (lib/collections.ts) are event-filter feeds; guides are long-form.

export interface GuideMeta {
  slug: string;
  title: string;
  description: string;
  /** When true, show a parent-review banner and softer "still polishing" note. */
  draftForReview?: boolean;
}

export const GUIDES: GuideMeta[] = [
  {
    slug: "fall-halloween-guide-2026",
    title: "Fall and Halloween with kids in Las Vegas",
    description:
      "A plain parent guide to fall and Halloween around the valley: sorted by age, free vs paid, and neighborhood. Verified venue facts where noted.",
    draftForReview: true,
  },
];

export function getGuideMeta(slug: string): GuideMeta | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function getAllGuideSlugs(): string[] {
  return GUIDES.map((g) => g.slug);
}
