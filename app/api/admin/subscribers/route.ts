import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidSession, sessionEmail } from "@/lib/adminAuth";

const AT = process.env.AIRTABLE_TOKEN;
const BASE = process.env.AIRTABLE_BASE_ID;
const SITE = "https://vegaskiddos.com";

async function requireAdmin() {
  const c = await cookies();
  return isValidSession(c.get(ADMIN_COOKIE)?.value);
}

async function getAdminEmail() {
  const c = await cookies();
  return sessionEmail(c.get(ADMIN_COOKIE)?.value);
}

interface SubRecord { fields: Record<string, unknown> }

async function fetchAll(): Promise<SubRecord[]> {
  const out: SubRecord[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE}/Subscribers`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AT}` } });
    if (!res.ok) throw new Error(`Airtable ${res.status}`);
    const data = await res.json() as { records: SubRecord[]; offset?: string };
    out.push(...data.records);
    offset = data.offset;
  } while (offset);
  return out;
}

function computeStats(records: SubRecord[]) {
  const now = Date.now();
  const active = records.filter(r => r.fields.Active !== false);
  const inactive = records.filter(r => r.fields.Active === false);

  const newThisWeek = active.filter(r => {
    const d = r.fields.SubscribedAt ? new Date(String(r.fields.SubscribedAt)).getTime() : 0;
    return now - d < 7 * 86400000;
  }).length;

  const newThisMonth = active.filter(r => {
    const d = r.fields.SubscribedAt ? new Date(String(r.fields.SubscribedAt)).getTime() : 0;
    return now - d < 30 * 86400000;
  }).length;

  const byNeighborhood: Record<string, number> = {};
  const byLang: Record<string, number> = {};
  for (const r of active) {
    const h = String(r.fields.Neighborhood || "any");
    byNeighborhood[h] = (byNeighborhood[h] || 0) + 1;
    const l = String(r.fields.Lang || "en");
    byLang[l] = (byLang[l] || 0) + 1;
  }

  const recent = [...active]
    .sort((a, b) => {
      const da = a.fields.SubscribedAt ? new Date(String(a.fields.SubscribedAt)).getTime() : 0;
      const db = b.fields.SubscribedAt ? new Date(String(b.fields.SubscribedAt)).getTime() : 0;
      return db - da;
    })
    .slice(0, 20)
    .map(r => ({
      email: String(r.fields.Email || ""),
      neighborhood: String(r.fields.Neighborhood || ""),
      lang: String(r.fields.Lang || "en"),
      subscribedAt: String(r.fields.SubscribedAt || ""),
    }));

  return { total: active.length, inactive: inactive.length, newThisWeek, newThisMonth, byNeighborhood, byLang, recent };
}

// GET /api/admin/subscribers — subscriber stats for the admin dashboard.
export async function GET() {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!AT || !BASE) return NextResponse.json({ error: "No Airtable config" }, { status: 500 });

  try {
    return NextResponse.json(computeStats(await fetchAll()));
  } catch (err) {
    console.error("subscribers stats error:", err);
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}

// POST /api/admin/subscribers — sends a stats snapshot to the requesting admin.
export async function POST() {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
  if (!AT || !BASE) return NextResponse.json({ error: "No Airtable config" }, { status: 500 });

  try {
    const to = (await getAdminEmail()) || "adam@threesided.com";
    const stats = computeStats(await fetchAll());
    const from = process.env.DIGEST_FROM || "Vegas Kiddos <hello@vegaskiddos.com>";
    const dateStr = new Date().toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles",
    });

    const hoodRows = Object.entries(stats.byNeighborhood)
      .sort((a, b) => b[1] - a[1])
      .map(([hood, n]) =>
        `<tr><td style="padding:5px 12px;border-bottom:1px solid #f0e8d0;text-transform:capitalize">${hood}</td><td style="padding:5px 12px;border-bottom:1px solid #f0e8d0;text-align:right;font-weight:700">${n}</td></tr>`
      ).join("");

    const recentRows = stats.recent.slice(0, 10).map(r => {
      const date = r.subscribedAt
        ? new Date(r.subscribedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" })
        : "—";
      return `<tr>
        <td style="padding:5px 12px;border-bottom:1px solid #f0e8d0">${r.email}</td>
        <td style="padding:5px 12px;border-bottom:1px solid #f0e8d0;text-transform:capitalize">${r.neighborhood || "any"}</td>
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
      <div style="font-size:38px;font-weight:800;color:#0FA89A">${stats.total}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">Active</div>
    </div>
    <div style="background:#fff;border-radius:16px;padding:20px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08)">
      <div style="font-size:38px;font-weight:800;color:#FF6B5E">${stats.newThisWeek}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">This week</div>
    </div>
    <div style="background:#fff;border-radius:16px;padding:20px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08)">
      <div style="font-size:38px;font-weight:800;color:#7B5EA7">${stats.newThisMonth}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">This month</div>
    </div>
  </div>

  <div style="background:#fff;border-radius:16px;padding:20px;margin:12px 0;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <h2 style="margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#666">By neighborhood</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${hoodRows}</table>
  </div>

  <div style="background:#fff;border-radius:16px;padding:20px;margin:12px 0;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <h2 style="margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#666">Language</h2>
    <p style="margin:0;font-size:14px">🇺🇸 English: <strong>${stats.byLang.en || 0}</strong> &nbsp;·&nbsp; 🇲🇽 Spanish: <strong>${stats.byLang.es || 0}</strong></p>
  </div>

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
  </div>

  <p style="text-align:center;color:#999;font-size:12px;margin-top:20px">
    Vegas Kiddos Admin · <a href="${SITE}/admin" style="color:#999">Open admin panel</a>
    ${stats.inactive > 0 ? ` · ${stats.inactive} unsubscribed` : ""}
  </p>
</div></body></html>`;

    const subject = `📊 Vegas Kiddos: ${stats.total} subscribers · +${stats.newThisWeek} this week`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("stats email error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
