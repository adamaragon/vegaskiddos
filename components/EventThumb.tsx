import Image from "next/image";
import type { KidEvent } from "@/lib/types";

// Picks a playful category visual (emoji + brand gradient) from the event text,
// used when the event has no real image of its own.
function visual(text: string): { emoji: string; gradient: string } {
  const t = text.toLowerCase();
  const map: [RegExp, string, string][] = [
    [/storytime|story time|story ?walk|\bread|\bbook/, "📚", "from-teal to-grape"],
    [/music|sing|concert|vocal|filharmonic|\bband\b|drum/, "🎵", "from-grape to-coral"],
    [/\bart\b|paint|craft|draw|create|messy|color/, "🎨", "from-coral to-sunny"],
    [/science|\bstem\b|lego|robot|coding|maker|experiment/, "🔬", "from-teal to-sunny"],
    [/dino|jurassic|fossil/, "🦕", "from-teal to-grape"],
    [/nature|garden|hike|trail|butterfly|\bfarm|preserve|outdoor/, "🌳", "from-teal to-sunny"],
    [/animal|\bzoo\b|reptile|petting|touch tank|aquarium|shark|bug/, "🦁", "from-sunny to-coral"],
    [/swim|splash|\bpool\b|water play/, "🏊", "from-teal to-grape"],
    [/dance|ballet|zumbini|movement|ballroom/, "💃", "from-coral to-grape"],
    [/puppet|theat|magic|circus|stage|drama/, "🎭", "from-grape to-coral"],
    [/farmers market|\bmarket\b|vendor/, "🧺", "from-sunny to-teal"],
    [/festival|parade|\bfair\b|celebration|carnival|fiesta/, "🎉", "from-coral to-sunny"],
    [/baby|toddler|infant|mommy|little ones|lapsit/, "🧸", "from-sunny to-coral"],
    [/teen|tween|gaming|\bgame|esport|anime/, "🎮", "from-grape to-teal"],
    [/scavenger|\bhunt\b|explore|adventure|quest/, "🔍", "from-teal to-sunny"],
    [/chess|board game|puzzle/, "♟️", "from-grape to-teal"],
    [/cook|baking|food|eat|snack/, "🍪", "from-sunny to-coral"],
  ];
  for (const [re, emoji, gradient] of map) if (re.test(t)) return { emoji, gradient };
  return { emoji: "🎈", gradient: "from-coral to-sunny" };
}

export function EventThumb({ event }: { event: KidEvent }) {
  if (event.image) {
    return (
      <div className="relative h-28 w-full overflow-hidden bg-sand">
        <Image
          src={event.image}
          alt={event.venue ? `${event.title} — ${event.venue}` : event.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition group-hover:scale-105"
          unoptimized={false}
        />
      </div>
    );
  }
  const v = visual(`${event.title} ${event.description}`);
  return (
    <div
      className={`flex h-28 w-full items-center justify-center bg-gradient-to-br ${v.gradient}`}
      aria-hidden
    >
      <span className="text-5xl drop-shadow-sm transition group-hover:scale-110">{v.emoji}</span>
    </div>
  );
}
