"use client";

import { useState } from "react";
import { Cloud, Heart } from "@/components/Doodles";
import { useLang } from "@/lib/lang-client";
import { t, type StringKey } from "@/lib/i18n";

const TYPES = [
  { id: "feedback", key: "ct_type_feedback" },
  { id: "suggestion", key: "ct_type_suggestion" },
  { id: "event-tip", key: "ct_type_eventtip" },
  { id: "bug", key: "ct_type_bug" },
] as const;

export default function ContactPage() {
  const lang = useLang();
  const tr = (k: StringKey) => t(lang, k);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [type, setType] = useState("feedback");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, type }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  const field =
    "w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 font-body text-ink outline-none transition focus:border-teal";

  if (status === "done") {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <Heart className="mx-auto h-16 w-16 animate-bob text-coral" />
        <h1 className="mt-4 font-display text-3xl font-700">{tr("ct_done_h")}</h1>
        <p className="mt-2 text-ink/70">{tr("ct_done_p")}</p>
        <button onClick={() => setStatus("idle")}
          className="hover-pop mt-6 rounded-full bg-coral-btn px-5 py-3 font-800 text-white shadow-pop">
          {tr("ct_send_another")}
        </button>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-xl px-4 py-10">
      <Cloud className="pointer-events-none absolute -left-4 top-4 h-16 w-24 animate-float opacity-70" />
      <h1 className="font-display text-4xl font-700">{tr("ct_h")}</h1>
      <p className="mt-2 text-ink/70">{tr("ct_intro")}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
          <span className="mb-1.5 block text-sm font-700 text-ink/70">{tr("ct_about_q")}</span>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((opt) => (
              <button type="button" key={opt.id} onClick={() => setType(opt.id)}
                aria-pressed={type === opt.id}
                className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-700 transition ${
                  type === opt.id ? "border-teal bg-teal-btn text-white" : "border-ink/15 bg-white text-ink/70"
                }`}>
                {tr(opt.key)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-700 text-ink/70">{tr("ct_name")}</span>
            <input name="name" className={field} placeholder={tr("ct_name_ph")} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-700 text-ink/70">{tr("ct_email")}</span>
            <input name="email" type="email" className={field} placeholder={tr("ct_email_ph")} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-700 text-ink/70">{tr("ct_msg")}</span>
          <textarea name="message" required rows={5} className={field}
            placeholder={tr("ct_msg_ph")} />
        </label>
        {status === "error" && (
          <p role="alert" className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-700 text-ink/80">
            {tr("ct_err")}
          </p>
        )}
        <button type="submit" disabled={status === "sending"}
          className="hover-pop w-full rounded-full bg-coral-btn px-5 py-4 font-800 text-white shadow-pop disabled:opacity-50">
          {status === "sending" ? tr("ct_sending") : tr("ct_send")}
        </button>
      </form>
    </div>
  );
}
