import { NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_PRESENT_COOKIE } from "@/lib/adminAuth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(ADMIN_PRESENT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
