import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, sessionEmail } from "@/lib/adminAuth";

// Lightweight check so client UI can decide whether to show admin controls.
// Returns only a boolean + email — no sensitive data.
export async function GET() {
  const c = await cookies();
  const email = sessionEmail(c.get(ADMIN_COOKIE)?.value);
  return NextResponse.json({ authed: Boolean(email), email: email || null });
}
