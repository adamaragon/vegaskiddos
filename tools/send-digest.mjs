// Weekly email digest: pulls this week's approved events + active subscribers
// from Airtable, builds a branded HTML email, and sends it via Resend.
// If RESEND_API_KEY isn't set, it compiles + logs a preview instead (so the
// pipeline is testable before the email provider is wired up).
//
// Env: AIRTABLE_TOKEN, AIRTABLE_BASE_ID, [RESEND_API_KEY], [DIGEST_FROM].

import crypto from "crypto";
const AT = process.env.AIRTABLE_TOKEN, BASE = process.env.AIRTABLE_BASE_ID;
if (!AT || !BASE) { console.error("AIRTABLE_TOKEN / AIRTABLE_BASE_ID required"); process.exit(1); }
const IN_CI = process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true";
const unsubSecret = process.env.AUTH_SECRET || BASE;
const unsubToken = (email) => crypto.createHmac("sha256", unsubSecret).update(email.toLowerCase()).digest("hex");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const weekKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
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

// Email copy per language. Event titles/prices come from Airtable (TitleEs).
const T = {
  en: {
    locale: "en-US",
    subject: (n) => `🌵 ${n} kid events in Las Vegas this week`,
    heading: "This Week for Vegas Kids",
    countAll: (n) => `${n} family-friendly events around the valley`,
    countHood: (n, h) => `${n} family-friendly events in ${h}`,
    cta: "See all events →",
    free: "Free",
    footer: "Vegas Kiddos · a Threesided Studios project · always confirm details with the venue",
    unsub: "Unsubscribe",
  },
  es: {
    locale: "es-US",
    subject: (n) => `🌵 ${n} eventos para niños en Las Vegas esta semana`,
    heading: "Esta semana para los niños de Las Vegas",
    countAll: (n) => `${n} eventos para toda la familia por el valle`,
    countHood: (n, h) => `${n} eventos para toda la familia en ${h}`,
    cta: "Ver todos los eventos →",
    free: "Gratis",
    footer: "Vegas Kiddos · un proyecto de Threesided Studios · confirma siempre los detalles con el lugar",
    unsub: "Cancelar suscripción",
  },
};

// Localize scraped recurrence text + price text. Known tokens are swapped;
// anything unrecognized falls through unchanged (no worse than English).
const ES_CADENCE = [
  [/\bMultiple days a week\b/gi, "Varios días por semana"],
  [/\bEvery other week\b/gi, "Cada dos semanas"],
  [/\bWeekly\b/gi, "Semanal"], [/\bBiweekly\b/gi, "Quincenal"],
  [/\bDaily\b/gi, "Diario"], [/\bMonthly\b/gi, "Mensual"], [/\bWeekends?\b/gi, "Fines de semana"],
];
const ES_DAY = { Sun: "Dom", Mon: "Lun", Tue: "Mar", Wed: "Mié", Thu: "Jue", Fri: "Vie", Sat: "Sáb" };
const esRec = (rec) => {
  let s = String(rec);
  for (const [re, to] of ES_CADENCE) s = s.replace(re, to);
  return s.replace(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/g, (m) => ES_DAY[m]);
};
const esPrice = (p) =>
  String(p).replace(/\bfree\b/gi, "Gratis").replace(/\badmission\b/gi, "entrada").replace(/\bsuggested\b/gi, "sugerido");

