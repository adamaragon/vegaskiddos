// Boulder City Library — Communico Attend at bclibrary.libnet.info.
// Separate district from LVCCLD and Henderson. One physical branch.

import { makeCommunicoAdapter, type CommunicoBranch } from "./communico";

const BRANCHES: CommunicoBranch[] = [
  { id: "3096", name: "Boulder City Library", hood: "henderson" },
];

export const fetchBoulderCityLibrary = makeCommunicoAdapter({
  source: "Boulder City Library",
  feedUrl: "https://bclibrary.libnet.info/feeds",
  branches: BRANCHES,
});
