"use client";

import { useCallback, useEffect, useState } from "react";

interface AdminEvent {
  id: string; title: string; venue: string; start: string;
  neighborhood: string; priceTier: string; ageTiers: string[];
  source: string; url: string; description: string;
}

interface SubStats {
  total: number;
  inactive: number;
  newThisWeek: number;
  newThisMonth: number;
  byNeighborhood: Record<string, number>;
  byLang: Record<string, number>;
  recent: { email: string; neighborhood: string; lang: string; subscribedAt: string }[];
}

type Tab = "pending" | "approved" | "rejected" | "subscribers";

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [queue, setQueue] = useState<Tab>("pending");
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState("");
  const [subStats, setSubStats] = useState<SubStats | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");

  const load = useCallback(async (q: "pending" | "approved" | "rejected") => {
    setLoading(true);
    const res = await fetch(`/api/admin/events?queue=${q}`);
    if (res.status === 401) { setAuthed(false); setLoading(false); return; }
    const data = await res.json();
    setAuthed(true);
    setEvents(data.events || []);
    setLoading(false);
  }, []);

  const loadSubs = useCallback(async () => {
    setSubLoading(true);
    const res = await fetch("/api/admin/subscribers");
    if (res.status === 401) { setAuthed(false); setSubLoading(false); return; }
    setAuthed(true);
    setSubStats(await res.json());
    setSubLoading(false);
  }, []);

  useEffect(() => {
    if (queue === "subscribers") loadSubs();
    else load(queue);
  }, [queue, load, loadSubs]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/admin/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pw }),
    });
    if (res.ok) { setPw(""); if (queue === "subscribers") loadSubs(); else load(queue); }
    else setErr("Wrong email or password.");
  }

  async function runScrape() {
    setScraping(true);
    setScrapeMsg("");
    try {
      const res = await fetch("/api/admin/scrape", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "failed");
      setScrapeMsg(`Scanned ${d.totalFound} events (${d.recurringSeries ?? 0} recurring) · ${d.inserted} new in queue · ${d.updated ?? 0} refreshed.`);
      if (queue === "pending") load("pending");
    } catch (e) {
      setScrapeMsg(`Scrape failed: ${(e as Error).message}`);
    }
    setScraping(false);
  }

  async function sendStatsEmail() {
    setEmailSending(true);
    setEmailMsg("");
    try {
      const res = await fetch("/api/admin/subscribers", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "failed");
      setEmailMsg("Sent ✓");
    } catch (e) {
      setEmailMsg(`Failed: ${(e as Error).message}`);
    }
    setEmailSending(false);
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
    return <div className="mx-auto max-w-lg px-4 py-20 text-center text-ink/70">Loading…</div>;
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm px-4 py-20">
        <div className="rounded-blob border border-ink/10 bg-white p-8 shadow-card text-center">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-3 font-display text-2xl font-700">Admin sign-in</h1>
          <p className="mt-1 text-sm text-ink/70">For the Vegas Kiddos team only.</p>
          <form onSubmit={login} className="mt-6 space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email" autoFocus autoComplete="username"
              className="w-full rounded-2xl border-2 border-ink/15 px-4 py-3 text-center outline-none focus:border-teal" />
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
              placeholder="Password" autoComplete="current-password"
              className="w-full rounded-2xl border-2 border-ink/15 px-4 py-3 text-center outline-none focus:border-teal" />
            {err && <p className="text-sm font-700 text-coral-btn">{err}</p>}
            <button type="submit"
              className="hover-pop w-full rounded-full bg-coral-btn px-5 py-3 font-800 text-white shadow-pop">
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
          <button onClick={logout} className="text-sm font-700 text-ink/70 hover:text-coral">Sign out</button>
        </div>
      </div>
      {scrapeMsg && (
        <p className="mt-3 rounded-2xl bg-grape/10 px-4 py-2 text-sm font-700 text-grape-dark">{scrapeMsg}</p>
      )}

      <div className="mt-4 flex rounded-full border-2 border-ink/15 bg-white p-1">
        {(["pending", "approved", "rejected", "subscribers"] as const).map((q) => (
          <button key={q} onClick={() => setQueue(q)}
            className={`flex-1 rounded-full px-2 py-2 text-sm font-800 transition ${queue === q ? "bg-teal-btn text-white" : "text-ink/70"}`}>
            {q === "pending" ? "📥 Review" : q === "approved" ? "✅ Live" : q === "rejected" ? "🗑️ Removed" : "👥 Subs"}
          </button>
        ))}
      </div>

      {queue === "subscribers" ? (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-700 text-ink/70">
              {subLoading ? "Loading…" : subStats
                ? `${subStats.total} active · ${subStats.inactive} unsubscribed`
                : ""}
            </p>
            <div className="flex items-center gap-3">
              {emailMsg && (
                <span className={`text-sm font-700 ${emailMsg.startsWith("Failed") ? "text-coral-btn" : "text-teal-btn"}`}>
                  {emailMsg}
                </span>
              )}
              <button onClick={sendStatsEmail} disabled={emailSending || subLoading || !subStats}
                className="hover-pop rounded-full bg-grape px-4 py-2 text-sm font-800 text-white shadow-pop disabled:opacity-50">
                {emailSending ? "Sending…" : "📧 Email me stats"}
              </button>
            </div>
          </div>

          {subStats && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Active", value: subStats.total, color: "text-teal-btn" },
                  { label: "This week", value: subStats.newThisWeek, color: "text-coral-btn" },
                  { label: "This month", value: subStats.newThisMonth, color: "text-grape" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-blob border border-ink/10 bg-white p-4 text-center shadow-card">
                    <div className={`font-display text-4xl font-800 ${color}`}>{value}</div>
                    <div className="mt-1 text-xs font-700 text-ink/60">{label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-blob border border-ink/10 bg-white p-4 shadow-card">
                  <h3 className="mb-3 text-xs font-700 text-ink/50 uppercase tracking-wider">By neighborhood</h3>
                  <div className="space-y-2">
                    {Object.entries(subStats.byNeighborhood)
                      .sort((a, b) => b[1] - a[1])
                      .map(([hood, count]) => (
                        <div key={hood} className="flex items-center justify-between text-sm">
                          <span className="capitalize text-ink/80">{hood || "any"}</span>
                          <span className="font-800 text-teal-btn">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
                <div className="rounded-blob border border-ink/10 bg-white p-4 shadow-card">
                  <h3 className="mb-3 text-xs font-700 text-ink/50 uppercase tracking-wider">Language</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>🇺🇸 English</span>
                      <span className="font-800 text-teal-btn">{subStats.byLang.en || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>🇲🇽 Spanish</span>
                      <span className="font-800 text-teal-btn">{subStats.byLang.es || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-blob border border-ink/10 bg-white shadow-card overflow-hidden">
                <div className="px-4 py-3 border-b border-ink/10">
                  <h3 className="text-xs font-700 text-ink/50 uppercase tracking-wider">Recent signups</h3>
                </div>
                <div className="divide-y divide-ink/5">
                  {subStats.recent.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className="flex-1 truncate font-600 text-ink">{s.email}</span>
                      <span className="text-xs text-ink/50 capitalize hidden sm:inline">{s.neighborhood || "any"}</span>
                      <span className="text-xs font-800 text-grape shrink-0">{s.lang.toUpperCase()}</span>
                      <span className="text-xs text-ink/40 shrink-0">
                        {s.subscribedAt
                          ? new Date(s.subscribedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" })
                          : "—"}
                      </span>
                    </div>
                  ))}
                  {subStats.recent.length === 0 && (
                    <p className="px-4 py-8 text-center text-sm text-ink/50">No subscribers yet.</p>
                  )}
                </div>
              </div>
            </>
          )}

          {!subStats && !subLoading && (
            <div className="rounded-blob border border-dashed border-ink/20 bg-white py-16 text-center text-ink/70">
              <p className="text-2xl">📊</p>
              <p className="mt-2 font-700">Could not load subscriber data.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm font-700 text-ink/70">
            {loading ? "Loading…" : `${events.length} ${queue === "pending" ? "awaiting review" : queue === "approved" ? "published" : "removed"}`}
          </p>

          <div className="mt-3 space-y-3">
            {events.map((e) => (
              <div key={e.id} className="rounded-blob border border-ink/10 bg-white p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-600 leading-tight">{e.title}</h3>
                    <p className="text-sm text-ink/70">
                      📍 {e.venue || "—"} · {e.start ? new Date(e.start).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "no date"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                      {e.neighborhood && <span className="rounded-full bg-grape/10 px-2 py-0.5 font-700 text-grape-dark">{e.neighborhood}</span>}
                      {e.priceTier && <span className="rounded-full bg-sand px-2 py-0.5 font-700 text-ink/80">{e.priceTier}</span>}
                      {(e.ageTiers || []).map((a) => <span key={a} className="rounded-full bg-teal/10 px-2 py-0.5 font-700 text-ink/80">{a}</span>)}
                      {e.source && <span className="rounded-full bg-sand px-2 py-0.5 font-700 text-ink/80">via {e.source}</span>}
                    </div>
                    {e.description && <p className="mt-2 line-clamp-2 text-sm text-ink/70">{e.description}</p>}
                    {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-700 text-teal-btn hover:underline">source ↗</a>}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {queue === "pending" ? (
                    <>
                      <button disabled={busy === e.id} onClick={() => act(e.id, "approve")}
                        className="rounded-full bg-teal-btn px-4 py-2 text-sm font-800 text-white transition hover:bg-teal-dark disabled:opacity-50">
                        ✓ Approve
                      </button>
                      <button disabled={busy === e.id} onClick={() => act(e.id, "reject")}
                        className="rounded-full border-2 border-coral px-4 py-2 text-sm font-800 text-coral-btn transition hover:bg-coral-btn hover:text-white disabled:opacity-50">
                        ✕ Reject
                      </button>
                    </>
                  ) : queue === "approved" ? (
                    <>
                      <button disabled={busy === e.id} onClick={() => act(e.id, "reject")}
                        className="rounded-full bg-coral-btn px-4 py-2 text-sm font-800 text-white transition hover:bg-coral-dark disabled:opacity-50">
                        🗑️ Remove
                      </button>
                      <button disabled={busy === e.id} onClick={() => act(e.id, "unapprove")}
                        className="rounded-full border-2 border-ink/20 px-4 py-2 text-sm font-800 text-ink/70 transition hover:border-grape hover:text-grape disabled:opacity-50">
                        Unpublish (to review)
                      </button>
                    </>
                  ) : (
                    <button disabled={busy === e.id} onClick={() => act(e.id, "approve")}
                      className="rounded-full bg-teal-btn px-4 py-2 text-sm font-800 text-white transition hover:bg-teal-dark disabled:opacity-50">
                      ♻️ Restore (republish)
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!loading && events.length === 0 && (
              <div className="rounded-blob border border-dashed border-ink/20 bg-white py-16 text-center text-ink/70">
                <p className="text-2xl">🎉</p>
                <p className="mt-2 font-700">{queue === "pending" ? "Queue's all clear!" : queue === "approved" ? "Nothing published yet." : "Nothing removed."}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
