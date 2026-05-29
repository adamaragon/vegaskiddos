import { NextResponse } from "next/server";
import crypto from "crypto";

const SITE = "https://vegaskiddos.com";

// Friendly confirmation email on signup. No-ops if RESEND_API_KEY isn't set on
// the host (so local/preview signups still succeed). Bilingual to match the
// language the subscriber signed up in. Non-fatal — never blocks the signup.
async function sendWelcome(email: string, lang: "en" | "es", base: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const from = process.env.DIGEST_FROM || "Vegas Kiddos <hello@vegaskiddos.com>";
  const tok = crypto.createHash("sha256").update(email.toLowerCase() + base).digest("hex").slice(0, 16);
  const unsub = `${SITE}/unsubscribe?e=${encodeURIComponent(email)}&t=${tok}`;
  const c = lang === "es"
    ? {
        subject: "🌵 ¡Bienvenido a Vegas Kiddos!",
        heading: "¡Estás dentro! 🎉",
        body: "Gracias por unirte. Cada jueves te enviaremos los mejores eventos para niños en Las Vegas — seleccionados, seguros y organizados por zona.",
        cta: "Explorar eventos ahora →",
        foot: "Un proyecto de Threesided Studios · confirma siempre los detalles con el lugar",
        unsub: "Cancelar suscripción",
      }
    : {
        subject: "🌵 Welcome to Vegas Kiddos!",
        heading: "You're in! 🎉",
        body: "Thanks for joining. Every Thursday we'll send you the best kid-friendly events in Las Vegas — hand-picked, kid-safe, and sorted by neighborhood.",
        cta: "Browse events now →",
        foot: "A Threesided Studios project · always confirm details with the venue",
        unsub: "Unsubscribe",
      };
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:#FFF8EE;font-family:-apple-system,Segoe UI,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:24px">
      <div style="background:linear-gradient(135deg,#0FA89A,#7C5CBF);border-radius:24px;padding:32px;text-align:center;color:#fff">
        <div style="font-size:44px">🌵</div>
        <h1 style="margin:8px 0;font-size:26px">${c.heading}</h1>
        <p style="margin:0;opacity:.95;font-size:15px;line-height:1.5">${c.body}</p>
      </div>
      <div style="text-align:center;margin-top:20px">
        <a href="${SITE}" style="background:#FF6B5E;color:#fff;padding:12px 24px;border-radius:999px;font-weight:800;text-decoration:none">${c.cta}</a>
      </div>
      <p style="text-align:center;color:#999;font-size:12px;margin-top:24px">${c.foot}<br><a href="${unsub}" style="color:#999">${c.unsub}</a></p>
    </div></body></html>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: email, subject: c.subject, html, headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
    });
  } catch (err) {
    console.error("welcome email failed:", err);
  }
}

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
    await sendWelcome(email, lang, base);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("subscribe error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
