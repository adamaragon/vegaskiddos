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
const PAGE_ID = (process.env.FB_PAGE_ID || "").trim(), PAGE_TOKEN = (process.env.FB_PAGE_TOKEN || "").trim();
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
// On failure, report what the token actually is + its scopes (never the token).
async function diagnoseToken() {
  const get = async (path) => {
    try {
      const u = `${GRAPH}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(PAGE_TOKEN)}`;
      return await (await fetch(u)).json();
    } catch (e) { return { error: String(e) }; }
  };
  const me = await get("me?fields=id,name,category");
  const perms = await get("me/permissions");
  const grantedPosts = Array.isArray(perms?.data) && perms.data.some((p) => p.permission === "pages_manage_posts" && p.status === "granted");
  console.error("── token diagnostics ──");
  console.error("identity (/me):", JSON.stringify(me));         // a Page has a `category`; a User does not
  console.error("scopes (/me/permissions):", JSON.stringify(perms?.data || perms));
  console.error(`FB_PAGE_ID being posted to: ${PAGE_ID}`);
  console.error(`token looks like a ${me?.category ? "PAGE token" : "USER token (← needs to be the PAGE token)"}; pages_manage_posts granted: ${grantedPosts}`);
}

// Publishes immediately, or — when `whenUnix` is given — hands Facebook a
// scheduled post. Scheduled posts publish server-side at that time even if our
// token has since expired, so a batch created now survives token expiry.
async function publish(message, link, whenUnix) {
  const params = new URLSearchParams({ message, access_token: PAGE_TOKEN });
  if (link) params.set("link", link);
  if (whenUnix) { params.set("published", "false"); params.set("scheduled_publish_time", String(whenUnix)); }
  const r = await fetch(`${GRAPH}/${PAGE_ID}/feed`, { method: "POST", body: params });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { await diagnoseToken(); throw new Error(`Graph API ${r.status}: ${JSON.stringify(data).slice(0, 300)}`); }
  return data.id; // "{pageid}_{postid}"
}

// Single-event post body (shared by daily + schedule modes).
function eventPost(rec) {
  const f = rec.fields;
  const url = `${SITE}/event/${rec.id}`;
  const price = priceOf(f);
  const message = [
    `🌵 ${f.Title}`,
    `📅 ${fmtWhen(f.Start, f.Recurrence)}${f.Venue ? `   📍 ${f.Venue}` : ""}${price ? `   ·   ${price}` : ""}`,
    "",
    `Find this and every kid-safe event in Vegas — sorted by age, price & neighborhood 👇`,
    url,
    "",
    HASHTAGS,
  ].join("\n");
  return { message, url };
}

async function stampPosted(id, when = new Date()) {
  const patch = await airtable("PATCH", "Events", { records: [{ id, fields: { FBPostedAt: when.toISOString() } }], typecast: true });
  if (!patch.ok) console.error("warn: could not set FBPostedAt:", patch.status, (await patch.text()).slice(0, 150));
}

// All approved, not-yet-posted events (with Title), soonest first.
async function unpostedEvents() {
  try {
    const formula = "AND({Approved}=1, {FBPostedAt}=BLANK())";
    const recs = await airtableAll("Events", `&filterByFormula=${encodeURIComponent(formula)}&sort%5B0%5D%5Bfield%5D=Start&sort%5B0%5D%5Bdirection%5D=asc`);
    return recs.filter((r) => r.fields.Title);
  } catch (e) {
    if (/FBPostedAt/.test(String(e)) || /INVALID_FILTER/.test(String(e))) {
      console.error("Missing 'FBPostedAt' field on Events — run `npm run ensure-fb-fields` first.");
      process.exit(1);
    }
    throw e;
  }
}

function preview(label, message, link) {
  console.log(`\n──────── ${label} ${DRY ? "(DRY RUN — not posted)" : ""} ────────`);
  console.log(message);
  if (link) console.log(`[link card] ${link}`);
  console.log("────────────────────────────────────────");
}

