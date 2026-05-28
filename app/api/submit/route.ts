import { NextResponse } from "next/server";

// Receives a community event submission and writes it to Airtable as an
// unapproved record (Approved=false) for admin review. If Airtable isn't
// configured, the submission is logged so the form still works in dev.

export async function POST(req: Request) {
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
    return NextResponse.json({ ok: true, stored: "airtable" });
  } catch (err) {
    console.error("Submit error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
