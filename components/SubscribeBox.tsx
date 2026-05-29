"use client";

import { useState } from "react";

// Email capture for the weekly digest. Posts to /api/subscribe.
export function SubscribeBox({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get("email");
    setStatus("sending");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("error"); setMsg(d.error || "Try again."); return; }
      setStatus("done");
    } catch {
      setStatus("error"); setMsg("Something went wrong.");
    }
  }

  if (status === "done") {
    return <p className={`font-700 text-teal-dark ${compact ? "text-sm" : ""}`}>🎉 You&apos;re in! Watch your inbox each week.</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        name="email"
        type="email"
        required
        placeholder="you@email.com"
        className={`min-w-0 flex-1 rounded-full border-2 border-ink/15 bg-white px-4 outline-none focus:border-teal ${compact ? "py-2 text-sm" : "py-2.5"}`}
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className={`hover-pop rounded-full bg-coral font-800 text-white shadow-pop disabled:opacity-50 ${compact ? "px-4 py-2 text-sm" : "px-5 py-2.5"}`}
      >
        {status === "sending" ? "…" : "Get the digest"}
      </button>
      {status === "error" && <span className="w-full text-sm font-700 text-coral-dark">{msg}</span>}
    </form>
  );
}
