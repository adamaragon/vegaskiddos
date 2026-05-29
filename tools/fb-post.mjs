// Auto-poster for the Vegas Kiddos Facebook Page. Pulls approved events from
// Airtable and publishes to the Page via the Graph API.
//
//   node tools/fb-post.mjs daily       → one upcoming-event highlight (deduped)
//   node tools/fb-post.mjs roundup     → "this weekend" multi-event roundup
//   add --dry-run to compose + print without posting
//
// Posting is skipped (compose-only) when FB_PAGE_ID / FB_PAGE_TOKEN aren't set,
// so the pipeline is fully testable before the Page token is wired up — same
// pattern as the email digest's preview mode.
//
// Env: AIRTABLE_TOKEN, AIRTABLE_BASE_ID, [FB_PAGE_ID], [FB_PAGE_TOKEN].
// The `daily` mode dedupes via an `FBPostedAt` field on Events — create it once
// with `npm run ensure-fb-fields`.
import fs from "node:fs";

// Minimal .env.local loader (for local runs / dry-runs).
try {
  for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const AT = process.env.AIRTABLE_TOKEN, BASE = process.env.AIRTABLE_BASE_ID;
if (!AT || !BASE) { console.error("AIRTABLE_TOKEN / AIRTABLE_BASE_ID required"); process.exit(1); }
const PAGE_ID = process.env.FB_PAGE_ID, PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
const SITE = "https://vegaskiddos.com";
const GRAPH = "https://graph.facebook.com/v21.0";

const mode = (process.argv[2] || "daily").toLowerCase();
const DRY = process.argv.includes("--dry-run") || !PAGE_ID || !PAGE_TOKEN;

async function airtable(method, path, body) {
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${AT}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r;
}
async function airtableAll(table, params = "") {
  const out = []; let offset;
  do {
    const r = await airtable("GET", `${table}?pageSize=100${params}${offset ? `&offset=${offset}` : ""}`);
    if (!r.ok) throw new Error(`${table} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json(); out.push(...d.records); offset = d.offset;
  } while (offset);
  return out;
}

// Friendly date / recurrence line (Pacific time).
const fmtWhen = (iso, rec) => {
  if (rec) return String(rec);
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
};
const priceOf = (f) => f.PriceText || (f.PriceTier === "free" ? "Free" : "");
const HASHTAGS = "#LasVegas #VegasKids #ThingsToDoInVegas #FamilyFun #VegasFamilies #KidFriendly #EventosLasVegas";

// ── Graph API publish ───────────────────────────────────────────────────────
async function publish(message, link) {
  const params = new URLSearchParams({ message, access_token: PAGE_TOKEN });
  if (link) params.set("link", link);
  const r = await fetch(`${GRAPH}/${PAGE_ID}/feed`, { method: "POST", body: params });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Graph API ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data.id; // "{pageid}_{postid}"
}

function preview(label, message, link) {
  console.log(`\n──────── ${label} ${DRY ? "(DRY RUN — not posted)" : ""} ────────`);
  console.log(message);
  if (link) console.log(`[link card] ${link}`);
  console.log("────────────────────────────────────────");
}

// ── daily: one upcoming highlight, deduped via FBPostedAt ───────────────────
async function runDaily() {
  let recs;
  try {
    // Soonest upcoming approved event we haven't posted yet.
    const formula = "AND({Approved}=1, {FBPostedAt}=BLANK(), IS_AFTER({Start}, DATEADD(NOW(),-2,'hours')))";
    recs = await airtableAll("Events", `&filterByFormula=${encodeURIComponent(formula)}&sort%5B0%5D%5Bfield%5D=Start&sort%5B0%5D%5Bdirection%5D=asc`);
  } catch (e) {
    if (/FBPostedAt/.test(String(e)) || /INVALID_FILTER/.test(String(e))) {
      console.error("Missing 'FBPostedAt' field on Events — run `npm run ensure-fb-fields` first.");
      process.exit(1);
    }
    throw e;
  }
  const rec = recs.find((r) => r.fields.Title && r.fields.Start);
  if (!rec) { console.log("daily: no un-posted upcoming events — nothing to post."); return; }

  const f = rec.fields;
  const url = `${SITE}/event/${rec.id}`;
  const when = fmtWhen(f.Start, f.Recurrence);
  const price = priceOf(f);
  const lines = [
    `🌵 ${f.Title}`,
    `📅 ${when}${f.Venue ? `   📍 ${f.Venue}` : ""}${price ? `   ·   ${price}` : ""}`,
    "",
    `Find this and every kid-safe event in Vegas — sorted by age, price & neighborhood 👇`,
    url,
    "",
    HASHTAGS,
  ];
  const message = lines.join("\n");
  preview("DAILY HIGHLIGHT", message, url);

  if (DRY) return;
  const id = await publish(message, url);
  console.log(`✅ posted: ${id}`);
  // Mark as posted so we don't repeat it.
  const patch = await airtable("PATCH", "Events", { records: [{ id: rec.id, fields: { FBPostedAt: new Date().toISOString() } }], typecast: true });
  if (!patch.ok) console.error("warn: could not set FBPostedAt:", patch.status, (await patch.text()).slice(0, 150));
}

// ── roundup: "this weekend" multi-event list (bilingual), weekly ────────────
async function runRoundup() {
  const formula = "AND({Approved}=1, OR(NOT({Recurrence}=BLANK()), AND(IS_AFTER({Start}, DATEADD(NOW(),-1,'days')), IS_BEFORE({Start}, DATEADD(NOW(),4,'days')))))";
  const events = (await airtableAll("Events", `&filterByFormula=${encodeURIComponent(formula)}`))
    .map((r) => r.fields)
    .filter((f) => f.Title && f.Start)
    .sort((a, b) => String(a.Start).localeCompare(String(b.Start)))
    .slice(0, 6);
  if (!events.length) { console.log("roundup: no events this weekend — nothing to post."); return; }

  const bullets = events.map((f) => {
    const price = priceOf(f);
    return `• ${f.Title}${f.Venue ? ` — ${f.Venue}` : ""}${price ? ` (${price})` : ""}`;
  }).join("\n");
  const link = `${SITE}/this-weekend`;
  const message = [
    `🌵 This weekend in Las Vegas — ${events.length} kid-friendly picks!`,
    "",
    bullets,
    "",
    `👉 Full list, filters & maps: ${link}`,
    "",
    `Este fin de semana en Las Vegas: ${events.length} planes para niños. Mira todo en ${SITE}`,
    "",
    HASHTAGS,
  ].join("\n");
  preview("WEEKEND ROUNDUP", message, link);

  if (DRY) return;
  const id = await publish(message, link);
  console.log(`✅ posted: ${id}`);
}

if (DRY && (!PAGE_ID || !PAGE_TOKEN)) {
  console.log("FB_PAGE_ID / FB_PAGE_TOKEN not set — compose-only preview (no posting).\n");
}
if (mode === "roundup") await runRoundup();
else if (mode === "daily") await runDaily();
else { console.error(`Unknown mode "${mode}". Use: daily | roundup`); process.exit(1); }
