import { NextResponse } from "next/server";

// Stores a "remind me about my favorites" subscription — web push and/or email.
// Upserts by Endpoint (push) or Email so re-subscribing / syncing the favorite
// list just updates the existing row. The daily send-reminders job reads these.

const API = "https://api.airtable.com/v0";

type Body = {
  channel?: "push" | "email";
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  email?: string;
  favoriteIds?: string[];
  lang?: string;
  unsubscribe?: boolean;
};

export async function POST(req: Request) {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) return NextResponse.json({ ok: true, stored: "log" });

  const b = (await req.json().catch(() => ({}))) as Body;
  const lang = b.lang === "es" ? "es" : "en";
  const favoriteIds = Array.isArray(b.favoriteIds) ? b.favoriteIds.filter(Boolean).slice(0, 500) : [];

  const isPush = b.channel === "push" && b.endpoint && b.keys?.p256dh && b.keys?.auth;
  const isEmail = b.channel === "email" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.email || ""));
  if (!isPush && !isEmail) {
    return NextResponse.json({ error: "Need a valid push subscription or email." }, { status: 400 });
  }

  const fields: Record<string, unknown> = {
    Channel: isPush ? "push" : "email",
    FavoriteIds: favoriteIds.join(","),
    Lang: lang,
    Active: !b.unsubscribe,
    CreatedAt: new Date().toISOString(),
  };
  let mergeOn: string;
  if (isPush) {
    fields.Endpoint = b.endpoint;
    fields.Keys = JSON.stringify(b.keys);
    fields.Ref = `push:${String(b.endpoint).slice(-14)}`;
    mergeOn = "Endpoint";
  } else {
    fields.Email = String(b.email).toLowerCase();
    fields.Ref = String(b.email).toLowerCase();
    mergeOn = "Email";
  }

  const res = await fetch(`${API}/${base}/Reminders`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      performUpsert: { fieldsToMergeOn: [mergeOn] },
      records: [{ fields }],
      typecast: true,
    }),
  });
  if (!res.ok) {
    console.error("reminders upsert failed:", res.status, await res.text());
    return NextResponse.json({ error: "Could not save reminder — try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
