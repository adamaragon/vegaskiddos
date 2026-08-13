// One-off (re-runnable): strip HTML/JS/CSS/markdown from Airtable Description
// fields using the shared ingest sanitizer. Does not delete events.
//
//   node tools/clean-coded-descriptions.mjs
//   node tools/clean-coded-descriptions.mjs --dry
import { readFileSync, existsSync } from "node:fs";
import {
  sanitizeDescription,
  looksLikeCode,
  fallbackDescription,
} from "../lib/scrape/sanitize-description.mjs";

function loadEnv() {
  const home = process.env.HOME || "";
  const files = [
    new URL("../.env.local", import.meta.url).pathname,
    new URL("../SECRETS.local.md", import.meta.url).pathname,
    `${home}/Dropbox/Apps/Obsidian/Obsidian Vault/_Claude/Memory/VegasKiddos-Secrets.md`,
  ];
  for (const p of files) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*(AIRTABLE_TOKEN|AIRTABLE_BASE_ID|AIRTABLE_TABLE_NAME)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const dryRun = process.argv.includes("--dry");
const token = process.env.AIRTABLE_TOKEN;
const base = process.env.AIRTABLE_BASE_ID;
const table = process.env.AIRTABLE_TABLE_NAME || "Events";
if (!token || !base) {
  console.error("AIRTABLE_TOKEN / AIRTABLE_BASE_ID required");
  process.exit(1);
}

const API = `https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}`;

async function allRecords() {
  const recs = [];
  let offset;
  do {
    const u = new URL(API);
    u.searchParams.set("pageSize", "100");
    for (const f of ["Title", "Description", "DescriptionEs", "Venue", "Approved", "Rejected", "Source"]) {
      u.searchParams.append("fields[]", f);
    }
    if (offset) u.searchParams.set("offset", offset);
    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    const j = await res.json();
    recs.push(...j.records);
    offset = j.offset;
  } while (offset);
  return recs;
}

function cleanField(raw, title, venue) {
  if (!looksLikeCode(raw)) return null;
  const cleaned = sanitizeDescription(raw);
  const next = cleaned.trim() ? cleaned : fallbackDescription({ title, venue });
  if (!next || next === raw) return null;
  return next;
}

async function patchBatch(records) {
  for (let i = 0; i < records.length; i += 10) {
    const res = await fetch(API, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: records.slice(i, i + 10), typecast: true }),
    });
    if (!res.ok) throw new Error(`Airtable PATCH ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

const recs = await allRecords();
const updates = [];
const report = [];

for (const r of recs) {
  const f = r.fields;
  const title = String(f.Title || "");
  const venue = String(f.Venue || "");
  const fields = {};
  const enBefore = String(f.Description || "");
  const esBefore = String(f.DescriptionEs || "");
  const en = cleanField(enBefore, title, venue);
  const es = cleanField(esBefore, title, venue);
  if (en != null) fields.Description = en;
  if (es != null) fields.DescriptionEs = es;
  if (!Object.keys(fields).length) continue;
  updates.push({ id: r.id, fields });
  report.push({
    id: r.id,
    title,
    approved: !!f.Approved,
    rejected: !!f.Rejected,
    source: f.Source || "",
    before: enBefore.slice(0, 160),
    after: (fields.Description || enBefore).slice(0, 160),
    esBefore: esBefore ? esBefore.slice(0, 80) : "",
    esAfter: fields.DescriptionEs ? String(fields.DescriptionEs).slice(0, 80) : "",
  });
}

console.log(`${dryRun ? "DRY RUN " : ""}scanned ${recs.length}, dirty ${report.length}`);
for (const row of report) {
  console.log(`\n${row.id}  ${row.approved ? "A" : "-"}${row.rejected ? "R" : "-"}  ${row.source}  ${row.title}`);
  console.log(`  before: ${JSON.stringify(row.before)}`);
  console.log(`  after:  ${JSON.stringify(row.after)}`);
  if (row.esBefore) {
    console.log(`  es before: ${JSON.stringify(row.esBefore)}`);
    console.log(`  es after:  ${JSON.stringify(row.esAfter)}`);
  }
}

if (!dryRun && updates.length) await patchBatch(updates);
if (!dryRun) console.log(`\nPatched ${updates.length} record(s).`);
