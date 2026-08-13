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
const IMG_CDN = "https://img.vegaskiddos.com";

// Pre-post image guard: a Facebook link post renders the event page's OG image,
// which is the type template at img.vegaskiddos.com/type/<id>/1024.webp. One
// HEAD covers the set — if templates are up, every event page has a working image.
let _templatesOk;
async function ogImageOk() {
  if (_templatesOk != null) return _templatesOk;
  try {
    const types = ["celebration", "food", "yoga", "market"];
    const results = await Promise.all(
      types.map((id) =>
        fetch(`${IMG_CDN}/type/${id}/1024.webp`, { method: "HEAD", signal: AbortSignal.timeout(10000) })
      )
    );
    _templatesOk = results.every((r) => r.ok);
    return _templatesOk;
  } catch {
    return false;
  }
}
// Some auto-approved library entries aren't kid events worth promoting — adult
// programming and branch-closure notices. Skip them when choosing what to post
// so the Page never highlights "Adult Perler Bead Crafternight" or "CLOSED FOR
// THANKSGIVING". Deliberately narrow: "Young Adult" (teen) is NOT excluded.
// Positive match (not a lookbehind, which only consumed one space): skip a
// standalone "Adult"/"Adults" unless it's "Young Adult(s)" (teen content), and
// any closure notice. Handles odd spacing like "Young  Adult".
const CLOSURE_RE = /^closed\b|\bclosed for\b/i;
const ADULT_RE = /\badults?\b/i;
const YOUNG_ADULT_RE = /\byoung[\s-]+adults?\b/i;
function postableTitle(t) {
  if (!t) return false;
  const s = String(t);
  if (CLOSURE_RE.test(s)) return false;
  if (ADULT_RE.test(s) && !YOUNG_ADULT_RE.test(s)) return false;
  return true;
}

// UTC instant for a given America/Los_Angeles wall-clock date + hour. Handles
// PST/PDT correctly (one Intl round-trip), so "9am PT" lands at the right UTC
// time year-round without a date library.
function ptToUtc(y, mo /*1-12*/, d, hour) {
  const utcGuess = Date.UTC(y, mo - 1, d, hour, 0, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", hour12: false,
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(new Date(utcGuess));
  const m = {};
  for (const p of parts) m[p.type] = p.value;
  const asUtc = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour % 24, +m.minute, +m.second);
  return new Date(utcGuess - (asUtc - utcGuess));
}

const mode = (process.argv[2] || "daily").toLowerCase();
const DRY = process.argv.includes("--dry-run") || !PAGE_ID || !PAGE_TOKEN;
const FORCE = process.argv.includes("--force") || process.env.FB_FORCE === "1";

// A Facebook-native scheduled batch (queued 2026-06-22) covers daily posting
// through Jul 21 2026 — that's the furthest out Facebook allows scheduling
// (~30 days), and those posts publish server-side even if the token changes.
// The live daily/roundup crons no-op until this resume date so they don't
// double up with the batch, then take over on Jul 22 (token valid till Jul 28;
// the weekly verify alert nags Adam to refresh it first). Bypass with --force.
const RESUME_AFTER = Date.parse("2026-07-22T00:00:00-07:00");
function pausedUntilResume(label) {
  if (FORCE || Date.now() >= RESUME_AFTER) return false;
  console.log(`${label}: paused until ${new Date(RESUME_AFTER).toISOString()} — scheduled batch covers this period (use --force to override).`);
  return true;
}

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
  console.error("── token diagnostics ──");
  console.error("identity (/me):", JSON.stringify(me));         // a Page has a `category`; a User does not
  console.error("scopes (/me/permissions):", JSON.stringify(perms?.data || perms));
  console.error(`FB_PAGE_ID being posted to: ${PAGE_ID}`);
  // A rejected token answers NOTHING, so `category`/`permissions` come back
  // absent for a dead PAGE token exactly as they would for a live USER token.
  // Reporting "USER token" in that case is a false lead (it sent the 2026-08-03
  // triage hunting a token-type mixup when the token was a Page token that had
  // simply expired). Only classify once we know the token authenticates.
  if (me?.error) {
    console.error(`token TYPE UNKNOWN — Facebook rejected the token, so it reports no identity: ${me.error.message}`);
    console.error("  ↳ This is an expiry/revocation problem, NOT necessarily the wrong token type.");
    return;
  }
  const grantedPosts = Array.isArray(perms?.data) && perms.data.some((p) => p.permission === "pages_manage_posts" && p.status === "granted");
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
    // Never social-post a cancelled event (filtered in JS so this still works if
    // the Canceled field doesn't exist yet — Airtable just omits it).
    return recs.filter((r) => r.fields.Title && !r.fields.Canceled);
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
  if (pausedUntilResume("daily")) return;
  // First un-posted upcoming event whose OG image actually resolves (no grey box).
  let rec = null;
  for (const r of await unpostedEvents()) {
    if (!r.fields.Start) continue;
    if (!postableTitle(r.fields.Title)) continue;
    if (await ogImageOk()) { rec = r; break; }
  }
  if (!rec) { console.log("daily: no un-posted upcoming events with a working image — nothing to post."); return; }
  const { message, url } = eventPost(rec);
  preview("DAILY HIGHLIGHT", message, url);
  if (DRY) return;
  const id = await publish(message, url);
  console.log(`✅ posted: ${id}`);
  await stampPosted(rec.id);
}

