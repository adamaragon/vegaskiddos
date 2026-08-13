import { NextResponse } from "next/server";
import { getEventsByIds } from "@/lib/data";
import { allowRequest } from "@/lib/rateLimit";
import type { Lang } from "@/lib/i18n";

// Approved events by Airtable record id. Used by My List to resolve saved
// favorites that aren't in the listed (upcoming) SSR payload — past events
// the parent still has hearted. Cap 40; approved-only.

export async function GET(req: Request) {
  if (!allowRequest(req, "events-by-id", 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const lang = (url.searchParams.get("lang") === "es" ? "es" : "en") as Lang;
  const events = await getEventsByIds(ids, lang);
  return NextResponse.json({ events });
}
