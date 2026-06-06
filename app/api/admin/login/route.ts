import { NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_PRESENT_COOKIE, authenticate } from "@/lib/adminAuth";

export async function POST(req: Request) {
  const { email, password } = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const result = await authenticate(email || "", password || "");
  if (!result) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, name: result.name });
  const maxAge = 60 * 60 * 24 * 30;
  res.cookies.set(ADMIN_COOKIE, result.cookie, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  // Non-httpOnly presence hint so client UI (AdminEventControls on event pages)
  // can skip the /api/admin/me probe for anonymous visitors. Not trusted for
  // authz — only the httpOnly session cookie above is server-validated.
  res.cookies.set(ADMIN_PRESENT_COOKIE, "1", {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return res;
}
