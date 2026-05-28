import type { Config } from "@netlify/functions";
import { runScrape } from "../../lib/scrape/run";

// Scheduled scraper: pulls upcoming family events from registered sources into
// the Airtable review queue (Approved=false). Runs daily; also invokable
// manually via GET with ?key=<SCRAPE_KEY> (add &dry=1 to preview without writing).
export default async (req: Request) => {
  const url = new URL(req.url);
  const isScheduled = req.headers.get("x-nf-event") === "schedule";

  // Manual invocations require a key; scheduled runs are trusted.
  if (!isScheduled) {
    const key = process.env.SCRAPE_KEY;
    if (!key || url.searchParams.get("key") !== key) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const dryRun = url.searchParams.get("dry") === "1";
  try {
    const summary = await runScrape({ dryRun });
    console.log("[scrape-events]", JSON.stringify(summary));
    return Response.json(summary);
  } catch (err) {
    console.error("[scrape-events] failed:", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
};

export const config: Config = {
  // 09:00 America/Los_Angeles ≈ 16:00 UTC (PDT). Daily.
  schedule: "0 16 * * *",
};
