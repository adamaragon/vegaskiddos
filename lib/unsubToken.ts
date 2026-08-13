import crypto from "crypto";

function hmacToken(email: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(email.toLowerCase()).digest("hex");
}

function legacyToken(email: string, base: string): string {
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase() + base)
    .digest("hex")
    .slice(0, 16);
}

function safeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Prefer AUTH_SECRET (Worker + CI). Fall back to the Airtable base id so a
 *  digest job still mints links if the secret is missing from GitHub. */
function mintSecret(base: string): string {
  return process.env.AUTH_SECRET || base;
}

/** Token to put in new emails. */
export function unsubToken(email: string, base: string): string {
  return hmacToken(email, mintSecret(base));
}

/** Accept AUTH_SECRET HMAC, base-id HMAC (digest CI fallback), or the old
 *  sha256(email+base).slice(0,16) links already sitting in inboxes. */
export function unsubTokenOk(email: string, base: string, t: string): boolean {
  if (!t) return false;
  const e = email.toLowerCase();
  if (process.env.AUTH_SECRET && safeEq(t, hmacToken(e, process.env.AUTH_SECRET))) return true;
  if (safeEq(t, hmacToken(e, base))) return true;
  return t === legacyToken(e, base);
}
