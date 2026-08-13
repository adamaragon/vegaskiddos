import { NextResponse } from "next/server";
import { unsubTokenOk } from "@/lib/unsubToken";
import { allowRequest } from "@/lib/rateLimit";

async function deactivate(table: string, email: string, at: string, base: string) {
  const find = await fetch(
    `https://api.airtable.com/v0/${base}/${table}?maxRecords=5&filterByFormula=${encodeURIComponent(`LOWER({Email})='${email.replace(/'/g, "")}'`)}`,
    { headers: { Authorization: `Bearer ${at}` } }
  );
  const data = (await find.json()) as { records: { id: string }[] };
  for (const rec of data.records || []) {
    await fetch(`https://api.airtable.com/v0/${base}/${table}/${rec.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { Active: false } }),
    });
  }
}

async function handle(req: Request) {
  if (!allowRequest(req, "unsub", 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const url = new URL(req.url);
  let email = url.searchParams.get("e") || "";
  let t = url.searchParams.get("t") || "";
  let kind = url.searchParams.get("kind") || "digest";
  if (!email || !t) {
    const body = (await req.json().catch(() => ({}))) as { email?: string; t?: string; kind?: string };
    email = email || String(body.email || "");
    t = t || String(body.t || "");
    kind = body.kind || kind;
  }
  const base = process.env.AIRTABLE_BASE_ID;
  const at = process.env.AIRTABLE_TOKEN;
  const e = email.trim().toLowerCase();
  if (!e || !base || !at) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!unsubTokenOk(e, base, t)) return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 403 });

  try {
    if (kind !== "reminders") await deactivate("Subscribers", e, at, base);
    if (kind === "reminders" || kind === "all") await deactivate("Reminders", e, at, base);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
