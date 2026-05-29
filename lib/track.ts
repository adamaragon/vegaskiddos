// Fire a Plausible custom (goal) event. Safe no-op if Plausible hasn't loaded
// (e.g. blocked by an ad-blocker) or during SSR. Keep event names stable —
// they show up as Goals in the Plausible dashboard.
export function track(
  event: string,
  props?: Record<string, string | number | boolean>,
) {
  if (typeof window === "undefined") return;
  const p = (window as unknown as { plausible?: (e: string, o?: { props: Record<string, unknown> }) => void }).plausible;
  if (typeof p === "function") p(event, props ? { props } : undefined);
}
