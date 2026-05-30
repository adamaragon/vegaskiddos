// Creates the "Reminders" Airtable table (idempotent) used by the favorite ->
// reminder feature. A row is one subscriber on one channel (web push OR email)
// plus the event record-ids they've favorited. The daily send-reminders job
// reads this table.
//
// Usage: node tools/ensure-reminders-table.mjs
// Env: AIRTABLE_TOKEN, AIRTABLE_BASE_ID
import fs from "fs";

try {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trimStart().startsWith("#")) {
      const k = line.slice(0, i).trim();
      if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
    }
  }
} catch {}

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE = process.env.AIRTABLE_BASE_ID;
if (!TOKEN || !BASE) { console.error("Missing AIRTABLE_TOKEN / AIRTABLE_BASE_ID"); process.exit(1); }
const META = `https://api.airtable.com/v0/meta/bases/${BASE}/tables`;
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

const existing = await (await fetch(META, { headers: H })).json();
if ((existing.tables || []).some((t) => t.name === "Reminders")) {
  console.log("Reminders table already exists — nothing to do.");
  process.exit(0);
}

const body = {
  name: "Reminders",
  description: "Favorite -> reminder subscriptions (web push and/or email). Written by /api/reminders, read by send-reminders.",
  fields: [
    { name: "Ref", type: "singleLineText" }, // primary: email or a short endpoint id, human-readable
    { name: "Channel", type: "singleSelect", options: { choices: [{ name: "push" }, { name: "email" }] } },
    { name: "Endpoint", type: "singleLineText" }, // push endpoint (dedupe key for push)
    { name: "Keys", type: "multilineText" }, // JSON: { p256dh, auth }
    { name: "Email", type: "singleLineText" },
    { name: "FavoriteIds", type: "multilineText" }, // comma-separated event record ids
    { name: "Lang", type: "singleLineText" },
    { name: "Active", type: "checkbox", options: { icon: "check", color: "greenBright" } },
    { name: "SentLog", type: "multilineText" }, // comma-separated eventIds already reminded (dedupe)
    { name: "CreatedAt", type: "singleLineText" },
  ],
};

const res = await fetch(META, { method: "POST", headers: H, body: JSON.stringify(body) });
if (!res.ok) { console.error("Create failed:", res.status, await res.text()); process.exit(1); }
console.log("Created Reminders table ✓");
