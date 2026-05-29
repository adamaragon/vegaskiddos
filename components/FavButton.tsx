"use client";

import { useEffect, useState } from "react";
import { isFavorite, toggleFavorite } from "@/lib/favorites";

// Heart toggle. Sits inside the card <Link>, so it stops the click from
// navigating. Syncs across the app via the "vk-prefs" event.
export function FavButton({ id, className = "" }: { id: string; className?: string }) {
  const [fav, setFav] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sync = () => setFav(isFavorite(id));
    sync();
    window.addEventListener("vk-prefs", sync);
    return () => window.removeEventListener("vk-prefs", sync);
  }, [id]);

  if (!mounted) return null;

  return (
    <button
      type="button"
      aria-label={fav ? "Remove from My List" : "Save to My List"}
      title={fav ? "Saved" : "Save to My List"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setFav(toggleFavorite(id));
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg shadow-pop backdrop-blur transition hover:scale-110 ${className}`}
    >
      <span className={fav ? "" : "grayscale"}>{fav ? "❤️" : "🤍"}</span>
    </button>
  );
}
