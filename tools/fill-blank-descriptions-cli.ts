// CLI for fill-blank-descriptions — loads .env.local, prints progress.
import fs from "fs";
import { fillBlankDescriptions } from "../lib/scrape/fill-descriptions";

try {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trimStart().startsWith("#")) {
      const k = line.slice(0, i).trim();
      if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
    }
  }
} catch {}

async function main() {
  const dryRun = process.argv.includes("--dry");

  if (!process.env.AIRTABLE_TOKEN || !process.env.AIRTABLE_BASE_ID) {
    console.error("Missing AIRTABLE_TOKEN / AIRTABLE_BASE_ID");
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY");
    process.exit(1);
  }

  const result = await fillBlankDescriptions({
    dryRun,
    log: (m) => console.log(m),
  });

  const approvedNote = dryRun ? " (DRY RUN)" : "";
  console.log(
    `fill-descriptions: scanned ${result.scanned}, ${result.blanks} blank, filled ${result.filled}${approvedNote}`
  );
  // Exit non-zero only on live runs with failures (dry run may hit quota while validating).
  if (!dryRun && result.errors.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
