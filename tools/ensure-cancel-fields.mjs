// One-off: ensure the cancellation fields exist on the Events table so the
// cancellation sweep (lib/scrape/sweep.ts) can flag events and the app can show
// a banner. Idempotent; safe to re-run. The sweep also creates these on demand,
// but running this first lets the app + fb-post rely on them immediately.
//   node tools/ensure-cancel-fields.mjs   (or npm run ensure-cancel-fields)
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
const tableName = process.env.AIRTABLE_TABLE_NAME || "Events";
if (!token || !base) { console.error("AIRTABLE_TOKEN / AIRTABLE_BASE_ID required"); process.exit(1); }

const metaRes = await fetch(`${API}/meta/bases/${base}/tables`, { headers: { Authorization: `Bearer ${token}` } });
if (!metaRes.ok) {
  console.error(`Could not read schema (${metaRes.status}). The token may lack schema scope.`);
  console.error("Add 'Canceled' (checkbox), 'CanceledAt' (dateTime), 'CanceledReason' (single line) to Events manually.");
  process.exit(1);
}
const { tables } = await metaRes.json();
const tbl = tables.find((x) => x.name === tableName);
if (!tbl) { console.error(`No '${tableName}' table found.`); process.exit(1); }
const have = new Set(tbl.fields.map((f) => f.name));

const want = [
  { name: "Canceled", type: "checkbox", options: { icon: "check", color: "redBright" }, description: "Flagged by the cancellation sweep — event vanished from its source + URL confirmed. Shown with a banner; never social-posted." },
  { name: "CanceledAt", type: "dateTime", options: { timeZone: "America/Los_Angeles", dateFormat: { name: "iso" }, timeFormat: { name: "24hour" } }, description: "When the cancellation sweep flagged this event." },
  { name: "CanceledReason", type: "singleLineText", description: "Why the sweep flagged this event as cancelled." },
  { name: "CanceledDates", type: "multilineText", description: "For a recurring series: cancelled occurrence days (\"YYYY-MM-DD\", comma/newline separated). One cancelled date never removes the whole series." },
];

let created = 0;
for (const f of want) {
  if (have.has(f.name)) { console.log(`✓ '${f.name}' already exists`); continue; }
  const res = await fetch(`${API}/meta/bases/${base}/tables/${tbl.id}/fields`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(f),
  });
  if (res.ok) { console.log(`✅ created '${f.name}'`); created++; }
  else { console.error(`✗ could not create '${f.name}' (${res.status}): ${(await res.text()).slice(0, 200)}`); }
}
console.log(created ? `\nDone — created ${created} field(s).` : "\nAll cancellation fields already present.");
