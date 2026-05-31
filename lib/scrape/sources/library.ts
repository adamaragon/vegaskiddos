// Source adapter: Las Vegas–Clark County Library District (LVCCLD).
// Runs Communico "Attend" (see ./communico) — pulls the metro family branches
// and keeps only kid-relevant programming (storytimes, kids/teen events). All
// library events are free.

import { makeCommunicoAdapter, type CommunicoBranch } from "./communico";

// Metro family branches (id -> neighborhood). Verified from /v1/lvccld/locations.
const BRANCHES: CommunicoBranch[] = [
  { id: "166", name: "Windmill Library", hood: "enterprise" },
  { id: "155", name: "Enterprise Library", hood: "enterprise" },
  { id: "160", name: "Spring Valley Library", hood: "spring-valley" },
  { id: "159", name: "Sahara West Library", hood: "spring-valley" },
  { id: "158", name: "Rainbow Library", hood: "spring-valley" },
  { id: "161", name: "Summerlin Library", hood: "summerlin" },
  { id: "153", name: "Centennial Hills Library", hood: "summerlin" },
  { id: "163", name: "West Charleston Library", hood: "downtown" },
  { id: "154", name: "Clark County Library", hood: "spring-valley" },
  { id: "165", name: "Whitney Library", hood: "henderson" },
  { id: "2031", name: "Sunrise Library", hood: "downtown" },
];

export const fetchLibrary = makeCommunicoAdapter({
  source: "Library",
  feedUrl: "https://events.thelibrarydistrict.org/feeds",
  branches: BRANCHES,
});
