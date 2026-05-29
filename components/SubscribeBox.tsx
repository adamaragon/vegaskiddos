"use client";

import { useState } from "react";
import { NEIGHBORHOODS } from "@/lib/constants";
import { t, hoodLabel, type Lang } from "@/lib/i18n";

// Email capture for the weekly digest. Posts to /api/subscribe.
export function SubscribeBox({ compact = false, lang = "en" }: { compact?: boolean; lang?: Lang }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const tr = (k: Parameters<typeof t>[1]) => t(lang, k);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStatus("sending");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fd.get("email"), neighborhood: fd.get("neighborhood") || "", lang }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("error"); setMsg(d.error || tr("nl_err_again")); return; }
      setStatus("done");
    } catch {
      setStatus("error"); setMsg(tr("nl_err_generic"));
    }
  }

  if (status === "done") {
    return <p className={`font-700 text-teal-dark ${compact ? "text-sm" : ""}`}>{tr("nl_done")}</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        name="email"
        type="email"
        required
        placeholder={tr("nl_email_ph")}
        className={`w-full min-w-[12rem] flex-1 basis-full rounded-full border-2 border-ink/15 bg-white px-4 outline-none focus:border-teal sm:basis-0 ${compact ? "py-2 text-sm" : "py-2.5"}`}
      />
      <select
        name="neighborhood"
        aria-label={tr("nl_area_label")}
        defaultValue=""
        className={`flex-1 rounded-full border-2 border-ink/15 bg-white px-3 text-ink/70 outline-none focus:border-teal sm:flex-none ${compact ? "py-2 text-sm" : "py-2.5"}`}
      >
        <option value="">{tr("nl_all_areas")}</option>
        {NEIGHBORHOODS.map((n) => (
          <option key={n.id} value={n.id}>{hoodLabel(lang, n.id).split(" / ")[0]}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={status === "sending"}
        className={`hover-pop rounded-full bg-coral font-800 text-white shadow-pop disabled:opacity-50 ${compact ? "px-4 py-2 text-sm" : "px-5 py-2.5"}`}
      >
        {status === "sending" ? "…" : tr("nl_button")}
      </button>
      {status === "error" && <span className="w-full text-sm font-700 text-coral-dark">{msg}</span>}
    </form>
  );
}
