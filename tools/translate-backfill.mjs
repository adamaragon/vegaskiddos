// One-time (and re-runnable) backfill: translate every displayed event's
// title + description into Spanish and store them in Airtable (TitleEs /
// DescriptionEs). Idempotent — only untranslated rows are touched.
//
// Usage:
//   OPENAI_API_KEY=sk-… node tools/translate-backfill.mjs
// Reads Airtable creds from .env.local (AIRTABLE_TOKEN / AIRTABLE_BASE_ID /
// AIRTABLE_TABLE_NAME). OPENAI_API_KEY may come from the env or .env.local.

import { readFileSync } from "node:fs";
import { backfillTranslations } from "../lib/scrape/translate.mjs";

// Minimal .env.local loader (no dotenv dependency).
function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].replace(/^['"]|['"]$/g, "");
      if (process.env[key] === undefined && val) process.env[key] = val;
    }
  } catch { /* no .env.local — rely on process env */ }
}

loadEnvFile(new URL("../.env.local", import.meta.url).pathname);

const apiKey = process.env.OPENAI_API_KEY;
const token = process.env.AIRTABLE_TOKEN;
const base = process.env.AIRTABLE_BASE_ID;
const table = process.env.AIRTABLE_TABLE_NAME || "Events";

if (!apiKey) { console.error("❌ OPENAI_API_KEY is required."); process.exit(1); }
if (!token || !base) { console.error("❌ AIRTABLE_TOKEN / AIRTABLE_BASE_ID required."); process.exit(1); }

const n = await backfillTranslations({ apiKey, token, base, table, log: console.log });
console.log(`\nDone. ${n} event(s) translated.`);
