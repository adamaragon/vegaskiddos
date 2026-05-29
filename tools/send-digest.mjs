// Weekly email digest: pulls this week's approved events + active subscribers
// from Airtable, builds a branded HTML email, and sends it via Resend.
// If RESEND_API_KEY isn't set, it compiles + logs a preview instead (so the
// pipeline is testable before the email provider is wired up).
//
// Env: AIRTABLE_TOKEN, AIRTABLE_BASE_ID, [RESEND_API_KEY], [DIGEST_FROM].

import crypto from "crypto";
const AT = process.env.AIRTABLE_TOKEN, BASE = process.env.AIRTABLE_BASE_ID;
const unsubToken = (email) => crypto.createHash("sha256").update(email.toLowerCase() + BASE).digest("hex").slice(0, 16);
if (!AT || !BASE) { console.error("AIRTABLE_TOKEN / AIRTABLE_BASE_ID required"); process.exit(1); }
const FROM = process.env.DIGEST_FROM || "Vegas Kiddos <hello@vegaskiddos.com>";
const SITE = "https://vegaskiddos.com";

async function airtableAll(table, params = "") {
  const out = []; let offset;
  do {
    const u = `https://api.airtable.com/v0/${BASE}/${table}?pageSize=100${params}${offset ? `&offset=${offset}` : ""}`;
    const r = await fetch(u, { headers: { Authorization: `Bearer ${AT}` } });
    if (!r.ok) throw new Error(`${table} ${r.status}`);
    const d = await r.json(); out.push(...d.records); offset = d.offset;
  } while (offset);
  return out;
}

const fmt = (iso, rec) => {
  const d = new Date(iso);
  // For recurring, show the pattern; else the date.
  const date = d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
  return rec ? `${rec} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" })}` : date;
};

const now = new Date();
const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString();
const today = now.toISOString().slice(0, 10);

// This week's approved events (upcoming within 7 days OR recurring).
const events = (await airtableAll("Events", `&filterByFormula=${encodeURIComponent("AND({Approved}=1, OR(NOT({Recurrence}=BLANK()), AND(IS_AFTER({Start}, DATEADD(NOW(),-1,'days')), IS_BEFORE({Start}, DATEADD(NOW(),7,'days')))))")}`))
  .map((r) => r.fields)
  .filter((f) => f.Title && f.Start)
  .sort((a, b) => String(a.Start).localeCompare(String(b.Start)))
  .slice(0, 18);

const subs = (await airtableAll("Subscribers", `&filterByFormula=${encodeURIComponent("{Active}=1")}`))
  .map((r) => ({ email: r.fields.Email, hood: (r.fields.Neighborhood || "").trim() }))
  .filter((s) => s.email);

console.log(`digest: ${events.length} events, ${subs.length} subscribers`);
if (!events.length || !subs.length) { console.log("nothing to send"); process.exit(0); }

const rowsFor = (list) => list.map((f) => `
  <tr><td style="padding:14px 0;border-bottom:1px solid #eee">
    <div style="font-size:12px;font-weight:700;color:#0FA89A;text-transform:uppercase">${fmt(f.Start, f.Recurrence)}</div>
    <a href="${SITE}/event/${f.id || ""}" style="font-size:18px;font-weight:700;color:#2D2A32;text-decoration:none">${f.Title}</a>
    <div style="font-size:13px;color:#666">📍 ${f.Venue || ""} · ${f.PriceText || (f.PriceTier === "free" ? "Free" : "")}</div>
  </td></tr>`).join("");

const htmlFor = (list, hoodLabel, unsub) => `<!doctype html><html><body style="margin:0;background:#FFF8EE;font-family:-apple-system,Segoe UI,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:linear-gradient(135deg,#FF6B5E,#FFC93C);border-radius:24px;padding:28px;text-align:center;color:#fff">
      <div style="font-size:40px">🌵</div>
      <h1 style="margin:6px 0;font-size:26px">This Week for Vegas Kids</h1>
      <p style="margin:0;opacity:.95">${list.length} family-friendly events${hoodLabel ? ` in ${hoodLabel}` : " around the valley"}</p>
    </div>
    <table width="100%" style="margin-top:8px">${rowsFor(list)}</table>
    <div style="text-align:center;margin-top:20px">
      <a href="${SITE}" style="background:#FF6B5E;color:#fff;padding:12px 24px;border-radius:999px;font-weight:800;text-decoration:none">See all events →</a>
    </div>
    <p style="text-align:center;color:#999;font-size:12px;margin-top:24px">Vegas Kiddos · a Threesided Studios project · always confirm details with the venue<br><a href="${unsub}" style="color:#999">Unsubscribe</a></p>
  </div></body></html>`;

if (!process.env.RESEND_API_KEY) {
  console.log("RESEND_API_KEY not set — preview only (no send). Sample:\n", htmlFor(events.slice(0, 5), "", "#").slice(0, 300));
  process.exit(0);
}

let sent = 0;
for (const s of subs) {
  // Neighborhood-targeted: only that area's events (fall back to all if none for that area, or no area chosen).
  let list = events;
  if (s.hood) {
    const local = events.filter((f) => f.Neighborhood === s.hood);
    if (local.length >= 3) list = local; // keep it worthwhile
  }
  const unsub = `${SITE}/unsubscribe?e=${encodeURIComponent(s.email)}&t=${unsubToken(s.email)}`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: s.email, subject: `🌵 ${list.length} kid events in Las Vegas this week`, html: htmlFor(list, "", unsub), headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
  });
  if (r.ok) sent++; else console.error("send fail", s.email, r.status, (await r.text()).slice(0, 120));
}
console.log(`sent ${sent}/${subs.length}`);
