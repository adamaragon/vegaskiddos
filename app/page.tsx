import { getEvents } from "@/lib/data";
import { EventBrowser } from "@/components/EventBrowser";

export const revalidate = 600;

export default async function HomePage() {
  const events = await getEvents();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-blob bg-gradient-to-br from-coral via-coral to-sunny p-8 text-white shadow-card sm:p-12">
        <div className="absolute -right-8 -top-8 text-[8rem] opacity-20">🎈</div>
        <h1 className="font-display text-4xl font-700 leading-tight sm:text-5xl">
          Kid-safe fun, all over Las Vegas.
        </h1>
        <p className="mt-3 max-w-xl text-lg text-white/90">
          Find the right event for the right little human — sorted by age, price,
          and neighborhood. Made by a local parent, for local parents.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-sm font-700">
          <span className="rounded-full bg-white/20 px-3 py-1.5">👶 Baby</span>
          <span className="rounded-full bg-white/20 px-3 py-1.5">🧸 Toddler</span>
          <span className="rounded-full bg-white/20 px-3 py-1.5">🎨 Kids</span>
          <span className="rounded-full bg-white/20 px-3 py-1.5">🛹 Tweens</span>
        </div>
      </section>

      {/* Browser */}
      <section className="mt-8">
        <EventBrowser events={events} />
      </section>
    </div>
  );
}
