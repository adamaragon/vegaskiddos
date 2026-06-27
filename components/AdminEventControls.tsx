"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Renders nothing for normal visitors. For a logged-in admin it shows an
// admin bar on the live event page with Remove / Unpublish controls.
export function AdminEventControls({ id }: { id: string }) {
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>("");

  useEffect(() => {
    // Skip the /api/admin/me probe entirely for anonymous visitors. The login
    // route drops a non-httpOnly `vk_admin_present` cookie; without it there is
    // no admin session, so every public event view avoids a serverless hit.
    // The probe still runs (and is server-validated) when the hint is present.
    if (!/(?:^|;\s*)vk_admin_present=1(?:;|$)/.test(document.cookie)) return;
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((d) => setAdmin(Boolean(d.authed)))
      .catch(() => {});
  }, []);

  if (!admin) return null;

  async function act(action: "reject" | "unapprove", label: string) {
    if (action === "reject" && !confirm("Remove this event from the site? (You can restore it in the admin panel.)")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    setDone(res.ok ? label : "Something went wrong");
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-blob border-2 border-grape/40 bg-grape/10 px-4 py-3">
      <span className="font-display text-sm font-700 text-grape-dark">🛠️ Admin</span>
      {done ? (
        <span className="flex items-center gap-3 text-sm font-700 text-ink/70">
          ✓ {done}.
          <Link href="/" className="text-coral-btn underline">Back to events</Link>
          <Link href="/admin" className="text-teal-btn underline">Admin panel</Link>
        </span>
      ) : (
        <>
          <button disabled={busy} onClick={() => act("reject", "Removed from the site")}
            className="rounded-full bg-coral-btn px-4 py-1.5 text-sm font-800 text-white transition hover:bg-coral-btnHover disabled:opacity-50">
            🗑️ Remove event
          </button>
          <button disabled={busy} onClick={() => act("unapprove", "Unpublished (moved to review queue)")}
            className="rounded-full border-2 border-ink/20 px-4 py-1.5 text-sm font-800 text-ink/70 transition hover:border-grape hover:text-grape disabled:opacity-50">
            Unpublish
          </button>
          <Link href="/admin" className="ml-auto text-sm font-700 text-teal-btn hover:underline">Open admin panel →</Link>
        </>
      )}
    </div>
  );
}
