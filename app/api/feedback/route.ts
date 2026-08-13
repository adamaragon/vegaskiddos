import { NextResponse } from "next/server";
import { allowRequest } from "@/lib/rateLimit";

// Stores contact / feedback / suggestion submissions in the Airtable Feedback
// table for review. Falls back to logging when Airtable isn't configured.
export async function POST(req: Request) {
  if (!allowRequest(req, "feedback", 8, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.message || String(body.message).trim().length < 3) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const fields = {
    Name: String(body.name || "").slice(0, 120),
    Email: String(body.email || "").slice(0, 200),
    Type: String(body.type || "feedback"),
    Message: String(body.message).slice(0, 4000),
    SubmittedAt: new Date().toISOString(),
    Handled: false,
  };

  if (!token || !base) {
    console.log("[Vegas Kiddos] Feedback (no Airtable):", fields);
    return NextResponse.json({ ok: true, stored: "log" });
  }
  try {
    const res = await fetch(`https://api.airtable.com/v0/${base}/Feedback`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: [{ fields }], typecast: true }),
    });
    if (!res.ok) {
      console.error("Feedback insert failed:", res.status, await res.text());
      return NextResponse.json({ error: "Store failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, stored: "airtable" });
  } catch (err) {
    console.error("Feedback error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
