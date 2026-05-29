import { NextResponse } from "next/server";
import crypto from "crypto";

// One-token unsubscribe. The token is sha256(email + base id) — not guessable
// without knowing both, and stable so the digest can generate matching links.
function token(email: string, base: string) {
  return crypto.createHash("sha256").update(email.toLowerCase() + base).digest("hex").slice(0, 16);
}

export async function POST(req: Request) {
  const { email, t } = (await req.json().catch(() => ({}))) as { email?: string; t?: string };
  const base = process.env.AIRTABLE_BASE_ID;
  const at = process.env.AIRTABLE_TOKEN;
  const e = String(email || "").trim().toLowerCase();
  if (!e || !base || !at) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (t !== token(e, base)) return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 403 });

  try {
    // Find the subscriber and set Active = false.
    const find = await fetch(
      `https://api.airtable.com/v0/${base}/Subscribers?maxRecords=1&filterByFormula=${encodeURIComponent(`LOWER({Email})='${e.replace(/'/g, "")}'`)}`,
      { headers: { Authorization: `Bearer ${at}` } }
    );
    const data = (await find.json()) as { records: { id: string }[] };
    if (!data.records?.length) return NextResponse.json({ ok: true }); // already gone
    await fetch(`https://api.airtable.com/v0/${base}/Subscribers/${data.records[0].id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { Active: false } }),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
