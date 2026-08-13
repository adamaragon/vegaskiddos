import { NextResponse } from "next/server";
import { allowRequest } from "@/lib/rateLimit";
import { adminUrl, escHtml, notifyAdmin } from "@/lib/notifyAdmin";
import { safeHttpUrl } from "@/lib/httpUrl";

// Receives a community event submission and writes it to Airtable as an
// unapproved record (Approved=false) for admin review. If Airtable isn't
// configured, the submission is logged so the form still works in dev.

export async function POST(req: Request) {
  if (!allowRequest(req, "submit", 5, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many submissions. Try again later." }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title || !body.venue || !body.start) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Honeypot: bots fill hidden "company". Pretend success, write nothing.
  if (String(body.company || "").trim()) {
    return NextResponse.json({ ok: true, stored: "ok" });
  }

  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || "Events";

  const fields = {
    Title: String(body.title),
    Description: String(body.description || ""),
    Venue: String(body.venue),
    Address: String(body.address || ""),
    Neighborhood: String(body.neighborhood || ""),
    Start: String(body.start),
    AgeTiers: Array.isArray(body.ageTiers) ? body.ageTiers.map(String) : [],
    PriceTier: String(body.priceTier || "free"),
    Url: String(body.url || ""),
    Source: "Community",
    SubmitterEmail: String(body.submitterEmail || ""),
    Recurrence: String(body.recurrence || ""),
    Approved: false,
  };

  if (!token || !base) {
    console.log("[Vegas Kiddos] Submission (Airtable not configured):", fields);
    return NextResponse.json({ ok: true, stored: "log" });
  }

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: [{ fields }], typecast: true }),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      console.error("Airtable submit failed:", res.status, text);
      return NextResponse.json({ error: "Airtable error" }, { status: 502 });
    }
    const saved = (await res.json().catch(() => ({}))) as { records?: { id?: string }[] };
    const recId = saved.records?.[0]?.id;
    const when = fields.Start
      ? new Date(fields.Start).toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/Los_Angeles",
        })
      : "";
    const submitter = fields.SubmitterEmail || "not given";
    const eventUrl = safeHttpUrl(fields.Url);
    const replyTo = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.SubmitterEmail)
      ? fields.SubmitterEmail
      : undefined;
    await notifyAdmin({
      subject: `🌵 New event submission: ${fields.Title}`.slice(0, 200),
      replyTo,
      html: `<!doctype html><html><body style="margin:0;background:#FFF8EE;font-family:-apple-system,Segoe UI,sans-serif">
        <div style="max-width:560px;margin:0 auto;padding:24px">
          <p style="font-size:13px;font-weight:700;color:#0FA89A;text-transform:uppercase;margin:0">Community submission</p>
          <h1 style="margin:8px 0 16px;font-size:22px;color:#2D2A32">${escHtml(fields.Title)}</h1>
          <table style="width:100%;font-size:14px;color:#2D2A32;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#666;width:120px">When</td><td>${escHtml(when)}${fields.Recurrence ? ` · ${escHtml(fields.Recurrence)}` : ""}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Venue</td><td>${escHtml(fields.Venue)}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Address</td><td>${escHtml(fields.Address) || "—"}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Area</td><td>${escHtml(fields.Neighborhood) || "—"}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Price</td><td>${escHtml(fields.PriceTier)}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Ages</td><td>${escHtml(fields.AgeTiers.join(", ") || "—")}</td></tr>
            <tr><td style="padding:6px 0;color:#666">From</td><td>${escHtml(submitter)}</td></tr>
          </table>
          ${fields.Description ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:#2D2A32">${escHtml(fields.Description).slice(0, 800)}</p>` : ""}
          ${eventUrl ? `<p style="margin:12px 0 0;font-size:13px"><a href="${escHtml(eventUrl)}">${escHtml(eventUrl)}</a></p>` : ""}
          <p style="margin:24px 0 0">
            <a href="${adminUrl()}" style="background:#FF6B5E;color:#fff;padding:10px 18px;border-radius:999px;font-weight:800;text-decoration:none">Review in admin</a>
          </p>
          ${recId ? `<p style="margin:12px 0 0;font-size:12px;color:#999">${escHtml(recId)}</p>` : ""}
        </div>
      </body></html>`,
    });
    return NextResponse.json({ ok: true, stored: "airtable" });
  } catch (err) {
    console.error("Submit error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
