// Cancellation sweep. Detects approved, upcoming, one-time events that look
// cancelled and (optionally) removes them from the public site — so a library
// event that's pulled after we listed it doesn't linger as a "ghost" listing.
//
// The reliable signal, matching how these sources behave: a cancelled event
// DISAPPEARS from its source feed. We re-fetch every feed and, for each approved
// one-time event whose Start is still within that feed's current horizon, check
// whether its ExternalId is gone. A vanished event is then CONFIRMED against its
// own source URL:
//
//   HIGH confidence  → vanished from feed AND (its URL 404/410s, or its page
//                      says "cancelled"/"postponed"). Auto-removed when applying.
//   MEDIUM           → vanished but the page is still live & says nothing.
//                      Reported for human review, never auto-removed.
//
// Safety rails:
//   • a source that errored or returned zero this run is SKIPPED entirely — a
//     feed hiccup must never mass-cancel a catalog.
//   • only one-time events within the feed's horizon are considered (recurring
//     series and far-future events legitimately aren't in the window).
//   • removal sets Approved=false + Rejected=true + Canceled=true so it drops
//     off the site immediately and the daily scraper never re-publishes it; the
//     reason + timestamp are recorded for audit / easy manual undo.
import { fetchAllSources } from "./run";

const API = "https://api.airtable.com/v0";
const META = "https://api.airtable.com/v0/meta";

function cfg() {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || "Events";
  if (!token || !base) throw new Error("AIRTABLE_TOKEN/AIRTABLE_BASE_ID not set");
  return { token, base, table };
}

type Rec = { id: string; fields: Record<string, unknown> };

interface Candidate {
  rec: Rec;
  title: string;
  source: string;
  url?: string;
  start: string;
  confidence: "HIGH" | "MEDIUM";
  reason: string;
}

const CANCEL_RE = /\bcancell?ed\b|\bpostponed\b|\bno longer (?:available|scheduled)\b/i;
// Social/aggregator hosts render SPA boilerplate that often contains words like
// "cancelled" unrelated to the event, and never 404 a missing item (they show a
// login/empty wall at 200). So keyword text from these is NOT trusted — only a
// genuine 404/410 confirms, which in practice means social-linked events fall to
// MEDIUM (human review) rather than being auto-removed on a noisy match.
const SOCIAL_HOST = /(?:^|\.)(facebook|fb|instagram|twitter|x|tiktok|threads)\.com$/i;

// Re-check the event's own source page. Returns a strong cancellation signal.
async function urlSignal(url: string): Promise<{ confirmed: boolean; reason: string } | null> {
  let social = false;
  try { social = SOCIAL_HOST.test(new URL(url).hostname); } catch { /* keep false */ }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "VegasKiddos/1.0 (+https://vegaskiddos.com)" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 404 || res.status === 410) {
      return { confirmed: true, reason: `source URL ${res.status} (listing removed)` };
    }
    if (!res.ok) return null; // 5xx / blocked — inconclusive
    if (social) return { confirmed: false, reason: "social URL still resolves (keyword text not trusted here)" };
    const text = (await res.text()).slice(0, 200000);
    if (CANCEL_RE.test(text)) return { confirmed: true, reason: "source page says cancelled/postponed" };
    return { confirmed: false, reason: "source page still live, no cancellation text" };
  } catch {
    return null; // network/timeout — inconclusive, don't auto-apply
  }
}

async function ensureCancelFields(token: string, base: string): Promise<void> {
  const metaRes = await fetch(`${META}/bases/${base}/tables`, { headers: { Authorization: `Bearer ${token}` } });
  if (!metaRes.ok) {
    console.warn(`  (could not read schema (${metaRes.status}) to ensure Cancel fields — add Canceled/CanceledAt/CanceledReason manually if writes fail)`);
    return;
  }
  const { tables } = (await metaRes.json()) as { tables: { id: string; name: string; fields: { name: string }[] }[] };
  const tbl = tables.find((t) => t.name === (process.env.AIRTABLE_TABLE_NAME || "Events"));
  if (!tbl) return;
  const have = new Set(tbl.fields.map((f) => f.name));
  const want: { name: string; type: string; options?: unknown; description: string }[] = [
    { name: "Canceled", type: "checkbox", options: { icon: "x", color: "redBright" }, description: "Auto-flagged by the cancellation sweep (event vanished from its source + URL confirmed)." },
    { name: "CanceledAt", type: "dateTime", options: { timeZone: "America/Los_Angeles", dateFormat: { name: "iso" }, timeFormat: { name: "24hour" } }, description: "When the cancellation sweep removed this event." },
    { name: "CanceledReason", type: "singleLineText", description: "Why the sweep flagged this event as cancelled." },
  ];
  for (const f of want) {
    if (have.has(f.name)) continue;
    const r = await fetch(`${META}/bases/${base}/tables/${tbl.id}/fields`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    if (r.ok) console.log(`  created field "${f.name}"`);
    else console.warn(`  could not create "${f.name}" (${r.status}) — add it manually if writes fail`);
  }
}

async function approvedOneTimeUpcoming(token: string, base: string, table: string): Promise<Rec[]> {
  // Approved, not recurring, starts after now — the only events a "ghost"
  // cancellation matters for (past + recurring are handled elsewhere).
  const formula = "AND({Approved}=1, {Recurrence}=BLANK(), IS_AFTER({Start}, NOW()))";
  const out: Rec[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`${API}/${base}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("filterByFormula", formula);
    for (const f of ["Title", "Venue", "Start", "Source", "ExternalId", "Url"]) url.searchParams.append("fields[]", f);
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Airtable ${res.status}`);
    const data = (await res.json()) as { records: Rec[]; offset?: string };
    out.push(...data.records);
    offset = data.offset;
  } while (offset);
  return out;
}

