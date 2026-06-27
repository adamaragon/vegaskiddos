// Fire a custom analytics event via GA4 (gtag). Safe no-op if gtag hasn't
// loaded (ad-blocker, SSR, or before consent). Keep event names stable —
// they show up as events in the GA4 dashboard. (Plausible was removed 2026-06;
// this used to fire a Plausible goal.)
export function track(
  event: string,
  props?: Record<string, string | number | boolean>,
) {
  if (typeof window === "undefined") return;
  const g = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof g === "function") g("event", event, props ?? {});
}