// ── daily: one upcoming highlight, deduped via FBPostedAt ───────────────────
async function runDaily() {
  const rec = (await unpostedEvents()).find((r) => r.fields.Start);
  if (!rec) { console.log("daily: no un-posted upcoming events — nothing to post."); return; }
  const { message, url } = eventPost(rec);
  preview("DAILY HIGHLIGHT", message, url);
  if (DRY) return;
  const id = await publish(message, url);
  console.log(`✅ posted: ${id}`);
  await stampPosted(rec.id);
}

// ── schedule: queue N daily highlights with Facebook (publishes server-side
// even after our token expires). Default 14 posts, one/day at ~11am PT. ──────
async function runSchedule() {
  const count = Math.max(1, Math.min(60, parseInt(process.argv[3] || process.env.FB_SCHEDULE_COUNT || "14", 10)));
  const candidates = await unpostedEvents();
  if (!candidates.length) { console.log("schedule: no un-posted events available."); return; }

  // Build daily 18:00 UTC (~11:00 PT) slots, starting the next one >15min out.
  const nowMs = Date.now();
  const slots = [];
  let d = new Date(); d.setUTCHours(18, 0, 0, 0);
  while (slots.length < count) {
    if (d.getTime() > nowMs + 15 * 60 * 1000) slots.push(new Date(d));
    d = new Date(d.getTime() + 86400000);
  }

  // Assign an event to each slot: recurring events are always valid; one-time
  // events only if they're still upcoming when the post goes live.
  const used = new Set();
  const usedTitles = new Set(); // keep the batch varied — no repeated titles
  const plan = [];
  for (const slot of slots) {
    const ev = candidates.find((r) => {
      if (used.has(r.id)) return false;
      const f = r.fields;
      if (usedTitles.has(String(f.Title || "").trim().toLowerCase())) return false;
      return f.Recurrence || (f.Start && new Date(f.Start).getTime() > slot.getTime());
    });
    if (!ev) break;
    used.add(ev.id);
    usedTitles.add(String(ev.fields.Title || "").trim().toLowerCase());
    plan.push({ rec: ev, slot });
  }
  if (!plan.length) { console.log("schedule: no events match the upcoming slots."); return; }

  console.log(`Scheduling ${plan.length} post(s)${DRY ? " (DRY RUN)" : ""}:`);
  for (const { rec, slot } of plan) {
    const when = slot.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
    console.log(`  • ${when} PT  →  ${rec.fields.Title}`);
    if (DRY) continue;
    const { message, url } = eventPost(rec);
    const id = await publish(message, url, Math.floor(slot.getTime() / 1000));
    await stampPosted(rec.id, slot);
    console.log(`      ✅ scheduled: ${id}`);
  }
  if (DRY) console.log("\n(DRY RUN — nothing was scheduled.)");
  else console.log(`\n✅ Queued ${plan.length} posts. Review/edit them in Meta Business Suite → Planner.`);
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
// ── verify: report token type + expiry without posting ─────────────────────
async function runVerify() {
  const get = async (path) => {
    try { return await (await fetch(`${GRAPH}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(PAGE_TOKEN)}`)).json(); }
    catch (e) { return { error: String(e) }; }
  };
  const me = await get("me?fields=id,name,category");
  const dbg = await get(`debug_token?input_token=${encodeURIComponent(PAGE_TOKEN)}`);
  const info = dbg?.data || {};
  const exp = info.expires_at;
  console.log("identity (/me):", JSON.stringify(me));
  console.log("token type:", info.type || "(unknown)");
  console.log("expires_at:", exp === 0 ? "0 → never expires (long-lived ✅)" : exp ? new Date(exp * 1000).toISOString() : "(debug_token unavailable with this token)");
  console.log(me?.category ? `✅ Valid PAGE token for "${me.name}" (id ${me.id})` : "⚠️ This is NOT a Page token (no category on /me).");
}

if (mode === "roundup") await runRoundup();
else if (mode === "daily") await runDaily();
else if (mode === "schedule") await runSchedule();
else if (mode === "verify") await runVerify();
else { console.error(`Unknown mode "${mode}". Use: daily | roundup | schedule | verify`); process.exit(1); }
