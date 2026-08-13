import Image from "next/image";
import type { KidEvent } from "@/lib/types";
import { artTypeFor } from "@/lib/eventArt";

export function EventThumb({ event, priority = false }: { event: KidEvent; priority?: boolean }) {
  if (event.image) {
    return (
      <div className="relative h-28 w-full overflow-hidden bg-sand">
        <Image
          src={event.image}
          alt={event.venue ? `${event.title} — ${event.venue}` : event.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition group-hover:scale-105"
          // The first card on a collection/venue page can be the LCP element;
          // priority preloads it instead of lazy-loading the thing on screen.
          priority={priority}
          unoptimized={false}
        />
      </div>
    );
  }
  const v = artTypeFor(event.title, event.description);
  return (
    <div
      className={`flex h-28 w-full items-center justify-center bg-gradient-to-br ${v.gradient}`}
      aria-hidden
    >
      <span className="text-5xl drop-shadow-sm transition group-hover:scale-110">{v.emoji}</span>
    </div>
  );
}
