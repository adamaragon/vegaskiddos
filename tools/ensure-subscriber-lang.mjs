// One-off: ensure a single-line "Lang" column exists on the Subscribers table
// so the weekly digest can be sent in the language the subscriber signed up in.
// Idempotent — safe to re-run. Reads AIRTABLE_TOKEN / AIRTABLE_BASE_ID from
// .env.local or the environment. Run: node tools/ensure-subscriber-lang.mjs
import fs from "node:fs";

// Minimal .env.local loader (no dependency on --env-file).
try {
  for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const API = "https://api.airtable.com/v0";
const token = process.env.AIRTABLE_TOKEN;
const base = process.env.AIRTABLE_BASE_ID;
if (!token || !base) { console.error("AIRTABLE_TOKEN / AIRTABLE_BASE_ID required"); process.exit(1); }

const metaRes = await fetch(`${API}/meta/bases/${base}/tables`, { headers: { Authorization: `Bearer ${token}` } });
if (!metaRes.ok) {
  console.error(`Could not read schema (${metaRes.status}). The token may lack schema scope.`);
  console.error("Add a single-line-text field named 'Lang' to the Subscribers table manually, then you're done.");
  process.exit(1);
}
const { tables } = await metaRes.json();
const tbl = tables.find((x) => x.name === "Subscribers");
if (!tbl) { console.error("No 'Subscribers' table found."); process.exit(1); }

if (tbl.fields.some((f) => f.name === "Lang")) {
  console.log("✅ 'Lang' field already exists on Subscribers — nothing to do.");
  process.exit(0);
}

const res = await fetch(`${API}/meta/bases/${base}/tables/${tbl.id}/fields`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Lang", type: "singleLineText", description: "Locale the subscriber signed up in (en|es)" }),
});
if (!res.ok) {
  console.error(`Could not create field (${res.status}): ${(await res.text()).slice(0, 300)}`);
  console.error("Add a single-line-text field named 'Lang' to the Subscribers table manually.");
  process.exit(1);
}
console.log("✅ Created 'Lang' field on the Subscribers table.");
