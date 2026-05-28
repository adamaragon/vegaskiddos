"use client";

import { useState } from "react";
import { Cloud, Heart } from "@/components/Doodles";

const TYPES = [
  { id: "feedback", label: "💬 Feedback" },
  { id: "suggestion", label: "💡 Suggestion" },
  { id: "event-tip", label: "📅 Event tip" },
  { id: "bug", label: "🐛 Something's broken" },
];

export default function ContactPage() {
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
        <h1 className="mt-4 font-display text-3xl font-700">Thank you!</h1>
        <p className="mt-2 text-ink/70">
          We read every message. If you left an email, we might just write back.
        </p>
        <button onClick={() => setStatus("idle")}
          className="hover-pop mt-6 rounded-full bg-coral px-5 py-3 font-800 text-white shadow-pop">
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-xl px-4 py-10">
      <Cloud className="pointer-events-none absolute -left-4 top-4 h-16 w-24 animate-float opacity-70" />
      <h1 className="font-display text-4xl font-700">Say hello 👋</h1>
      <p className="mt-2 text-ink/70">
        Got feedback, a great event we missed, or an idea to make Vegas Kiddos better?
        We&apos;d love to hear it.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
          <span className="mb-1.5 block text-sm font-700 text-ink/70">What&apos;s this about?</span>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button type="button" key={t.id} onClick={() => setType(t.id)}
                className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-700 transition ${
                  type === t.id ? "border-teal bg-teal text-white" : "border-ink/15 bg-white text-ink/70"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-700 text-ink/70">Your name</span>
            <input name="name" className={field} placeholder="Optional" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-700 text-ink/70">Email</span>
            <input name="email" type="email" className={field} placeholder="So we can reply (optional)" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-700 text-ink/70">Message *</span>
          <textarea name="message" required rows={5} className={field}
            placeholder="Tell us what's on your mind…" />
        </label>
        {status === "error" && (
          <p className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-700 text-coral-dark">
            Hmm, that didn&apos;t send. Please try again.
          </p>
        )}
        <button type="submit" disabled={status === "sending"}
          className="hover-pop w-full rounded-full bg-coral px-5 py-4 font-800 text-white shadow-pop disabled:opacity-50">
          {status === "sending" ? "Sending…" : "Send message"}
        </button>
      </form>
    </div>
  );
}
