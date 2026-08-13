/** Returns an http(s) URL, or undefined for javascript:/data:/garbage. */
export function safeHttpUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.href;
  } catch {
    return undefined;
  }
}
