// Local + CI runner: `node lib/scrape/cli.ts --dry` (preview) or
// `node lib/scrape/cli.ts` (live insert). In CI this is `npm run scrape`.
import { runScrape } from "./run";

// Sources that should never legitimately return zero. If one does, something
// upstream broke (markup/endpoint change) — fail the run so GitHub emails us
// instead of the source silently flatlining for weeks (as Nevada Moms did).
// Thin/volatile sources are intentionally excluded — a 0 there is plausible.
const CORE_SOURCES = new Set([
  "Vegas Family Guide",
  "Family Fun Vegas",
  "Library",
  "Henderson Libraries",
]);

const dryRun = process.argv.includes("--dry");

runScrape({ dryRun })
  .then((s) => {
    console.log(JSON.stringify(s, null, 2));

    // Per-source health line, easy to scan in CI logs.
    console.log("\nSource health:");
    for (const src of s.sources) {
      const flag = src.errors.length ? "ERROR" : src.found === 0 ? "ZERO " : "ok   ";
      console.log(`  [${flag}] ${src.source}: ${src.found}${src.errors.length ? ` — ${src.errors.join("; ")}` : ""}`);
    }

    // Alert conditions: a core source went dark, or any source errored.
    const deadCore = s.sources.filter((x) => CORE_SOURCES.has(x.source) && x.found === 0);
    const errored = s.sources.filter((x) => x.errors.length > 0);
    if (deadCore.length || errored.length) {
      if (deadCore.length)
        console.error(`\n❌ CORE SOURCE RETURNED ZERO: ${deadCore.map((x) => x.source).join(", ")}`);
      if (errored.length)
        console.error(`❌ SOURCE ERRORS: ${errored.map((x) => x.source).join(", ")}`);
      // Don't fail a dry preview; do fail real CI runs so the failure surfaces.
      if (!dryRun) process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error("SCRAPE FAILED:", err);
    process.exit(1);
  });
