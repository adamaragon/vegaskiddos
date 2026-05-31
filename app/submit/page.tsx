"use client";

import { useState } from "react";
import { AGE_TIERS, PRICE_TIERS, NEIGHBORHOODS } from "@/lib/constants";

export default function SubmitPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle"
  );
  const [ages, setAges] = useState<string[]>([]);

  function toggleAge(id: string) {
    setAges((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    // Turn the "repeats" choice into a recurrence label.
    const WD = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
    let recurrence = "";
    if (data.repeats === "weekly" && data.start) {
      recurrence = `Weekly on ${WD[new Date(String(data.start)).getDay()]}`;
    } else if (data.repeats === "daily") {
      recurrence = "Daily";
    } else if (data.repeats === "monthly") {
      recurrence = "Monthly";
    }
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, ageTiers: ages, recurrence }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
      form.reset();
      setAges([]);
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-5xl">🎉</p>
        <h1 className="mt-4 font-display text-3xl font-700">Thank you!</h1>
        <p className="mt-2 text-ink/70">
          Your event was submitted for review. Once it&apos;s approved it&apos;ll
          show up for families across Las Vegas.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-6 rounded-full bg-coral-btn px-5 py-3 font-800 text-white shadow-pop hover:bg-coral-dark"
        >
          Submit another
        </button>
      </div>
    );
  }

  const field =
    "w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 font-body text-ink outline-none transition focus:border-teal";

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-4xl font-700 text-ink">Add an event</h1>
      <p className="mt-2 text-ink/70">
        Know a great kid-friendly event? Share it! We review every submission
        before it goes live.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <Labeled label="Event title *">
          <input name="title" required className={field} placeholder="Toddler Storytime" />
        </Labeled>

        <Labeled label="Description *">
          <textarea
            name="description"
            required
            rows={3}
            className={field}
            placeholder="What happens at the event? What should families expect?"
          />
        </Labeled>

        <div className="grid gap-5 sm:grid-cols-2">
          <Labeled label="Venue / location *">
            <input name="venue" required className={field} placeholder="Summerlin Library" />
          </Labeled>
          <Labeled label="Address">
            <input name="address" className={field} placeholder="1771 Inner Circle Dr" />
          </Labeled>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Labeled label="Date & time *">
            <input name="start" type="datetime-local" required className={field} />
          </Labeled>
          <Labeled label="Does it repeat?">
            <select name="repeats" className={field} defaultValue="once">
              <option value="once">One-time event</option>
              <option value="weekly">Every week (same day)</option>
              <option value="daily">Every day</option>
              <option value="monthly">Every month</option>
            </select>
          </Labeled>
        </div>

        <Labeled label="Neighborhood *">
          <select name="neighborhood" required className={field} defaultValue="">
            <option value="" disabled>
              Choose an area…
            </option>
            {NEIGHBORHOODS.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </Labeled>

        <Labeled label="Who is it for? *">
          <div className="flex flex-wrap gap-2">
            {AGE_TIERS.map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() => toggleAge(a.id)}
                className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-700 transition ${
                  ages.includes(a.id)
                    ? "border-teal bg-teal-btn text-white"
                    : "border-ink/15 bg-white text-ink/70"
                }`}
              >
                {a.emoji} {a.label}
              </button>
            ))}
          </div>
        </Labeled>

        <div className="grid gap-5 sm:grid-cols-2">
          <Labeled label="Price *">
            <select name="priceTier" required className={field} defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {PRICE_TIERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Link (RSVP / details)">
            <input name="url" type="url" className={field} placeholder="https://…" />
          </Labeled>
        </div>

        <Labeled label="Your email (so we can follow up)">
          <input name="submitterEmail" type="email" className={field} placeholder="you@email.com" />
        </Labeled>

        {status === "error" && (
          <p className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-700 text-coral-dark">
            Something went wrong. Please try again.
          </p>
        )}

        <button
          type="submit"
          disabled={status === "sending" || ages.length === 0}
          className="w-full rounded-full bg-coral-btn px-5 py-4 font-800 text-white shadow-pop transition hover:bg-coral-dark disabled:opacity-50"
        >
          {status === "sending" ? "Submitting…" : "Submit for review"}
        </button>
        {ages.length === 0 && (
          <p className="text-center text-xs text-ink/50">
            Pick at least one age group above.
          </p>
        )}
      </form>
    </div>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-700 text-sm text-ink/70">{label}</span>
      {children}
    </label>
  );
}
