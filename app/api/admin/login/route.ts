import { NextResponse } from "next/server";
import { ADMIN_COOKIE, authenticate } from "@/lib/adminAuth";

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
  res.cookies.set(ADMIN_COOKIE, result.cookie, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
