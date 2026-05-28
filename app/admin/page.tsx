"use client";

import { useCallback, useEffect, useState } from "react";

interface AdminEvent {
  id: string; title: string; venue: string; start: string;
  neighborhood: string; priceTier: string; ageTiers: string[];
  source: string; url: string; description: string;
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [queue, setQueue] = useState<"pending" | "approved">("pending");
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState("");

  const load = useCallback(async (q: "pending" | "approved") => {
    setLoading(true);
    const res = await fetch(`/api/admin/events?queue=${q}`);
    if (res.status === 401) { setAuthed(false); setLoading(false); return; }
    const data = await res.json();
    setAuthed(true);
    setEvents(data.events || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(queue); }, [queue, load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/admin/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pw }),
    });
    if (res.ok) { setPw(""); load(queue); }
    else setErr("Wrong email or password.");
  }

  async function runScrape() {
    setScraping(true);
    setScrapeMsg("");
    try {
      const res = await fetch("/api/admin/scrape", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "failed");
      setScrapeMsg(`Found ${d.totalFound} events · ${d.inserted} new added to the queue.`);
      if (queue === "pending") load("pending");
    } catch (e) {
      setScrapeMsg(`Scrape failed: ${(e as Error).message}`);
    }
    setScraping(false);
  }

  async function act(id: string, action: "approve" | "reject" | "unapprove") {
    setBusy(id);
    await fetch(`/api/admin/events/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setEvents((evs) => evs.filter((e) => e.id !== id));
    setBusy(null);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false); setEvents([]);
  }

  if (authed === null) {
    return <div className="mx-auto max-w-lg px-4 py-20 text-center text-ink/40">Loading…</div>;
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm px-4 py-20">
        <div className="rounded-blob border border-ink/10 bg-white p-8 shadow-card text-center">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-3 font-display text-2xl font-700">Admin sign-in</h1>
          <p className="mt-1 text-sm text-ink/60">For the Vegas Kiddos team only.</p>
          <form onSubmit={login} className="mt-6 space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email" autoFocus autoComplete="username"
              className="w-full rounded-2xl border-2 border-ink/15 px-4 py-3 text-center outline-none focus:border-teal" />
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
              placeholder="Password" autoComplete="current-password"
              className="w-full rounded-2xl border-2 border-ink/15 px-4 py-3 text-center outline-none focus:border-teal" />
            {err && <p className="text-sm font-700 text-coral-dark">{err}</p>}
            <button type="submit"
              className="hover-pop w-full rounded-full bg-coral px-5 py-3 font-800 text-white shadow-pop">
              Sign in
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-700">Admin 🛠️</h1>
        <div className="flex items-center gap-3">
          <button onClick={runScrape} disabled={scraping}
            className="hover-pop rounded-full bg-grape px-4 py-2 text-sm font-800 text-white shadow-pop disabled:opacity-50">
            {scraping ? "🔄 Scraping…" : "🔄 Scrape now"}
          </button>
          <button onClick={logout} className="text-sm font-700 text-ink/50 hover:text-coral">Sign out</button>
        </div>
      </div>
      {scrapeMsg && (
        <p className="mt-3 rounded-2xl bg-grape/10 px-4 py-2 text-sm font-700 text-grape">{scrapeMsg}</p>
      )}

      <div className="mt-4 flex rounded-full border-2 border-ink/15 bg-white p-1">
        {(["pending", "approved"] as const).map((q) => (
          <button key={q} onClick={() => setQueue(q)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-800 capitalize transition ${queue === q ? "bg-teal text-white" : "text-ink/60"}`}>
            {q === "pending" ? "📥 Review queue" : "✅ Published"}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm font-700 text-ink/50">
        {loading ? "Loading…" : `${events.length} ${queue === "pending" ? "awaiting review" : "published"}`}
      </p>

      <div className="mt-3 space-y-3">
        {events.map((e) => (
          <div key={e.id} className="rounded-blob border border-ink/10 bg-white p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-lg font-600 leading-tight">{e.title}</h3>
                <p className="text-sm text-ink/60">
                  📍 {e.venue || "—"} · {e.start ? new Date(e.start).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "no date"}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                  {e.neighborhood && <span className="rounded-full bg-grape/10 px-2 py-0.5 font-700 text-grape">{e.neighborhood}</span>}
                  {e.priceTier && <span className="rounded-full bg-sand px-2 py-0.5 font-700 text-ink/60">{e.priceTier}</span>}
                  {(e.ageTiers || []).map((a) => <span key={a} className="rounded-full bg-teal/10 px-2 py-0.5 font-700 text-teal-dark">{a}</span>)}
                  {e.source && <span className="rounded-full bg-sand px-2 py-0.5 font-700 text-ink/50">via {e.source}</span>}
                </div>
                {e.description && <p className="mt-2 line-clamp-2 text-sm text-ink/70">{e.description}</p>}
                {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-700 text-teal-dark hover:underline">source ↗</a>}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {queue === "pending" ? (
                <>
                  <button disabled={busy === e.id} onClick={() => act(e.id, "approve")}
                    className="rounded-full bg-teal px-4 py-2 text-sm font-800 text-white transition hover:bg-teal-dark disabled:opacity-50">
                    ✓ Approve
                  </button>
                  <button disabled={busy === e.id} onClick={() => act(e.id, "reject")}
                    className="rounded-full border-2 border-coral px-4 py-2 text-sm font-800 text-coral transition hover:bg-coral hover:text-white disabled:opacity-50">
                    ✕ Reject
                  </button>
                </>
              ) : (
                <button disabled={busy === e.id} onClick={() => act(e.id, "unapprove")}
                  className="rounded-full border-2 border-ink/20 px-4 py-2 text-sm font-800 text-ink/60 transition hover:border-coral hover:text-coral disabled:opacity-50">
                  Unpublish
                </button>
              )}
            </div>
          </div>
        ))}
        {!loading && events.length === 0 && (
          <div className="rounded-blob border border-dashed border-ink/20 bg-white py-16 text-center text-ink/50">
            <p className="text-2xl">🎉</p>
            <p className="mt-2 font-700">{queue === "pending" ? "Queue's all clear!" : "Nothing published yet."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
