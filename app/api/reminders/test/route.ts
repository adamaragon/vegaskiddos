import { NextResponse } from "next/server";
import webpush from "web-push";

// Sends a single test push to the caller's own subscription, through the full
// server -> FCM -> service-worker path. Lets a subscriber confirm reminders
// actually display on their device (the part most likely to be misconfigured).

export const runtime = "nodejs";

// Configure web-push lazily, inside the handler. Doing this at module scope ran
// setVapidDetails() during `next build` page-data collection, which throws when
// the build env's VAPID keys are absent/malformed and fails the whole build.
function configureWebpush(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@vegaskiddos.com", pub, priv);
  return true;
}

export async function POST(req: Request) {
  if (!configureWebpush()) return NextResponse.json({ error: "Push not configured." }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!b.endpoint || !b.keys?.p256dh || !b.keys?.auth) {
    return NextResponse.json({ error: "Missing subscription." }, { status: 400 });
  }
  try {
    await webpush.sendNotification(
      { endpoint: b.endpoint, keys: { p256dh: b.keys.p256dh, auth: b.keys.auth } },
      JSON.stringify({
        title: "🌵 Test reminder",
        body: "Nice — reminders are working! We'll nudge you the evening before a saved event.",
        url: "/my-list",
        tag: "vk-test",
      })
    );
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const code = (e as { statusCode?: number }).statusCode;
    return NextResponse.json({ error: `Push failed (${code || "?"})` }, { status: 502 });
  }
}
