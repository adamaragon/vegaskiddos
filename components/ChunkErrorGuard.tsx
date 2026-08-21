"use client";

import { useEffect } from "react";
import { isChunkLoadError, reloadOnChunkError } from "@/lib/chunkReload";

// The other half of the stale-deploy self-heal in lib/chunkReload.ts.
//
// The error boundaries (app/[lang]/error.tsx, app/global-error.tsx) only see
// failures React throws during render. A dead chunk usually arrives by neither
// route:
//
//   * Router prefetches and next/dynamic load code with import(). When the file
//     is gone that rejects, and nothing awaits it, so it lands as an
//     unhandledrejection and never reaches a boundary.
//   * A <script>/<link> for a deleted chunk fires an error event on the element
//     itself. That event does not bubble and carries no Error object, so it is
//     invisible to both React and window.onerror's usual handler.
//
// Either way the page keeps whatever is already painted and simply stops
// working: no boundary, no recovery, the white screen people report after a
// deploy. Confirmed live on 2026-08-20 — a deploy changed main-app's contents,
// so main-app-424c1ecf8aaf74e1.js 404'd while the other nine chunks, whose
// hashes were unchanged, kept serving.
//
// Recovery is delegated to reloadOnChunkError, so this shares the one-reload-
// per-60s sessionStorage guard with the boundaries and cannot start a loop.
export function ChunkErrorGuard() {
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      // preventDefault only when we are actually reloading, so genuine bugs
      // still reach Sentry's own handler and the console.
      if (reloadOnChunkError(e.reason)) e.preventDefault();
    };

    const onError = (e: Event) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;

      if (tag === "SCRIPT" || tag === "LINK") {
        const url =
          (el as HTMLScriptElement).src || (el as HTMLLinkElement).href || "";
        // Only our own build output. A third-party script that fails to load
        // (analytics, an embed) is not something a reload fixes.
        if (url.includes("/_next/static/")) {
          reloadOnChunkError({
            name: "ChunkLoadError",
            message: `Loading chunk ${url} failed`,
          });
        }
        return;
      }

      const err = (e as ErrorEvent).error;
      if (isChunkLoadError(err)) reloadOnChunkError(err);
    };

    window.addEventListener("unhandledrejection", onRejection);
    // Capture phase: resource error events do not bubble to window.
    window.addEventListener("error", onError, true);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError, true);
    };
  }, []);

  return null;
}
