"use client";

import { useEffect, useState } from "react";
import { Star, Arrow } from "@/components/Doodles";
import type { FeatureDTO } from "@/app/api/features/route";
import { useLang } from "@/lib/lang-client";
import { t, type StringKey } from "@/lib/i18n";

const STATUS_STYLE: Record<string, string> = {
  idea: "bg-sand text-ink/80",
  planned: "bg-sunny/30 text-ink/80",
  building: "bg-teal/20 text-ink/80",
  shipped: "bg-teal-btn text-white",
};
const STATUS_KEY: Record<string, StringKey> = {
  idea: "ft_status_idea",
  planned: "ft_status_planned",
  building: "ft_status_building",
  shipped: "ft_status_shipped",
};

function loadVoted(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("vk_votes") || "{}"); } catch { return {}; }
}

export default function FeaturesPage() {
  const lang = useLang();
  const tr = (k: StringKey) => t(lang, k);
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

  const shipped = features.filter((f) => f.status === "shipped");
  const active = features.filter((f) => f.status !== "shipped");

  return (
    <div className="relative mx-auto max-w-2xl px-4 py-10">
      <Star className="pointer-events-none absolute -right-4 top-8 h-16 w-16 animate-bob opacity-70" />
      <h1 className="font-display text-4xl font-700 sm:text-5xl">{tr("ft_h")}</h1>
      <p className="mt-3 text-lg text-ink/70">{tr("ft_intro")}</p>

      <button onClick={() => setShowForm((s) => !s)}
        className="hover-pop mt-5 inline-flex items-center gap-2 rounded-full bg-coral-btn px-5 py-3 font-800 text-white shadow-pop">
        {tr("ft_suggest")}
      </button>

      {showForm && (
        <form onSubmit={submitIdea} className="mt-4 space-y-3 rounded-blob border border-ink/10 bg-white p-5 shadow-card">
          <input name="title" required placeholder={tr("ft_idea_title_ph")}
            className="w-full rounded-2xl border-2 border-ink/15 px-4 py-3 outline-none focus:border-teal" />
          <textarea name="description" rows={2} placeholder={tr("ft_idea_desc_ph")}
            className="w-full rounded-2xl border-2 border-ink/15 px-4 py-3 outline-none focus:border-teal" />
          <button type="submit" disabled={submitting}
            className="rounded-full bg-teal-btn px-5 py-2.5 font-800 text-white disabled:opacity-50">
            {submitting ? tr("ft_adding") : tr("ft_add")}
          </button>
        </form>
      )}

      <div className="mt-8 space-y-3">
        {loading ? (
          <p className="text-ink/70">{tr("ft_loading")}</p>
        ) : active.length === 0 ? (
          <p className="text-ink/70">{tr("ft_empty")}</p>
        ) : (
          active.map((f) => {
            const myVote = voted[f.id] || 0;
            return (
              <div key={f.id}
                className={`flex items-center gap-4 rounded-blob border bg-white p-4 shadow-card transition ${f.featured ? "border-sunny" : "border-ink/10"}`}>
                <div className="flex flex-col items-center">
                  <button aria-label="Upvote" aria-pressed={myVote === 1} onClick={() => vote(f.id, 1)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-lg transition-transform hover:scale-105 ${myVote === 1 ? "border-teal bg-teal-btn text-white" : "border-ink/15 text-ink/70"}`}>
                    ▲
                  </button>
                  <span className="my-1 font-display text-xl font-700 tabular-nums">{f.votes}</span>
                  <button aria-label="Downvote" aria-pressed={myVote === -1} onClick={() => vote(f.id, -1)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-lg transition-transform hover:scale-105 ${myVote === -1 ? "border-coral bg-coral-btn text-white" : "border-ink/15 text-ink/70"}`}>
                    ▼
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-600">{f.title}</h3>
                    {f.featured && <span className="text-sunny">⭐</span>}
                    <span className={`rounded-full px-2 py-1 text-xs font-800 capitalize ${STATUS_STYLE[f.status] || STATUS_STYLE.idea}`}>
                      {tr(STATUS_KEY[f.status] || "ft_status_idea")}
                    </span>
                  </div>
                  {f.description && <p className="mt-0.5 text-sm text-ink/70">{f.description}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {shipped.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-700 sm:text-3xl">{tr("ft_shipped_h")}</h2>
          <p className="mt-1 text-sm text-ink/70">{tr("ft_shipped_intro")}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {shipped.map((f) => (
              <div key={f.id}
                className="rounded-blob border border-teal/30 bg-gradient-to-br from-teal/5 to-sunny/10 p-4 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-teal-btn px-2.5 py-1 text-xs font-800 text-white">
                    ✓ {tr("ft_success_badge")}
                  </span>
                  <span className="font-display text-sm font-700 text-teal-btn tabular-nums">
                    {f.votes} ▲
                  </span>
                </div>
                <h3 className="mt-2 font-display text-lg font-600 leading-tight">{f.title}</h3>
                {f.description && <p className="mt-1 text-sm text-ink/70">{f.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10 flex items-center justify-center gap-2 text-ink/70">
        <Arrow className="h-8 w-12" />
        <span className="text-sm">{tr("ft_footer")}</span>
      </div>
    </div>
  );
}
