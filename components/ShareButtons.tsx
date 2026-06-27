"use client";

import { useState } from "react";
import { track } from "@/lib/track";

// Share UI: uses the native Web Share sheet on mobile, with a copy-link +
// social fallback everywhere else.
export function ShareButtons({
  url,
  title,
  text,
  compact = false,
}: {
  url: string;
  title: string;
  text?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const shareText = text || title;

  async function nativeShare() {
    track("Share", { method: "native" });
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url });
      } catch {
        /* user cancelled */
      }
    } else {
      copyLink();
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  const links = [
    { label: "Facebook", emoji: "📘", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: "X", emoji: "✖️", href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(shareText)}` },
    { label: "WhatsApp", emoji: "💬", href: `https://wa.me/?text=${enc(shareText + " " + url)}` },
    { label: "Email", emoji: "✉️", href: `mailto:?subject=${enc(title)}&body=${enc(shareText + "\n\n" + url)}` },
  ];

  if (compact) {
    return (
      <button onClick={nativeShare} aria-label="Share"
        className="hover-pop inline-flex items-center gap-1.5 rounded-full border-2 border-ink/15 bg-white px-3 py-1.5 text-sm font-700 text-ink/70 transition hover:border-teal">
        {copied ? "✓ Copied" : "↗ Share"}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={nativeShare}
        className="hover-pop inline-flex items-center gap-1.5 rounded-full bg-teal-btn px-4 py-2 text-sm font-800 text-white shadow-pop">
        ↗ Share
      </button>
      <button onClick={copyLink}
        className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink/15 bg-white px-4 py-2 text-sm font-700 text-ink/70 transition hover:border-teal">
        {copied ? "✓ Link copied!" : "🔗 Copy link"}
      </button>
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
          onClick={() => track("Share", { method: l.label })}
          aria-label={`Share on ${l.label}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink/15 bg-white text-base transition-colors hover:border-teal">
          {l.emoji}
        </a>
      ))}
    </div>
  );
}
