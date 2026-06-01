"use client";

import { useCallback, useEffect, useState } from "react";
import { track } from "@/lib/track";

// "Remind me about my favorites" — opt into web push (this device) and/or email.
// Stores the subscription + the current favorite ids via /api/reminders; the
// daily send-reminders job notifies you the evening before a saved event.

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function post(body: unknown) {
  const r = await fetch("/api/reminders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Failed");
}

export function RemindMe({ favoriteIds, lang = "en" }: { favoriteIds: string[]; lang?: "en" | "es" }) {
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const [emailDone, setEmailDone] = useState(false);
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && !!VAPID;

  // On mount: if already push-subscribed, reflect "on".
  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushOn(!!sub))
      .catch(() => {});
  }, [supported]);

  const syncFavorites = useCallback(async () => {
    if (!supported) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const k = sub.toJSON().keys || {};
    await post({ channel: "push", endpoint: sub.endpoint, keys: k, favoriteIds, lang }).catch(() => {});
  }, [supported, favoriteIds, lang]);

  // Keep the stored favorite list in sync while subscribed.
  useEffect(() => { if (pushOn) syncFavorites(); }, [pushOn, favoriteIds, syncFavorites]);

  async function enablePush() {
    setBusy(true); setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setMsg(t("Notifications were blocked.", "Las notificaciones están bloqueadas.")); setBusy(false); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID),
      });
      const k = sub.toJSON().keys || {};
      await post({ channel: "push", endpoint: sub.endpoint, keys: k, favoriteIds, lang });
      track("Reminder On", { channel: "push" });
      setPushOn(true);
    } catch {
      setMsg(t("Couldn't turn on reminders — try again.", "No se pudieron activar los recordatorios."));
    }
    setBusy(false);
  }

  async function sendTest() {
    setBusy(true); setMsg("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { setMsg(t("Turn reminders on first.", "Activa los recordatorios primero.")); setBusy(false); return; }
      const r = await fetch("/api/reminders/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.toJSON().keys }),
      });
      if (!r.ok) throw new Error();
      setMsg(t("Sent! Check your notifications.", "¡Enviado! Revisa tus notificaciones."));
    } catch {
      setMsg(t("Test failed — check notification permissions.", "Falló — revisa los permisos de notificación."));
    }
    setBusy(false);
  }

  async function disablePush() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await post({ channel: "push", endpoint: sub.endpoint, keys: sub.toJSON().keys, favoriteIds, lang, unsubscribe: true }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setPushOn(false);
    } catch { /* ignore */ }
    setBusy(false);
  }

  async function enableEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      await post({ channel: "email", email, favoriteIds, lang });
      track("Reminder On", { channel: "email" });
      setEmailDone(true);
    } catch {
      setMsg(t("Couldn't save — check the address.", "No se pudo guardar — revisa el correo."));
    }
    setBusy(false);
  }

  if (!favoriteIds.length) return null;

  return (
    <div className="rounded-blob border border-ink/10 bg-gradient-to-br from-white to-sand/70 p-5 shadow-sm">
      <p className="font-display text-lg font-800 text-ink">
        🔔 {t("Get reminded", "Recibe recordatorios")}
      </p>
      <p className="mt-1 text-sm text-ink/70">
        {t("We'll nudge you the evening before a saved event.", "Te avisamos la tarde anterior a un evento guardado.")}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {supported ? (
          pushOn ? (
            <>
              <span className="rounded-full border-2 border-teal bg-teal-btn px-4 py-2 text-sm font-800 text-white">
                ✓ {t("Reminders on (this device)", "Recordatorios activos")}
              </span>
              <button onClick={sendTest} disabled={busy}
                className="rounded-full border-2 border-ink/15 bg-white px-4 py-2 text-sm font-800 text-ink/70 transition hover:border-teal disabled:opacity-50">
                {busy ? "…" : t("Send a test", "Enviar prueba")}
              </button>
              <button onClick={disablePush} disabled={busy}
                className="text-sm font-700 text-ink/70 underline-offset-2 hover:underline disabled:opacity-50">
                {t("turn off", "desactivar")}
              </button>
            </>
          ) : (
            <button onClick={enablePush} disabled={busy}
              className="hover-pop rounded-full bg-coral-btn px-4 py-2 text-sm font-800 text-white shadow-pop disabled:opacity-50">
              {busy ? "…" : t("🔔 Remind me on this device", "🔔 Avísame en este dispositivo")}
            </button>
          )
        ) : (
          <span className="text-sm text-ink/70">{t("Push isn't supported on this browser — use email below.", "Este navegador no admite notificaciones — usa el correo.")}</span>
        )}
      </div>

      <form onSubmit={enableEmail} className="mt-3 flex flex-wrap items-center gap-2">
        {emailDone ? (
          <span className="text-sm font-700 text-teal-btn">✓ {t("We'll email your reminders.", "Te enviaremos recordatorios por correo.")}</span>
        ) : (
          <>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={t("you@email.com", "tu@correo.com")}
              className="w-52 rounded-full border-2 border-ink/15 bg-white px-4 py-2 text-sm font-700 text-ink/80 outline-none focus:border-teal"
            />
            <button type="submit" disabled={busy}
              className="rounded-full border-2 border-ink/15 bg-white px-4 py-2 text-sm font-800 text-ink/70 transition hover:border-coral disabled:opacity-50">
              {t("Email me instead", "Por correo")}
            </button>
          </>
        )}
      </form>
      {msg && <p className="mt-2 text-sm font-700 text-coral-btn">{msg}</p>}
    </div>
  );
}
