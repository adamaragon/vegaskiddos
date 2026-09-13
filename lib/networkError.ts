// Transient client-side fetch failures (offline, flaky mobile radios, captive
// portals). These surface as TypeErrors from the browser fetch implementation
// and are expected — not actionable app bugs. See Sentry VEGASKIDDOS-A.

const NETWORK_ERROR_RE =
  /^(network error|failed to fetch|load failed|networkerror when attempting to fetch resource\.?|network request failed)$/i;

export function isTransientNetworkErrorMessage(message: string | undefined): boolean {
  if (!message) return false;
  const trimmed = message.trim();
  if (!trimmed) return false;
  return NETWORK_ERROR_RE.test(trimmed);
}

export function isTransientNetworkError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "string") return isTransientNetworkErrorMessage(error);
  if (typeof error !== "object") return false;

  const { name, message } = error as { name?: string; message?: string };
  if (isTransientNetworkErrorMessage(message)) return true;

  // Chrome/Android often throws TypeError: network error with no useful stack.
  if (name === "TypeError" && isTransientNetworkErrorMessage(message)) return true;

  // Some browsers wrap the failure in a DOMException.
  if (name === "NetworkError") return true;

  return false;
}