const fmt = (iso, rec, locale = "en-US") => {
  const d = new Date(iso);
  const recTxt = locale.startsWith("es") ? esRec(rec) : rec;
  // For recurring, show the pattern; else the date.
  const date = d.toLocaleString(locale, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
  return rec ? `${recTxt} · ${d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" })}` : date;
};

const now = new Date();
const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString();
const today = now.toISOString().slice(0, 10);

// This week's approved events (upcoming within 7 days OR recurring).
const events = (await airtableAll("Events", `&filterByFormula=${encodeURIComponent("AND({Approved}=1, OR(NOT({Recurrence}=BLANK()), AND(IS_AFTER({Start}, DATEADD(NOW(),-1,'days')), IS_BEFORE({Start}, DATEADD(NOW(),7,'days')))))")}`))
  .filter((r) => r.fields.Title && r.fields.Start && !r.fields.Canceled)
  .map((r) => ({ ...r.fields, id: r.id }))
  .sort((a, b) => String(a.Start).localeCompare(String(b.Start)))
  .slice(0, 18);

const subs = (await airtableAll("Subscribers", `&filterByFormula=${encodeURIComponent("{Active}=1")}`))
  .map((r) => ({ email: r.fields.Email, hood: (r.fields.Neighborhood || "").trim(), lang: r.fields.Lang === "es" ? "es" : "en" }))
  .filter((s) => s.email);

console.log(`digest: ${events.length} events, ${subs.length} subscribers`);
if (!events.length) { console.log("no events — nothing to send"); process.exit(0); }
// In send mode we need subscribers; in preview mode we render samples regardless.
if (!subs.length && process.env.RESEND_API_KEY) { console.log("no subscribers — nothing to send"); process.exit(0); }

const rowsFor = (list, lang = "en") => list.map((f) => {
  const c = T[lang];
  const title = lang === "es" ? (f.TitleEs || f.Title) : f.Title;
  let price = f.PriceText || (f.PriceTier === "free" ? c.free : "");
  if (lang === "es" && price) price = esPrice(price);
  return `
  <tr><td style="padding:14px 0;border-bottom:1px solid #eee">
    <div style="font-size:12px;font-weight:700;color:#0FA89A;text-transform:uppercase">${fmt(f.Start, f.Recurrence, c.locale)}</div>
    <a href="${SITE}/event/${esc(f.id)}" style="font-size:18px;font-weight:700;color:#2D2A32;text-decoration:none">${esc(title)}</a>
    <div style="font-size:13px;color:#666">📍 ${esc(f.Venue)} · ${esc(price)}</div>
  </td></tr>`;
}).join("");

const htmlFor = (list, hoodLabel, unsub, lang = "en") => {
  const c = T[lang];
  const count = hoodLabel ? c.countHood(list.length, hoodLabel) : c.countAll(list.length);
  return `<!doctype html><html lang="${lang}"><body style="margin:0;background:#FFF8EE;font-family:-apple-system,Segoe UI,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:linear-gradient(135deg,#FF6B5E,#FFC93C);border-radius:24px;padding:28px;text-align:center;color:#fff">
      <div style="font-size:40px">🌵</div>
      <h1 style="margin:6px 0;font-size:26px">${c.heading}</h1>
      <p style="margin:0;opacity:.95">${count}</p>
    </div>
    <table width="100%" style="margin-top:8px">${rowsFor(list, lang)}</table>
    <div style="text-align:center;margin-top:20px">
      <a href="${SITE}" style="background:#FF6B5E;color:#fff;padding:12px 24px;border-radius:999px;font-weight:800;text-decoration:none">${c.cta}</a>
    </div>
    <p style="text-align:center;color:#999;font-size:12px;margin-top:24px">${c.footer}<br><a href="${unsub}" style="color:#999">${c.unsub}</a></p>
  </div></body></html>`;
};

if (!process.env.RESEND_API_KEY) {
  if (IN_CI) {
    console.error("RESEND_API_KEY missing in CI — refusing to preview-exit 0");
    process.exit(1);
  }
  // Preview only — write a full EN + ES sample email to disk (no send).
  const fs = await import("node:fs");
  const dir = process.env.PREVIEW_DIR || ".";
  const sample = events.slice(0, 8);
  for (const lang of ["en", "es"]) {
    const path = `${dir}/digest-preview-${lang}.html`;
    fs.writeFileSync(path, htmlFor(sample, "", "#", lang));
    console.log(`📧 ${lang}  subject: "${T[lang].subject(sample.length)}"  →  ${path}`);
  }
  console.log("RESEND_API_KEY not set — preview only (no send).");
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
  const tok = unsubToken(s.email);
  const unsubPage = `${SITE}/unsubscribe?e=${encodeURIComponent(s.email)}&t=${tok}`;
  const unsubApi = `${SITE}/api/unsubscribe?e=${encodeURIComponent(s.email)}&t=${tok}`;
  const c = T[s.lang];
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `vk-digest-${weekKey}-${s.email}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: s.email,
      subject: c.subject(list.length),
      html: htmlFor(list, "", unsubPage, s.lang),
      headers: { "List-Unsubscribe": `<${unsubApi}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
  });
  if (r.ok || r.status === 409) sent++;
  else console.error("send fail", s.email, r.status, (await r.text()).slice(0, 120));
}
console.log(`sent ${sent}/${subs.length}`);
