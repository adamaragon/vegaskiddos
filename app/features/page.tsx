"use client";

import { useEffect, useState } from "react";
import { Star, Arrow } from "@/components/Doodles";
import type { FeatureDTO } from "@/app/api/features/route";

const STATUS_STYLE: Record<string, string> = {
  idea: "bg-sand text-ink/60",
  planned: "bg-sunny/30 text-sunny-dark",
  building: "bg-teal/20 text-teal-dark",
  shipped: "bg-teal text-white",
};

function loadVoted(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("vk_votes") || "{}"); } catch { return {}; }
}

export default function FeaturesPage() {
  const [features, setFeatures] = useState<FeatureDTO[]>([]);
  const [voted, setVoted] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setVoted(loadVoted());
    fetch("/api/features").then((r) => r.json()).then((d) => {
      setFeatures(d.features || []);
      setLoading(false);
    });
  }, []);

  async function vote(id: string, dir: 1 | -1) {
    const prev = voted[id] || 0;
    // toggle: clicking same direction removes the vote
    const newDir = prev === dir ? 0 : dir;
    const delta = newDir - prev;
    if (delta === 0) return;

    setFeatures((fs) => fs.map((f) => f.id === id ? { ...f, votes: Math.max(0, f.votes + delta) } : f));
    const nextVoted = { ...voted, [id]: newDir };
    setVoted(nextVoted);
    localStorage.setItem("vk_votes", JSON.stringify(nextVoted));

    await fetch("/api/features/vote", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, dir: delta }),
    }).catch(() => {});
  }

  async function submitIdea(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const res = await fetch("/api/features", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const { id } = await res.json();
      setFeatures((fs) => [{ id, title: String(data.title), description: String(data.description || ""), votes: 1, status: "idea", featured: false }, ...fs]);
      form.reset();
      setShowForm(false);
    }
    setSubmitting(false);
  }

  return (
    <div className="relative mx-auto max-w-2xl px-4 py-10">
      <Star className="pointer-events-none absolute -right-4 top-8 h-16 w-16 animate-bob opacity-70" />
      <h1 className="font-display text-4xl font-700 sm:text-5xl">Help shape Vegas Kiddos</h1>
      <p className="mt-3 text-lg text-ink/70">
        Vote on what we build next — or pitch your own idea. The most-loved ideas
        jump to the top of our list.
      </p>

      <button onClick={() => setShowForm((s) => !s)}
        className="hover-pop mt-5 inline-flex items-center gap-2 rounded-full bg-coral px-5 py-3 font-800 text-white shadow-pop">
        💡 Suggest an idea
      </button>

      {showForm && (
        <form onSubmit={submitIdea} className="mt-4 space-y-3 rounded-blob border border-ink/10 bg-white p-5 shadow-card">
          <input name="title" required placeholder="Your idea in a sentence"
            className="w-full rounded-2xl border-2 border-ink/15 px-4 py-3 outline-none focus:border-teal" />
          <textarea name="description" rows={2} placeholder="Any details? (optional)"
            className="w-full rounded-2xl border-2 border-ink/15 px-4 py-3 outline-none focus:border-teal" />
          <button type="submit" disabled={submitting}
            className="rounded-full bg-teal px-5 py-2.5 font-800 text-white disabled:opacity-50">
            {submitting ? "Adding…" : "Add my idea"}
          </button>
        </form>
      )}

      <div className="mt-8 space-y-3">
        {loading ? (
          <p className="text-ink/40">Loading ideas…</p>
        ) : features.length === 0 ? (
          <p className="text-ink/40">No ideas yet — be the first!</p>
        ) : (
          features.map((f) => {
            const myVote = voted[f.id] || 0;
            return (
              <div key={f.id}
                className={`flex items-center gap-4 rounded-blob border bg-white p-4 shadow-card transition ${f.featured ? "border-sunny" : "border-ink/10"}`}>
                <div className="flex flex-col items-center">
                  <button aria-label="Upvote" onClick={() => vote(f.id, 1)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-lg transition hover:scale-110 ${myVote === 1 ? "border-teal bg-teal text-white" : "border-ink/15 text-ink/50"}`}>
                    ▲
                  </button>
                  <span className="my-1 font-display text-xl font-700 tabular-nums">{f.votes}</span>
                  <button aria-label="Downvote" onClick={() => vote(f.id, -1)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-lg transition hover:scale-110 ${myVote === -1 ? "border-coral bg-coral text-white" : "border-ink/15 text-ink/50"}`}>
                    ▼
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-600">{f.title}</h3>
                    {f.featured && <span className="text-sunny">⭐</span>}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-800 capitalize ${STATUS_STYLE[f.status] || STATUS_STYLE.idea}`}>
                      {f.status}
                    </span>
                  </div>
                  {f.description && <p className="mt-0.5 text-sm text-ink/70">{f.description}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-10 flex items-center justify-center gap-2 text-ink/40">
        <Arrow className="h-8 w-12" />
        <span className="text-sm">Your vote really does steer the roadmap.</span>
      </div>
    </div>
  );
}
