// Source adapter: Henderson Libraries (a separate district from LVCCLD, covering
// the Henderson submarket). Also runs Communico "Attend" at
// henderson.libnet.info. We skip the senior-facility, Outreach, and Virtual
// "branches" — only physical family libraries. Locations verified from
// https://api.communico.co/v1/henderson/locations.

import { makeCommunicoAdapter, type CommunicoBranch } from "./communico";

const BRANCHES: CommunicoBranch[] = [
  { id: "298", name: "Green Valley Library", hood: "henderson" },
  { id: "297", name: "James I. Gibson Library", hood: "henderson" },
  { id: "296", name: "Paseo Verde Library", hood: "henderson" },
  { id: "2996", name: "West Henderson Library", hood: "henderson" },
  // 299 = Heritage Park Senior Facility, 4180 = Outreach, 2786 = Virtual — skipped.
];

export const fetchHendersonLibraries = makeCommunicoAdapter({
  source: "Henderson Libraries",
  feedUrl: "https://henderson.libnet.info/feeds",
  branches: BRANCHES,
});
