// Daily reminder sender. Run in the evening: notifies each subscriber about the
// events they favorited that are happening TOMORROW, via web push and/or email.
// Reads the Reminders table; dedupes per-row via SentLog so nobody is pinged
// twice for the same event. Idempotent within a day.
//
// Usage:
//   node tools/send-reminders.mjs            # send
//   node tools/send-reminders.mjs --dry       # preview, no sends / no writes
//
// Env: AIRTABLE_TOKEN, AIRTABLE_BASE_ID, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//      VAPID_SUBJECT, [RESEND_API_KEY], [DIGEST_FROM]
import fs from "fs";
import crypto from "crypto";
import webpush from "web-push";

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
const DRY = process.argv.includes("--dry");
const SITE = "https://vegaskiddos.com";
const FROM = process.env.DIGEST_FROM || "Vegas Kiddos <hello@vegaskiddos.com>";
const unsubSecret = process.env.AUTH_SECRET || BASE;
const unsubToken = (email) => crypto.createHmac("sha256", unsubSecret).update(String(email).toLowerCase()).digest("hex");
const PUBLIC = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
if (!TOKEN || !BASE) { console.error("Missing Airtable env"); process.exit(1); }
if (PUBLIC && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@vegaskiddos.com", PUBLIC, process.env.VAPID_PRIVATE_KEY);
}

const API = "https://api.airtable.com/v0";
async function list(table, params = "") {
  let recs = [], offset;
  do {
    const u = new URL(`${API}/${BASE}/${encodeURIComponent(table)}`);
    u.searchParams.set("pageSize", "100");
    if (params) for (const [k, v] of new URLSearchParams(params)) u.searchParams.set(k, v);
    if (offset) u.searchParams.set("offset", offset);
    const r = await fetch(u, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!r.ok) throw new Error(`Airtable ${table} ${r.status}: ${await r.text()}`);
    const j = await r.json();
    recs = recs.concat(j.records); offset = j.offset;
  } while (offset);
  return recs;
}
async function patch(table, id, fields) {
  const r = await fetch(`${API}/${BASE}/${encodeURIComponent(table)}/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!r.ok) console.error(`PATCH ${table} ${r.status}: ${await r.text()}`);
}

// Tomorrow's calendar day in Las Vegas time.
const fmtKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" });
const fmtTime = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" });
const fmtDow = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "long" });
const now = new Date();
const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
const tomorrowKey = fmtKey.format(tomorrow);
const tomorrowDow = fmtDow.format(tomorrow).toLowerCase();

// Does an event happen tomorrow? One-time: Start date matches. Recurring: the
// recurrence text names tomorrow's weekday (covers "Weekly on Tuesdays").
function happensTomorrow(f) {
  if (!f.Start) return false;
  if (fmtKey.format(new Date(f.Start)) === tomorrowKey) return true;
  const rec = String(f.Recurrence || "").toLowerCase();
  if (rec && rec.includes(tomorrowDow) && new Date(f.Start) <= tomorrow) return true;
  return false;
}

const events = (await list("Events")).filter((r) => r.fields.Approved && !r.fields.Rejected && !r.fields.Canceled);
const byId = new Map(events.map((r) => [r.id, r.fields]));
const tomorrowEvents = new Set(events.filter((r) => happensTomorrow(r.fields)).map((r) => r.id));
const subs = (await list("Reminders")).filter((r) => r.fields.Active);
console.log(`tomorrow = ${tomorrowKey} (${tomorrowDow}) · ${tomorrowEvents.size} events · ${subs.length} active subscriptions${DRY ? " (DRY RUN)" : ""}\n`);

let pushed = 0, emailed = 0, pruned = 0;
for (const r of subs) {
  const f = r.fields;
  const favs = String(f.FavoriteIds || "").split(",").map((s) => s.trim()).filter(Boolean);
  const sent = new Set(String(f.SentLog || "").split(",").map((s) => s.trim()).filter(Boolean));
  const due = favs.filter((id) => tomorrowEvents.has(id) && !sent.has(id) && byId.has(id));
  if (!due.length) continue;

  const titles = due.map((id) => byId.get(id).Title);
  const first = byId.get(due[0]);
  const subject = due.length === 1
    ? `🌵 Tomorrow: ${first.Title}`
    : `🌵 ${due.length} saved events tomorrow`;
  const body = due.length === 1
    ? `${first.Venue ? first.Venue + " · " : ""}${fmtTime.format(new Date(first.Start))}`
    : `${titles.slice(0, 2).join(", ")}${due.length > 2 ? ` +${due.length - 2} more` : ""}`;
  const url = due.length === 1 ? `${SITE}/event/${due[0]}` : `${SITE}/my-list`;

  console.log(`→ ${f.Ref || f.Channel}: ${subject} — ${body}`);
  if (DRY) continue;

  let ok = false;
  try {
    if (f.Channel === "push" && f.Endpoint && f.Keys) {
      const subscription = { endpoint: f.Endpoint, keys: JSON.parse(f.Keys) };
      await webpush.sendNotification(subscription, JSON.stringify({ title: subject, body, url, tag: `vk-${tomorrowKey}` }));
      pushed++; ok = true;
    } else if (f.Channel === "email" && f.Email && process.env.RESEND_API_KEY) {
      const rows = due.map((id) => {
        const e = byId.get(id);
        return `<tr><td style="padding:8px 0;border-bottom:1px solid #eee"><a href="${SITE}/event/${id}" style="color:#0FA89A;font-weight:700;text-decoration:none">${e.Title}</a><br><span style="color:#888;font-size:13px">${e.Venue || ""} · ${fmtTime.format(new Date(e.Start))}</span></td></tr>`;
      }).join("");
      const html = `<div style="max-width:560px;margin:0 auto;font-family:-apple-system,Segoe UI,sans-serif">
        <div style="background:linear-gradient(135deg,#7C5CBF,#0FA89A);border-radius:20px;padding:24px;text-align:center;color:#fff">
          <div style="font-size:34px">🌵</div><h1 style="margin:6px 0;font-size:20px">${subject}</h1>
          <p style="margin:0;opacity:.9">Your saved events are coming up tomorrow.</p></div>
        <table style="width:100%;margin-top:16px;border-collapse:collapse">${rows}</table>
        <p style="text-align:center;color:#aaa;font-size:12px;margin-top:18px">Vegas Kiddos · always confirm details with the venue<br><a href="${SITE}/unsubscribe?e=${encodeURIComponent(f.Email)}&t=${unsubToken(f.Email)}&kind=reminders" style="color:#aaa">Stop event reminders</a></p></div>`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: f.Email, subject, html }),
      });
      if (res.ok) { emailed++; ok = true; } else console.error("resend", res.status, await res.text());
    }
  } catch (e) {
    // 404/410 mean the push subscription is dead — deactivate it.
    if (e.statusCode === 404 || e.statusCode === 410) { await patch("Reminders", r.id, { Active: false }); pruned++; continue; }
    console.error(`✗ ${f.Ref}: ${e.message || e}`);
  }
  if (ok) await patch("Reminders", r.id, { SentLog: [...sent, ...due].join(",") });
}
console.log(`\n${DRY ? "Would send" : "Sent"} — push: ${pushed}, email: ${emailed}${pruned ? `, pruned ${pruned} dead subs` : ""}.`);
