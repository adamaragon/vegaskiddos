const SITE = "https://vegaskiddos.com";
const DEFAULT_TO = "adam@threesided.com";

function recipients(): string[] {
  const raw = process.env.STATS_TO || process.env.NOTIFY_TO || DEFAULT_TO;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function escHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/** Fire-and-forget admin email via Resend. Never throws; never blocks the caller. */
export async function notifyAdmin(opts: {
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log("[notifyAdmin] RESEND_API_KEY unset —", opts.subject);
    return;
  }
  const from = process.env.DIGEST_FROM || "Vegas Kiddos <hello@vegaskiddos.com>";
  const to = recipients();
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: opts.subject,
        html: opts.html,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    if (!r.ok) console.error("notifyAdmin failed:", r.status, (await r.text()).slice(0, 200));
  } catch (err) {
    console.error("notifyAdmin error:", err);
  }
}

export function adminUrl(): string {
  return `${SITE}/admin`;
}
