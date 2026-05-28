// Local runner: `node lib/scrape/cli.ts --dry` (preview) or `node lib/scrape/cli.ts` (live insert).
import { runScrape } from "./run";

const dryRun = process.argv.includes("--dry");
runScrape({ dryRun })
  .then((s) => {
    console.log(JSON.stringify(s, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error("SCRAPE FAILED:", err);
    process.exit(1);
  });
