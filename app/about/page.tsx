export const metadata = {
  title: "About — Vegas Kiddos",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-4xl font-700 text-ink">
        About <span className="text-coral">Vegas</span>{" "}
        <span className="text-teal">Kiddos</span> 🌵
      </h1>
      <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink/80">
        <p>
          Vegas Kiddos is a free resource that helps Las Vegas parents find safe,
          age-appropriate events for their children — every day of the week.
        </p>
        <p>
          We pull events from local libraries, parks &amp; rec departments,
          children&apos;s museums, and trusted community submissions, then sort
          them by <strong>age</strong>, <strong>price</strong>, and{" "}
          <strong>neighborhood</strong> so you can find the right thing for your
          little one in seconds.
        </p>
        <h2 className="pt-2 font-display text-2xl font-600 text-ink">
          Where our events come from
        </h2>
        <ul className="list-inside list-disc space-y-1 text-base">
          <li>Las Vegas–Clark County Library District</li>
          <li>Henderson Libraries &amp; North Las Vegas Library</li>
          <li>City &amp; County Parks &amp; Recreation calendars</li>
          <li>DISCOVERY Children&apos;s Museum, Springs Preserve, and more</li>
          <li>Community submissions from parents &amp; local organizers</li>
        </ul>
        <h2 className="pt-2 font-display text-2xl font-600 text-ink">
          A note on safety
        </h2>
        <p className="text-base">
          We focus on family-friendly, kid-safe programming. Listings are
          aggregated from public sources — please always confirm the details with
          the venue before you go.
        </p>
      </div>
    </div>
  );
}
