// Weekly subscriber stats email to the admin.
// Env: AIRTABLE_TOKEN, AIRTABLE_BASE_ID, RESEND_API_KEY, [DIGEST_FROM], [STATS_TO]

const AT = process.env.AIRTABLE_TOKEN, BASE = process.env.AIRTABLE_BASE_ID;
if (!AT || !BASE) { console.error("AIRTABLE_TOKEN / AIRTABLE_BASE_ID required"); process.exit(1); }

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.DIGEST_FROM || "Vegas Kiddos <hello@vegaskiddos.com>";
const TO = process.env.STATS_TO || "adam@threesided.com";
const SITE = "https://vegaskiddos.com";

async function airtableAll(table) {
  const out = []; let offset;
  do {
    const u = `https://api.airtable.com/v0/${BASE}/${table}?pageSize=100${offset ? `&offset=${offset}` : ""}`;
    const r = await fetch(u, { headers: { Authorization: `Bearer ${AT}` } });
    if (!r.ok) throw new Error(`${table} ${r.status}: ${await r.text()}`);
    const d = await r.json(); out.push(...d.records); offset = d.offset;
  } while (offset);
  return out;
}

const records = await airtableAll("Subscribers");
const now = Date.now();
const active = records.filter(r => r.fields.Active !== false);
const inactive = records.filter(r => r.fields.Active === false);

const newThisWeek = active.filter(r => now - new Date(r.fields.SubscribedAt || 0).getTime() < 7 * 86400000).length;
const newThisMonth = active.filter(r => now - new Date(r.fields.SubscribedAt || 0).getTime() < 30 * 86400000).length;

const byHood = {}, byLang = {};
for (const r of active) {
  const h = r.fields.Neighborhood || "any"; byHood[h] = (byHood[h] || 0) + 1;
  const l = r.fields.Lang || "en"; byLang[l] = (byLang[l] || 0) + 1;
}

const recent = [...active]
  .sort((a, b) => new Date(b.fields.SubscribedAt || 0) - new Date(a.fields.SubscribedAt || 0))
  .slice(0, 10)
  .map(r => ({
    email: r.fields.Email,
    neighborhood: r.fields.Neighborhood || "any",
    lang: r.fields.Lang || "en",
    subscribedAt: r.fields.SubscribedAt,
  }));

console.log(`📊 Subscribers: ${active.length} active (+${newThisWeek} this week, +${newThisMonth} this month)`);
console.log("By neighborhood:", byHood);
console.log("By language:", byLang);

if (!RESEND_KEY) {
  console.log("\nNo RESEND_API_KEY — preview only. Stats logged above.");
  process.exit(0);
}

const dateStr = new Date().toLocaleDateString("en-US", {
  month: "long", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles",
});

const hoodRows = Object.entries(byHood).sort((a, b) => b[1] - a[1])
  .map(([hood, n]) =>
    `<tr><td style="padding:5px 12px;border-bottom:1px solid #f0e8d0;text-transform:capitalize">${hood}</td><td style="padding:5px 12px;border-bottom:1px solid #f0e8d0;text-align:right;font-weight:700">${n}</td></tr>`
  ).join("");

const recentRows = recent.map(r => {
  const date = r.subscribedAt
    ? new Date(r.subscribedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" })
    : "—";
  return `<tr>
    <td style="padding:5px 12px;border-bottom:1px solid #f0e8d0">${r.email}</td>
    <td style="padding:5px 12px;border-bottom:1px solid #f0e8d0;text-transform:capitalize">${r.neighborhood}</td>
    <td style="padding:5px 12px;border-bottom:1px solid #f0e8d0;font-weight:700">${r.lang.toUpperCase()}</td>
    <td style="padding:5px 12px;border-bottom:1px solid #f0e8d0">${date}</td>
  </tr>`;
}).join("");

const html = `<!doctype html><html><body style="margin:0;background:#FFF8EE;font-family:-apple-system,Segoe UI,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px">
  <div style="background:linear-gradient(135deg,#0FA89A,#7C5CBF);border-radius:24px;padding:28px;text-align:center;color:#fff">
    <div style="font-size:40px">📊</div>
    <h1 style="margin:8px 0;font-size:22px;font-weight:800">Vegas Kiddos Subscribers</h1>
    <p style="margin:0;opacity:.9;font-size:13px">${dateStr}</p>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0">
    <div style="background:#fff;border-radius:16px;padding:20px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08)">
      <div style="font-size:38px;font-weight:800;color:#0FA89A">${active.length}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">Active</div>
    </div>
    <div style="background:#fff;border-radius:16px;padding:20px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08)">
      <div style="font-size:38px;font-weight:800;color:#FF6B5E">${newThisWeek}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">This week</div>
    </div>
    <div style="background:#fff;border-radius:16px;padding:20px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08)">
      <div style="font-size:38px;font-weight:800;color:#7B5EA7">${newThisMonth}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">This month</div>
    </div>
  </div>

  <div style="background:#fff;border-radius:16px;padding:20px;margin:12px 0;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <h2 style="margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#666">By neighborhood</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${hoodRows}</table>
  </div>

  <div style="background:#fff;border-radius:16px;padding:20px;margin:12px 0;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <h2 style="margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#666">Language</h2>
    <p style="margin:0;font-size:14px">🇺🇸 English: <strong>${byLang.en || 0}</strong> &nbsp;·&nbsp; 🇲🇽 Spanish: <strong>${byLang.es || 0}</strong></p>
  </div>

  ${recent.length ? `
  <div style="background:#fff;border-radius:16px;padding:20px;margin:12px 0;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <h2 style="margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#666">Recent signups</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#FFF8EE">
        <th style="padding:5px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#999">Email</th>
        <th style="padding:5px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#999">Hood</th>
        <th style="padding:5px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#999">Lang</th>
        <th style="padding:5px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#999">Joined</th>
      </tr></thead>
      <tbody>${recentRows}</tbody>
    </table>
  </div>` : ""}

  <p style="text-align:center;color:#999;font-size:12px;margin-top:20px">
    Vegas Kiddos Admin · <a href="${SITE}/admin" style="color:#999">Open admin panel</a>
    ${inactive.length > 0 ? ` · ${inactive.length} unsubscribed` : ""}
  </p>
</div></body></html>`;

const subject = `📊 Vegas Kiddos: ${active.length} subscribers · +${newThisWeek} this week`;
const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ from: FROM, to: TO, subject, html }),
});
if (!res.ok) {
  console.error("Resend failed:", res.status, await res.text());
  process.exit(1);
}
console.log(`✅ Stats email sent to ${TO}`);
