// Link & freshness hygiene for the live event listings. Pulls every approved
// event that has a source Url, checks each one, and prints a categorized
// report:  ok | dead (404/410) | error (timeout / 5xx / network).
//
// Report-only by design — it does NOT auto-reject, because a transient 5xx or
// timeout shouldn't pull a real event offline. Use the report to fix/remove
// dead ones in the admin. Pass --json for machine-readable output.
//
// Env: AIRTABLE_TOKEN, AIRTABLE_BASE_ID.  Run: npm run check-links
import fs from "node:fs";

// Minimal .env.local loader.
try {
  for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const AT = process.env.AIRTABLE_TOKEN, BASE = process.env.AIRTABLE_BASE_ID;
if (!AT || !BASE) { console.error("AIRTABLE_TOKEN / AIRTABLE_BASE_ID required"); process.exit(1); }
const JSON_OUT = process.argv.includes("--json");
const CONCURRENCY = 8;
const TIMEOUT_MS = 12000;

async function airtableAll(table, params = "") {
  const out = []; let offset;
  do {
    const u = `https://api.airtable.com/v0/${BASE}/${table}?pageSize=100${params}${offset ? `&offset=${offset}` : ""}`;
    const r = await fetch(u, { headers: { Authorization: `Bearer ${AT}` } });
    if (!r.ok) throw new Error(`${table} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json(); out.push(...d.records); offset = d.offset;
  } while (offset);
  return out;
}

async function checkOne(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const opts = { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": "VegasKiddosLinkCheck/1.0 (+https://vegaskiddos.com)" } };
  try {
    // Some servers reject HEAD — fall back to a ranged GET.
    let r = await fetch(url, { ...opts, method: "HEAD" });
    if (r.status === 405 || r.status === 501) {
      r = await fetch(url, { ...opts, method: "GET", headers: { ...opts.headers, Range: "bytes=0-0" } });
    }
    clearTimeout(timer);
    if (r.status === 404 || r.status === 410) return { state: "dead", code: r.status };
    if (r.status >= 500 || r.status === 403 || r.status === 429) return { state: "error", code: r.status };
    return { state: "ok", code: r.status };
  } catch (e) {
    clearTimeout(timer);
    return { state: "error", code: e.name === "AbortError" ? "timeout" : "network" };
  }
}

// Bounded-concurrency map.
async function mapPool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}

const recs = (await airtableAll("Events", `&filterByFormula=${encodeURIComponent("AND({Approved}=1, NOT({Url}=BLANK()))")}`))
  .map((r) => ({ id: r.id, title: r.fields.Title, url: String(r.fields.Url) }));

if (!JSON_OUT) console.log(`🔗 Checking ${recs.length} approved event link(s)…`);

const results = await mapPool(recs, CONCURRENCY, async (e) => ({ ...e, ...(await checkOne(e.url)) }));
const dead = results.filter((r) => r.state === "dead");
const errored = results.filter((r) => r.state === "error");
const ok = results.filter((r) => r.state === "ok");

if (JSON_OUT) {
  console.log(JSON.stringify({ total: recs.length, ok: ok.length, dead, errored }, null, 2));
} else {
  console.log(`\n✅ OK: ${ok.length}   💀 Dead: ${dead.length}   ⚠️  Errors: ${errored.length}\n`);
  if (dead.length) {
    console.log("💀 DEAD LINKS (404/410) — review/remove in admin:");
    for (const d of dead) console.log(`   [${d.code}] ${d.title}\n        ${d.url}\n        https://vegaskiddos.com/event/${d.id}`);
  }
  if (errored.length) {
    console.log("\n⚠️  ERRORS (timeout/5xx/403/429 — could be transient, recheck before acting):");
    for (const d of errored) console.log(`   [${d.code}] ${d.title} — ${d.url}`);
  }
}
// Non-zero exit only when confirmed-dead links exist (useful for CI alerting).
process.exit(dead.length ? 2 : 0);
