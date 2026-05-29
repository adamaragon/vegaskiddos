import { NextResponse } from "next/server";

// Adds an email to the weekly-digest Subscribers list (deduped by email).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; neighborhood?: string };
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) return NextResponse.json({ ok: true, stored: "log" });

  try {
    const res = await fetch(`https://api.airtable.com/v0/${base}/Subscribers`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: ["Email"] },
        records: [{ fields: { Email: email, Neighborhood: String(body.neighborhood || ""), SubscribedAt: new Date().toISOString(), Active: true } }],
        typecast: true,
      }),
    });
    if (!res.ok) {
      console.error("subscribe failed:", res.status, await res.text());
      return NextResponse.json({ error: "Could not subscribe — try again." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("subscribe error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
