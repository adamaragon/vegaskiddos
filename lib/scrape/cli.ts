// Local + CI runner: `node lib/scrape/cli.ts --dry` (preview) or
// `node lib/scrape/cli.ts` (live insert). In CI this is `npm run scrape`.
import { runScrape } from "./run";

// Sources that should never legitimately return zero. If one does, something
// upstream broke (markup/endpoint change) — fail the run so GitHub emails us
// instead of the source silently flatlining for weeks (as Nevada Moms did).
// Thin/volatile sources are intentionally excluded — a 0 there is plausible.
const CORE_SOURCES = new Set([
  "Family Fun Vegas",
  "Library",
  "Henderson Libraries",
]);

// Known-flaky aggregator hosts (WAF/HTML challenges). Log them, don't fail the
// nightly job — Library/Henderson/Family Fun Vegas going dark still fails red.
const SOFT_ERROR_SOURCES = new Set([
  "Vegas Family Guide",
  "Nevada Moms",
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
    const hardErrors = errored.filter((x) => !SOFT_ERROR_SOURCES.has(x.source));
    if (deadCore.length || hardErrors.length) {
      if (deadCore.length)
        console.error(`\n❌ CORE SOURCE RETURNED ZERO: ${deadCore.map((x) => x.source).join(", ")}`);
      if (errored.length)
        console.error(`❌ SOURCE ERRORS: ${errored.map((x) => x.source).join(", ")}`);
      if (!dryRun) process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error("SCRAPE FAILED:", err);
    process.exit(1);
  });
