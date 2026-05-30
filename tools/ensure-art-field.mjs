// One-off: ensure an `ArtImage` attachment field exists on the Events table so
// AI-generated event art can be uploaded straight into Airtable (which then
// hosts it on its CDN — no external storage needed). Idempotent.
// Run: node tools/ensure-art-field.mjs   (or npm run ensure-art-field)
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
  console.error(`Could not read schema (${metaRes.status}). Add an Attachment field named 'ArtImage' to Events manually.`);
  process.exit(1);
}
const { tables } = await metaRes.json();
const tbl = tables.find((x) => x.name === "Events");
if (!tbl) { console.error("No 'Events' table found."); process.exit(1); }

if (tbl.fields.some((f) => f.name === "ArtImage")) {
  console.log("✅ 'ArtImage' already exists on Events — nothing to do.");
  process.exit(0);
}

const res = await fetch(`${API}/meta/bases/${base}/tables/${tbl.id}/fields`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ name: "ArtImage", type: "multipleAttachments", description: "AI-generated event artwork (preferred over the scraped Image when present)" }),
});
if (!res.ok) {
  console.error(`Could not create field (${res.status}): ${(await res.text()).slice(0, 300)}`);
  console.error("Add an Attachment field named 'ArtImage' to the Events table manually.");
  process.exit(1);
}
console.log("✅ Created 'ArtImage' attachment field on the Events table.");
