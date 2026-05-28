import crypto from "crypto";

// Email + password admin auth backed by the Airtable "Admins" table.
// Passwords are scrypt-hashed with a per-user salt. The session cookie holds
// "<email>.<hmac(AUTH_SECRET, email)>" so it can't be forged without the secret.

export const ADMIN_COOKIE = "vk_admin";
const API = "https://api.airtable.com/v0";

interface Admin {
  email: string;
  name: string;
  hash: string;
  salt: string;
}

async function findAdmin(email: string): Promise<Admin | null> {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) return null;
  const formula = `AND(LOWER({Email})='${email.toLowerCase().replace(/'/g, "")}',{Active}=1)`;
  const url = `${API}/${base}/Admins?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = (await res.json()) as { records: { fields: Record<string, string> }[] };
  const r = data.records[0];
  if (!r) return null;
  return {
    email: String(r.fields.Email || ""),
    name: String(r.fields.Name || ""),
    hash: String(r.fields.PasswordHash || ""),
    salt: String(r.fields.Salt || ""),
  };
}

function tokenFor(email: string): string {
  const secret = process.env.AUTH_SECRET || "";
  return crypto.createHmac("sha256", secret).update(email.toLowerCase()).digest("hex");
}

function safeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Returns the signed cookie value on success, or null on bad credentials.
export async function authenticate(email: string, password: string): Promise<{ cookie: string; name: string } | null> {
  if (!email || !password || !process.env.AUTH_SECRET) return null;
  const admin = await findAdmin(email);
  if (!admin || !admin.hash || !admin.salt) return null;
  const computed = crypto.scryptSync(password, admin.salt, 64).toString("hex");
  if (!safeEq(computed, admin.hash)) return null;
  return { cookie: `${admin.email.toLowerCase()}.${tokenFor(admin.email)}`, name: admin.name };
}

// Validates a session cookie. Returns the admin email, or null.
export function sessionEmail(cookieValue?: string | null): string | null {
  if (!cookieValue || !process.env.AUTH_SECRET) return null;
  const i = cookieValue.lastIndexOf(".");
  if (i < 0) return null;
  const email = cookieValue.slice(0, i);
  const sig = cookieValue.slice(i + 1);
  return safeEq(sig, tokenFor(email)) ? email : null;
}

export function isValidSession(cookieValue?: string | null): boolean {
  return sessionEmail(cookieValue) !== null;
}
