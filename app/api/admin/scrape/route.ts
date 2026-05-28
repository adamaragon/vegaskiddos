import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidSession } from "@/lib/adminAuth";
import { runScrape } from "@/lib/scrape/run";

// Admin-triggered on-demand scrape. Runs all source adapters and inserts new
// events into the review queue (Approved=false). Returns a summary.
export async function POST() {
  const c = await cookies();
  if (!isValidSession(c.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runScrape({ dryRun: false });
    return NextResponse.json(summary);
  } catch (err) {
    console.error("admin scrape error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