export interface SweepSummary {
  ranAt: string;
  apply: boolean;
  sourcesSwept: string[];
  sourcesSkipped: { source: string; why: string }[];
  scanned: number;
  high: Candidate[];
  medium: Candidate[];
  removed: number;
}

export async function runSweep(opts?: { apply?: boolean }): Promise<SweepSummary> {
  const apply = opts?.apply ?? false;
  const { token, base, table } = cfg();

  // 1. Current feeds. Skip any source that errored or returned zero (a hiccup
  //    must never look like "everything was cancelled").
  const results = await fetchAllSources();
  const liveBySource = new Map<string, { ids: Set<string>; maxStart: string }>();
  const sourcesSkipped: { source: string; why: string }[] = [];
  for (const r of results) {
    if (r.errors.length) { sourcesSkipped.push({ source: r.source, why: `errors: ${r.errors.join("; ")}` }); continue; }
    if (r.events.length === 0) { sourcesSkipped.push({ source: r.source, why: "returned 0 events" }); continue; }
    const ids = new Set<string>();
    let maxStart = "";
    for (const e of r.events) {
      if (e.externalId) ids.add(e.externalId);
      if (e.start && e.start > maxStart) maxStart = e.start;
    }
    liveBySource.set(r.source, { ids, maxStart });
  }
  const sourcesSwept = [...liveBySource.keys()];

  // 2. Approved upcoming one-time events from swept sources.
  const recs = (await approvedOneTimeUpcoming(token, base, table)).filter(
    (r) => liveBySource.has(String(r.fields.Source || ""))
  );

  // 3. Detect vanished-from-feed candidates within each source's horizon.
  const nowIso = new Date().toISOString();
  const vanished: Rec[] = [];
  for (const r of recs) {
    const src = liveBySource.get(String(r.fields.Source))!;
    const ext = String(r.fields.ExternalId || "");
    const start = String(r.fields.Start || "");
    if (!ext) continue;                       // can't match without an id
    if (start <= nowIso) continue;            // already past
    if (start > src.maxStart) continue;       // beyond the feed's current horizon
    if (src.ids.has(ext)) continue;           // still listed — fine
    vanished.push(r);
  }

  // 4. Confirm each vanished event against its own URL (HIGH vs MEDIUM).
  const high: Candidate[] = [];
  const medium: Candidate[] = [];
  for (const r of vanished) {
    const base_ = {
      rec: r,
      title: String(r.fields.Title || ""),
      source: String(r.fields.Source || ""),
      url: r.fields.Url ? String(r.fields.Url) : undefined,
      start: String(r.fields.Start || ""),
    };
    const url = base_.url;
    if (url) {
      const sig = await urlSignal(url);
      if (sig?.confirmed) { high.push({ ...base_, confidence: "HIGH", reason: `vanished from ${base_.source} feed; ${sig.reason}` }); continue; }
      medium.push({ ...base_, confidence: "MEDIUM", reason: `vanished from ${base_.source} feed; ${sig ? sig.reason : "URL check inconclusive"}` });
    } else {
      medium.push({ ...base_, confidence: "MEDIUM", reason: `vanished from ${base_.source} feed; no source URL to confirm` });
    }
  }

  // 5. Apply HIGH-confidence removals.
  let removed = 0;
  if (apply && high.length) {
    await ensureCancelFields(token, base);
    for (let i = 0; i < high.length; i += 10) {
      const slice = high.slice(i, i + 10);
      const res = await fetch(`${API}/${base}/${encodeURIComponent(table)}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          typecast: true,
          records: slice.map((c) => ({
            id: c.rec.id,
            fields: { Approved: false, Rejected: true, Canceled: true, CanceledAt: nowIso, CanceledReason: c.reason },
          })),
        }),
      });
      if (res.ok) removed += slice.length;
      else console.error(`  PATCH failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
  }

  return {
    ranAt: nowIso,
    apply,
    sourcesSwept,
    sourcesSkipped,
    scanned: recs.length,
    high,
    medium,
    removed,
  };
}
