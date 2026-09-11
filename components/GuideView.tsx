import Link from "next/link";
import type { GuideMeta } from "@/lib/guides";
import type { Lang } from "@/lib/i18n";
import { JsonLd } from "./JsonLd";
import { SITE, breadcrumbLd } from "@/lib/seo";

export function GuideView({
  meta,
  lang = "en",
  children,
}: {
  meta: GuideMeta;
  lang?: Lang;
  children: React.ReactNode;
}) {
  const base = lang === "es" ? `${SITE}/es` : SITE;
  const path = `/guides/${meta.slug}`;
  const crumbs = breadcrumbLd([
    { name: "Vegas Kiddos", url: base },
    { name: meta.title, url: `${base}${path}` },
  ]);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    description: meta.description,
    url: `${base}${path}`,
    author: { "@type": "Organization", name: "Vegas Kiddos" },
    publisher: { "@type": "Organization", name: "Vegas Kiddos", url: SITE },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={[articleLd, crumbs]} />
      <Link href="/" className="text-sm font-700 text-teal-btn hover:underline">
        ← All events
      </Link>

      {meta.draftForReview && (
        <aside
          className="mt-4 rounded-blob border-2 border-dashed border-sunny bg-sunny/20 px-5 py-4"
          role="note"
          aria-label="Draft notice"
        >
          <p className="font-display text-sm font-800 uppercase tracking-wide text-ink/70">
            Draft for parent review
          </p>
          <p className="mt-1 text-base text-ink/80">
            Michelle&apos;s pass is open. This is not final publish yet. We are still
            polishing a few details, but the guide body is ready for your read-through.
          </p>
        </aside>
      )}

      <header className="mt-6">
        <h1 className="font-display text-3xl font-700 sm:text-4xl">{meta.title}</h1>
        <p className="mt-3 text-lg text-ink/70">{meta.description}</p>
      </header>

      <article className="guide-prose mt-8">{children}</article>
    </div>
  );
}
