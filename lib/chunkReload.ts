// Deploy self-heal for stale-HTML chunk 404s.
//
// Pages are ISR-cached for a day (`export const revalidate = 86400`) and served
// with a 30-day stale-while-revalidate, so a repeat visitor can be holding HTML
// from before a deploy. That HTML points at hashed chunks the new deploy
// deleted, so the chunk request 404s, hydration dies with a ChunkLoadError, and
// the error boundary paints a blank "Application error" screen — even though the
// SSR'd markup underneath is perfectly fine. One reload fetches the current HTML
// and everything lines up again.
//
// The guard is a sessionStorage *timestamp*, not a boolean: one reload per tab
// per RETRY_WINDOW. If the reload didn't help (chunk genuinely gone, or the
// failure was never really about chunks) the second failure falls through to a
// real error state instead of looping forever. A timestamp rather than a
// flag-cleared-on-success means a later deploy months into the same tab still
// gets its own retry.

const RELOAD_KEY = "vk_chunk_reload";
const RETRY_WINDOW_MS = 60_000;

// webpack tags its own failures with name === "ChunkLoadError"; native
// ESM/dynamic-import failures and stale CSS chunks only announce themselves in
// the message. Everything else is a genuine app bug and must NOT reload.
const CHUNK_ERROR_RE =
  /Loading chunk .* failed|Loading CSS chunk .* failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, message } = error as { name?: string; message?: string };
  if (name === "ChunkLoadError") return true;
  return typeof message === "string" && CHUNK_ERROR_RE.test(message);
}

// Reload once if `error` is a stale-chunk failure. Returns true when a reload
// was kicked off — the caller should render nothing, the document is about to be
// replaced. False means "show your error UI".
export function reloadOnChunkError(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (!isChunkLoadError(error)) return false;

  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RETRY_WINDOW_MS) return false; // already retried
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage blocked (private mode, locked-down browser) → no loop guard
    // available, so don't gamble on a reload.
    return false;
  }

  // A plain reload revalidates the document, which is enough to drop the stale
  // copy the browser was serving out of its own stale-while-revalidate cache.
  window.location.reload();
  return true;
}

// Manual retry for the "we already tried that" error UI. Re-arms the guard
// instead of clearing it, so a click costs exactly one fresh document load — if
// that still fails the user lands straight back on the error state rather than
// bouncing through another automatic reload.
export function retryReload() {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* no guard available; the reload below is still one-per-click */
  }
  window.location.reload();
}
