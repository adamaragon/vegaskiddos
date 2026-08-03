"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { isChunkLoadError, reloadOnChunkError, retryReload } from "@/lib/chunkReload";

// Page-level boundary for the whole [lang] tree. It catches errors in the pages
// (the layout itself still escalates to app/global-error.tsx), which is where a
// stale-deploy ChunkLoadError lands — so the same one-reload self-heal lives
// here, plus a branded fallback for everything else instead of Next's bare
// "Application error" screen.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);
  const [recovering, setRecovering] = useState(() => chunkError);

  useEffect(() => {
    if (reloadOnChunkError(error)) return; // document is being replaced
    setRecovering(false);
    Sentry.captureException(error);
  }, [error]);

  // Blank for the split second before the reload takes over.
  if (recovering) return null;

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="animate-wiggle text-7xl">🙈</p>
      <h1 className="mt-4 font-display text-4xl font-700">That didn&apos;t load right</h1>
      <p className="mt-2 text-ink/70">
        {chunkError
          ? "This page was still running an older version of the site. Reloading should sort it out."
          : "Something went wrong on our end. Give it another go — the events are still here."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => (chunkError ? retryReload() : reset())}
          className="hover-pop rounded-full bg-coral-btn px-5 py-3 font-800 text-white shadow-pop"
        >
          {chunkError ? "Reload the page" : "Try again"}
        </button>
        <Link
          href="/"
          className="rounded-full border-2 border-ink/15 px-5 py-3 font-800 text-ink/70 transition hover:border-teal"
        >
          Browse all events
        </Link>
      </div>
    </div>
  );
}
