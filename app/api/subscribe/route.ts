import { NextResponse } from "next/server";

// Adds an email to the weekly-digest Subscribers list (deduped by email).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; neighborhood?: string; lang?: string };
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  const lang = body.lang === "es" ? "es" : "en";
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) return NextResponse.json({ ok: true, stored: "log" });

  const upsert = (fields: Record<string, unknown>) =>
    fetch(`https://api.airtable.com/v0/${base}/Subscribers`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: ["Email"] },
        records: [{ fields }],
        typecast: true,
      }),
    });

  try {
    const baseFields = { Email: email, Neighborhood: String(body.neighborhood || ""), SubscribedAt: new Date().toISOString(), Active: true };
    let res = await upsert({ ...baseFields, Lang: lang });
    // If the Lang column doesn't exist yet, don't fail the signup — retry without it.
    if (!res.ok) {
      const txt = await res.text();
      if (/UNKNOWN_FIELD_NAME/i.test(txt)) {
        res = await upsert(baseFields);
      } else {
        console.error("subscribe failed:", res.status, txt);
        return NextResponse.json({ error: "Could not subscribe — try again." }, { status: 502 });
      }
    }
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
