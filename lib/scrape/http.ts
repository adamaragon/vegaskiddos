// Fetch + parse JSON with retries on *transient* failures: network errors,
// 5xx/429, or non-JSON bodies (WAF / Cloudflare HTML challenge pages, which the
// upstream event calendars occasionally return). These blips used to fail the
// whole nightly scrape — and since cli.ts intentionally exits non-zero on any
// source error, that meant a GitHub email every time a source hiccupped.
// Retrying lets a momentary blip recover; a source that is genuinely down still
// fails all attempts, so the "source flatlined" alert is preserved.
//
// Returns the sentinel "PAST_END" when the response status equals
// opts.pastEndStatus (e.g. The Events Calendar returns 400 past the last page),
// so pagination can stop cleanly without treating it as an error.
function withTimeout(init: RequestInit, timeoutMs: number): RequestInit {
  if (init.signal) return init;
  return { ...init, signal: AbortSignal.timeout(timeoutMs) };
}

export async function fetchJsonRetry<T>(
  url: string,
  init: RequestInit = {},
  opts: { retries?: number; pastEndStatus?: number; timeoutMs?: number } = {},
): Promise<T | "PAST_END"> {
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  let lastErr = "unknown error";
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, withTimeout(init, timeoutMs));
      if (opts.pastEndStatus != null && res.status === opts.pastEndStatus) return "PAST_END";
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error("non-JSON response (likely a WAF/HTML page)");
      }
    } catch (err) {
      lastErr = (err as Error).message;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  throw new Error(`${lastErr} (after ${retries} attempts)`);
}

export async function fetchTextRetry(
  url: string,
  init: RequestInit = {},
  opts: { retries?: number; timeoutMs?: number; accept?: RegExp } = {},
): Promise<string> {
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  let lastErr = "unknown error";
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, withTimeout(init, timeoutMs));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (opts.accept && !opts.accept.test(text.slice(0, 200))) {
        throw new Error("unexpected response body");
      }
      return text;
    } catch (err) {
      lastErr = (err as Error).message;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  throw new Error(`${lastErr} (after ${retries} attempts)`);
}
