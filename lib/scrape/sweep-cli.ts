// Cancellation sweep runner.
//   npm run sweep            → dry run: report suspected cancellations only
//   npm run sweep -- --apply → auto-remove HIGH-confidence ones, report the rest
// In CI this runs with --apply as part of the daily scrape (gov-scrape.yml).
import fs from "node:fs";
import { runSweep } from "./sweep";

// Load .env.local for local runs (CI sets these via the workflow env). Done
// here, not in sweep.ts, so the library stays env-agnostic.
try {
  for (const line of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* no .env.local — rely on ambient env */ }

const apply = process.argv.includes("--apply");

runSweep({ apply })
  .then((s) => {
    console.log(`\n=== Cancellation sweep ${apply ? "(APPLY)" : "(dry run — report only)"} ===`);
    console.log(`Swept sources:   ${s.sourcesSwept.join(", ") || "(none)"}`);
    if (s.sourcesSkipped.length)
      console.log(`Skipped sources: ${s.sourcesSkipped.map((x) => `${x.source} [${x.why}]`).join(", ")}`);
    console.log(`Scanned ${s.scanned} approved upcoming one-time event(s).`);

    if (s.high.length) {
      console.log(`\n⛔ HIGH confidence — cancelled (${apply ? `removed ${s.removed}` : "would remove"}):`);
      for (const c of s.high) console.log(`  • ${c.title}  [${c.source}]  ${c.start.slice(0, 10)}\n      ${c.reason}\n      ${c.url || "(no url)"}`);
    } else {
      console.log("\n✅ No HIGH-confidence cancellations found.");
    }

    if (s.medium.length) {
      console.log(`\n⚠️  MEDIUM — vanished from feed but unconfirmed (review manually, NOT removed):`);
      for (const c of s.medium) console.log(`  • ${c.title}  [${c.source}]  ${c.start.slice(0, 10)}\n      ${c.reason}\n      ${c.url || "(no url)"}`);
    }

    console.log("");
    process.exit(0);
  })
  .catch((err) => {
    console.error("SWEEP FAILED:", err);
    process.exit(1);
  });
