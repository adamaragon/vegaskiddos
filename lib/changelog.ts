// Project changelog. Newest first. Update this as we ship — each entry shows
// up on /changelog automatically.

export type ChangeTag = "Launch" | "Feature" | "Design" | "Data" | "Fix";

export interface ChangeEntry {
  date: string; // YYYY-MM-DD
  title: string;
  tag: ChangeTag;
  items: string[];
}

export const CHANGELOG: ChangeEntry[] = [
  {
    date: "2026-05-28",
    title: "A big splash of fun",
    tag: "Design",
    items: [
      "Added playful animations, scroll reveals, and crayon-style artwork all over the site.",
      "New pages: Style Guide, Changelog, Feature Voting, and Contact.",
      "Built an in-app admin so we can approve events without leaving the browser.",
      "Footer now credits the whole Vegas Kiddos family.",
    ],
  },
  {
    date: "2026-05-24",
    title: "Events that find themselves",
    tag: "Data",
    items: [
      "Launched an automated event collector that checks local sources every day.",
      "Everything new lands in a review queue so a human approves it before it goes live.",
      "Smart sorting guesses age range, price, and neighborhood for each event.",
    ],
  },
  {
    date: "2026-05-20",
    title: "Spring Valley, meet Enterprise",
    tag: "Feature",
    items: [
      "Split the southwest valley into Spring Valley and Enterprise as separate areas.",
      "Six neighborhoods now: Summerlin, Henderson, North LV, Spring Valley, Enterprise, Downtown.",
    ],
  },
  {
    date: "2026-05-16",
    title: "Live on vegaskiddos.com",
    tag: "Launch",
    items: [
      "Custom domain is live with a secure padlock.",
      "Every update now publishes itself automatically.",
    ],
  },
  {
    date: "2026-05-12",
    title: "A real database",
    tag: "Data",
    items: [
      "Events now live in a proper database that's easy to manage.",
      "Community submissions flow into a review queue.",
    ],
  },
  {
    date: "2026-05-06",
    title: "Put it on the map",
    tag: "Feature",
    items: [
      "Added a map view with color-coded pins by price.",
      "Toggle between list and map any time.",
    ],
  },
  {
    date: "2026-05-01",
    title: "Filter to your family",
    tag: "Feature",
    items: [
      "Filter events by age (Baby, Toddler, Kids, Tweens).",
      "Filter by price tier — Free, $1–10, $11–25, $25+.",
      "Filter by neighborhood.",
    ],
  },
  {
    date: "2026-04-27",
    title: "Hello, Vegas Kiddos",
    tag: "Launch",
    items: [
      "First version of the site: browse kid-safe Las Vegas events as cards.",
      "Community event submission form.",
      "Bright, playful brand and our cactus mascot.",
    ],
  },
];