// ── schedule: queue highlights with Facebook (publishes server-side even after
// our token expires). Supports several posts/day across many days at chosen PT
// times. Flags (all optional):
//   --per-day N     posts per day            (default 1)
//   --days D        number of days to fill   (default 14)
//   --times h,h,h   PT hours, one per slot   (default "9,13,17" → trimmed to per-day)
//   --start Y-M-D   first day (PT)           (default: today)
//   positional N    legacy: total post count (1/day) when no --per-day/--days
// Each event is used once, titles don't repeat within the batch, and only
// events whose OG image resolves are eligible (so no post ships a grey box). ──
function argVal(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
async function runSchedule() {
  const perDay = Math.max(1, Math.min(6, parseInt(argVal("--per-day") || process.env.FB_PER_DAY || "1", 10)));
  const days = Math.max(1, Math.min(60, parseInt(argVal("--days") || process.env.FB_DAYS || "14", 10)));
  const DEFAULT_TIMES = [9, 13, 17, 11, 15, 19];
  const times = (argVal("--times") || process.env.FB_TIMES || "")
    .split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => n >= 0 && n <= 23);
  // `perDay` DISTINCT PT hours: requested first, defaults to pad, never repeating
  // (two posts at the same instant would collide / stack on the feed).
  const hours = [];
  for (const h of [...(times.length ? times : DEFAULT_TIMES), ...DEFAULT_TIMES]) {
    if (hours.length >= perDay) break;
    if (!hours.includes(h)) hours.push(h);
  }
  hours.sort((a, b) => a - b);

  // Legacy: `schedule 14` (a bare count, no --per-day/--days) → 14 posts, 1/day.
  const legacyCount = !argVal("--per-day") && !argVal("--days") && /^\d+$/.test(process.argv[3] || "")
    ? parseInt(process.argv[3], 10) : null;

  const candidates = await unpostedEvents();
  if (!candidates.length) { console.log("schedule: no un-posted events available."); return; }

  // Start day in PT — defaults to today. A well-formed --start is honored only if
  // it's in range AND not in the past; otherwise we clamp to today, so a stale
  // FB_START or a past date can't collapse the batch to a handful of posts.
  const ptToday = (() => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date());
    const m = {}; for (const x of p) m[x.type] = x.value;
    return { y: +m.year, mo: +m.month, d: +m.day };
  })();
  let startY = ptToday.y, startMo = ptToday.mo, startD = ptToday.d;
  const startStr = argVal("--start") || process.env.FB_START;
  const sm = startStr && /^\d{4}-\d{2}-\d{2}$/.test(startStr) ? startStr.split("-").map(Number) : null;
  if (sm && sm[1] >= 1 && sm[1] <= 12 && sm[2] >= 1 && sm[2] <= 31 &&
      ptToUtc(sm[0], sm[1], sm[2], 0).getTime() >= ptToUtc(ptToday.y, ptToday.mo, ptToday.d, 0).getTime()) {
    [startY, startMo, startD] = sm;
  }

  // Build chronological slots: for each day, each chosen PT hour, >15min out.
  // Facebook rejects scheduled_publish_time more than ~30 days ahead with
  // "(#100) ... scheduled publish time is invalid", so cap slots at 29 days out
  // and stop cleanly instead of erroring mid-batch.
  const nowMs = Date.now();
  const FB_MAX_AHEAD_MS = 29 * 24 * 60 * 60 * 1000;
  const dayCount = legacyCount != null ? legacyCount : days;
  const slots = [];
  let cappedByFb = false;
  const target = legacyCount ?? perDay * days;
  for (let dayOffset = 0; dayOffset < dayCount + 2 && slots.length < target; dayOffset++) {
    // ptToUtc normalizes an overflowing day (e.g. Jun 45 → Jul 15) via Date.UTC.
    for (const h of (legacyCount != null ? [hours[0]] : hours)) {
      const slot = ptToUtc(startY, startMo, startD + dayOffset, h);
      const t = slot.getTime();
      if (t > nowMs + FB_MAX_AHEAD_MS) { cappedByFb = true; continue; }
      if (t > nowMs + 15 * 60 * 1000) slots.push(slot);
      if (slots.length >= target) break;
    }
  }
  if (cappedByFb) console.log(`Note: Facebook only allows scheduling ~30 days ahead — batch trimmed to ${slots.length} slot(s) within that window.`);

  // Assign an event to each slot: recurring events are always valid; one-time
  // events only if still upcoming at post time; image must resolve (no grey box).
  const used = new Set();
  const usedTitles = new Set();
  const plan = [];
  for (const slot of slots) {
    let chosen = null;
    for (const r of candidates) {
      if (used.has(r.id)) continue;
      const f = r.fields;
      if (!postableTitle(f.Title)) continue; // skip adult / closure entries
      if (usedTitles.has(String(f.Title || "").trim().toLowerCase())) continue;
      const valid = f.Recurrence || (f.Start && new Date(f.Start).getTime() > slot.getTime());
      if (!valid) continue;
      if (!(await ogImageOk())) continue; // skip grey-box events
      chosen = r; break;
    }
    if (!chosen) continue; // no eligible event for this slot — leave it empty, try next
    used.add(chosen.id);
    usedTitles.add(String(chosen.fields.Title || "").trim().toLowerCase());
    plan.push({ rec: chosen, slot });
  }
  if (!plan.length) { console.log("schedule: no events match the upcoming slots."); return; }

  const fmtSlot = (s) => s.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
  console.log(`Scheduling ${plan.length} post(s)${legacyCount != null ? "" : ` — ${perDay}/day × ${days} day(s) at ${hours.map((h) => `${h}:00`).join(", ")} PT from ${startY}-${String(startMo).padStart(2, "0")}-${String(startD).padStart(2, "0")}`}${DRY ? " (DRY RUN)" : ""}:`);
  let okCount = 0;
  for (const { rec, slot } of plan) {
    console.log(`  • ${fmtSlot(slot)} PT  →  ${rec.fields.Title}`);
    if (DRY) continue;
    const { message, url } = eventPost(rec);
    try {
      const id = await publish(message, url, Math.floor(slot.getTime() / 1000));
      await stampPosted(rec.id, slot);
      okCount++;
      console.log(`      ✅ scheduled: ${id}`);
    } catch (e) {
      console.error(`      ✗ skipped (${String(e).slice(0, 140)})`);
    }
  }
  if (DRY) console.log("\n(DRY RUN — nothing was scheduled.)");
  else console.log(`\n✅ Queued ${okCount} post(s). Review/edit them in Meta Business Suite → Planner.`);
}

