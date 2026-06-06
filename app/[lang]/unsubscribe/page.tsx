"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function Unsub() {
  const params = useSearchParams();
  const email = params.get("e") || "";
  const t = params.get("t") || "";
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function unsubscribe() {
    setStatus("sending");
    const res = await fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, t }),
    });
    setStatus(res.ok ? "done" : "error");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="rounded-blob border border-ink/10 bg-white p-8 shadow-card">
        {status === "done" ? (
          <>
            <p className="text-4xl">👋</p>
            <h1 className="mt-3 font-display text-2xl font-700">You&apos;re unsubscribed</h1>
            <p className="mt-2 text-ink/70">{email} won&apos;t get the weekly digest anymore. Changed your mind? You can re-subscribe anytime.</p>
            <Link href="/" className="hover-pop mt-5 inline-block rounded-full bg-coral-btn px-5 py-3 font-800 text-white shadow-pop">Back to events</Link>
          </>
        ) : (
          <>
            <p className="text-4xl">📭</p>
            <h1 className="mt-3 font-display text-2xl font-700">Unsubscribe?</h1>
            <p className="mt-2 text-ink/70">Stop sending the weekly Vegas Kiddos digest to <strong>{email || "your email"}</strong>?</p>
            <button onClick={unsubscribe} disabled={status === "sending" || !email}
              className="hover-pop mt-5 rounded-full bg-coral-btn px-5 py-3 font-800 text-white shadow-pop disabled:opacity-50">
              {status === "sending" ? "…" : "Yes, unsubscribe me"}
            </button>
            {status === "error" && <p className="mt-3 text-sm font-700 text-coral-btn">That link looks invalid or expired.</p>}
          </>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-ink/70">Loading…</div>}>
      <Unsub />
    </Suspense>
  );
}
