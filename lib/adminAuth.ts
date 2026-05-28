import crypto from "crypto";

// Lightweight shared-password admin auth. The session cookie holds a token
// derived from ADMIN_PASSWORD, so it can't be forged without knowing the
// password. No DB, no user table — enough for a two-person family project.

export const ADMIN_COOKIE = "vk_admin";

function token(): string {
  const pw = process.env.ADMIN_PASSWORD || "";
  return crypto.createHmac("sha256", pw).update("vk-admin-v1").digest("hex");
}

export function checkPassword(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD || "";
  if (!pw || !input) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(pw);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function sessionToken(): string {
  return token();
}

export function isValidSession(cookieValue?: string | null): boolean {
  if (!cookieValue || !process.env.ADMIN_PASSWORD) return false;
  const expected = token();
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