// ── roundup: "this weekend" multi-event list (bilingual), weekly ────────────
async function runRoundup() {
  if (pausedUntilResume("roundup")) return;
  const formula = "AND({Approved}=1, OR(NOT({Recurrence}=BLANK()), AND(IS_AFTER({Start}, DATEADD(NOW(),-1,'days')), IS_BEFORE({Start}, DATEADD(NOW(),4,'days')))))";
  const events = (await airtableAll("Events", `&filterByFormula=${encodeURIComponent(formula)}`))
    .map((r) => r.fields)
    .filter((f) => f.Title && f.Start && !f.Canceled && postableTitle(f.Title))
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
// This is the ONLY early-warning the pipeline has, so it must FAIL LOUD on every
// unhealthy state — including the ones where Facebook stops answering questions
// about the token. It used to only fail on "numeric expiry within 21 days", which
// meant a fully EXPIRED token (debug_token returns an error, so there is no
// numeric expiry to test) sailed through GREEN: the alarm switched itself off at
// exactly the moment the outage became total. Every branch below therefore ends
// in an explicit pass/fail, and "I couldn't tell" counts as fail.
const EXPIRY_WARN_DAYS = 21;
async function runVerify() {
  const get = async (path) => {
    try { return await (await fetch(`${GRAPH}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(PAGE_TOKEN)}`)).json(); }
    catch (e) { return { error: { message: String(e) } }; }
  };
  const fail = (code, msg) => { console.error(msg); process.exitCode = code; };

  if (!PAGE_ID || !PAGE_TOKEN) {
    return fail(2, "❌ FB_PAGE_ID / FB_PAGE_TOKEN are not set — nothing to verify, and live posting is disabled.");
  }

  const me = await get("me?fields=id,name,category");
  const dbg = await get(`debug_token?input_token=${encodeURIComponent(PAGE_TOKEN)}`);
  const info = dbg?.data || {};
  const exp = info.expires_at;
  console.log("identity (/me):", JSON.stringify(me));
  console.log("token type:", info.type || "(unknown)");
  console.log("expires_at:", exp === 0 ? "0 → never expires (long-lived ✅)" : exp ? new Date(exp * 1000).toISOString() : "(debug_token unavailable with this token)");

  // 1. The token no longer authenticates at all (expired / revoked / malformed).
  //    Facebook reports this on /me; debug_token also stops working, which is why
  //    the old expiry-only check could not see it.
  if (me?.error) {
    return fail(2, `❌ TOKEN IS DEAD — Facebook rejected it: ${me.error.message}\n` +
      "   Mint a fresh non-expiring PAGE token and update the FB_PAGE_TOKEN secret.");
  }

  // 2. Authenticates, but it isn't a Page token — posting to /{page-id}/feed will
  //    fail. Only a Page has a `category` on /me.
  if (!me?.category) {
    return fail(2, `❌ NOT A PAGE TOKEN — /me returned ${JSON.stringify(me)} with no \`category\`.\n` +
      "   FB_PAGE_TOKEN must hold the PAGE token from /me/accounts, not the user token.");
  }
  console.log(`✅ Valid PAGE token for "${me.name}" (id ${me.id})`);

  // 3. Authenticates, but we can't introspect it — so we cannot answer "is this
  //    about to expire?". Unknown is NOT healthy; fail rather than fail open.
  if (dbg?.error || typeof exp !== "number") {
    return fail(3, `❌ CANNOT DETERMINE EXPIRY — debug_token did not return a usable payload: ${JSON.stringify(dbg).slice(0, 300)}\n` +
      "   Treating unknown as unhealthy: the whole point of this check is to see expiry coming.");
  }

  // 4. Scopes. debug_token reports them even for a Page token, so this catches a
  //    token that looks fine but can't actually publish.
  if (Array.isArray(info.scopes)) {
    const missing = ["pages_manage_posts", "pages_read_engagement"].filter((s) => !info.scopes.includes(s));
    if (missing.length) {
      fail(3, `⚠️  TOKEN IS MISSING SCOPE(S): ${missing.join(", ")} — posting will fail. Re-grant them when minting the token.`);
    } else {
      console.log("scopes ok: pages_manage_posts, pages_read_engagement granted.");
    }
  }

  // 5. Expiry. A Page token derived from a LONG-LIVED user token has
  //    expires_at === 0 and never dies. Any non-zero expiry means the token was
  //    derived from a user token that still had a finite clock, so it will die on
  //    a schedule with nobody touching it — which is exactly how posting broke on
  //    2026-07-28. Say so every run, not just inside the 21-day window.
  if (exp === 0) {
    // Don't call it healthy if an earlier check (e.g. scopes) already failed.
    console.log(process.exitCode ? "expiry ok (never expires), but see the failure above." : "token healthy: never expires.");
    return;
  }
  const days = Math.floor((exp * 1000 - Date.now()) / 86_400_000);
  console.error(
    `⚠️  THIS PAGE TOKEN HAS A FINITE EXPIRY (${new Date(exp * 1000).toISOString()}, ~${days} day(s) away).\n` +
    "   A Page token minted from a LONG-LIVED user token reports expires_at=0 and never expires.\n" +
    "   A non-zero expiry means it was minted from a user token that had not been exchanged for a\n" +
    "   long-lived one, so posting WILL break on that date even if nobody changes anything.");
  if (days <= EXPIRY_WARN_DAYS) {
    fail(3, `⚠️  TOKEN EXPIRES IN ${days} DAY(S) — refresh FB_PAGE_TOKEN now (regenerate a long-lived Page token and re-set the secret).`);
  } else {
    console.log(`(not yet inside the ${EXPIRY_WARN_DAYS}-day warning window — this run still passes, but replace the token with a non-expiring one.)`);
  }
}

if (mode === "roundup") await runRoundup();
else if (mode === "daily") await runDaily();
else if (mode === "schedule") await runSchedule();
else if (mode === "verify") await runVerify();
else { console.error(`Unknown mode "${mode}". Use: daily | roundup | schedule | verify`); process.exit(1); }
