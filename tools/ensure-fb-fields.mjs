// One-off: ensure an `FBPostedAt` date field exists on the Events table so the
// Facebook auto-poster (daily mode) can dedupe — it only posts events whose
// FBPostedAt is blank, then stamps it. Idempotent; safe to re-run.
// Run: node tools/ensure-fb-fields.mjs   (or npm run ensure-fb-fields)
import fs from "node:fs";

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
  console.error("Add a 'Date' field (with time) named 'FBPostedAt' to the Events table manually.");
  process.exit(1);
}
const { tables } = await metaRes.json();
const tbl = tables.find((x) => x.name === "Events");
if (!tbl) { console.error("No 'Events' table found."); process.exit(1); }

if (tbl.fields.some((f) => f.name === "FBPostedAt")) {
  console.log("✅ 'FBPostedAt' already exists on Events — nothing to do.");
  process.exit(0);
}

const res = await fetch(`${API}/meta/bases/${base}/tables/${tbl.id}/fields`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "FBPostedAt",
    type: "dateTime",
    description: "When this event was auto-posted to the Facebook Page (blank = not yet posted)",
    options: { timeZone: "America/Los_Angeles", dateFormat: { name: "iso" }, timeFormat: { name: "24hour" } },
  }),
});
if (!res.ok) {
  console.error(`Could not create field (${res.status}): ${(await res.text()).slice(0, 300)}`);
  console.error("Add a 'Date' field (with time) named 'FBPostedAt' to the Events table manually.");
  process.exit(1);
}
console.log("✅ Created 'FBPostedAt' field on the Events table.");
