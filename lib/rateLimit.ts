// Best-effort per-isolate token bucket. Cloudflare Workers don't share memory
// across isolates, so this is a speed bump, not a global quota.

const buckets = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (b.n >= limit) return false;
  b.n += 1;
  return true;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function allowRequest(req: Request, bucket: string, limit = 10, windowMs = 60_000): boolean {
  return rateLimit(`${bucket}:${clientIp(req)}`, limit, windowMs);
}
