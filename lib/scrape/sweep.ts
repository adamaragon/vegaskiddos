// Cancellation sweep. Detects approved, upcoming, one-time events that look
// cancelled and (optionally) FLAGS them — so a library event that's pulled after
// we listed it shows a "Canceled" banner instead of misleading parents.
//
// The reliable signal, matching how these sources behave: a cancelled event
// DISAPPEARS from its source feed. We re-fetch every feed and, for each approved
// one-time event whose Start is still within that feed's current horizon, check
// whether its ExternalId is gone. A vanished event is then CONFIRMED against its
// own source URL:
//
//   HIGH confidence  → vanished from feed AND (its URL 404/410s, or its page
//                      says "cancelled"/"postponed"). Auto-flagged when applying.
//   MEDIUM           → vanished but the page is still live & says nothing.
//                      Reported for human review, never auto-flagged.
//
// Flagged events are MARKED (Canceled=true) — NOT removed. They stay Approved
// and visible so the card + event page can show a banner, and fb-post skips them
// so they're never social-posted. An event that REAPPEARS in its feed is auto-
// un-cancelled. Because we never set Approved=false/Rejected, a false positive
// is just a reversible banner, not a vanished listing.
//
// Safety rails:
//   • a source that errored or returned zero this run is SKIPPED entirely — a
//     feed hiccup must never mass-cancel a catalog.
//   • only one-time events within the feed's horizon are considered (recurring
//     series and far-future events legitimately aren't in the window).
import { fetchAllSources } from "./run";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const API = "https://api.airtable.com/v0";
const META = "https://api.airtable.com/v0/meta";

function cfg() {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || "Events";
  if (!token || !base) throw new Error("AIRTABLE_TOKEN/AIRTABLE_BASE_ID not set");
  return { token, base, table };
}

const GOV_LIVE = join(process.cwd(), "tools/.gov-live-ids.json");
const GOV_LIVE_MAX_MS = 36 * 60 * 60 * 1000;

function loadGovLive(): { source: string; ids: Set<string>; maxStart: string }[] {
  try {
    const raw = JSON.parse(readFileSync(GOV_LIVE, "utf8")) as {
      ranAt?: string;
      sources?: Record<string, { ids?: string[]; maxStart?: string }>;
    };
    if (!raw.ranAt || Date.now() - Date.parse(raw.ranAt) > GOV_LIVE_MAX_MS) return [];
    const out: { source: string; ids: Set<string>; maxStart: string }[] = [];
    for (const [source, s] of Object.entries(raw.sources || {})) {
      const ids = new Set((s.ids || []).filter(Boolean));
      if (!ids.size) continue;
      out.push({ source, ids, maxStart: s.maxStart || "" });
    }
    return out;
  } catch {
    return [];
  }
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

// Re-check the event's own source page. ONLY a real 404/410 ("listing removed")
// is treated as high-confidence — we auto-act on that. A cancellation KEYWORD on
// a still-live page is reported for review but NEVER auto-applied: page text is
// noisy (SPA boilerplate, sibling-event lists, weather-cancellation policies,
// footers), and an event the adapter merely stopped surfacing could otherwise be
// falsely cancelled. Library single-instance cancellations are caught upstream
// via the scraper's STATUS:CANCELLED handling, not here.
type UrlKind = "gone" | "keyword" | "live" | "inconclusive";
async function urlSignal(url: string): Promise<{ kind: UrlKind; reason: string }> {
  let social = false;
  try { social = SOCIAL_HOST.test(new URL(url).hostname); } catch { /* keep false */ }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "VegasKiddos/1.0 (+https://vegaskiddos.com)" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 404 || res.status === 410) return { kind: "gone", reason: `source URL ${res.status} (listing removed)` };
    if (!res.ok) return { kind: "inconclusive", reason: `source URL ${res.status}` };
    if (social) return { kind: "live", reason: "social URL still resolves" };
    const text = (await res.text()).slice(0, 200000);
    if (CANCEL_RE.test(text)) return { kind: "keyword", reason: "page mentions cancelled/postponed (unverified — review)" };
    return { kind: "live", reason: "source page still live" };
  } catch {
    return { kind: "inconclusive", reason: "URL check failed (timeout/network)" };
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
    { name: "Canceled", type: "checkbox", options: { icon: "check", color: "redBright" }, description: "Auto-flagged by the cancellation sweep (event vanished from its source + URL confirmed)." },
    { name: "CanceledAt", type: "dateTime", options: { timeZone: "America/Los_Angeles", dateFormat: { name: "iso" }, timeFormat: { name: "24hour" } }, description: "When the cancellation sweep flagged this event." },
    { name: "CanceledReason", type: "singleLineText", description: "Why the sweep flagged this event as cancelled." },
    { name: "CanceledDates", type: "multilineText", description: "For a recurring series: cancelled occurrence days, comma/newline separated." },
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
  // Grace window: include events up to ~1 day past Start (mirrors getEvents) so a
  // just-passed event can still be un-cancelled if it reappears in its feed.
  const formula = "AND({Approved}=1, {Recurrence}=BLANK(), IS_AFTER({Start}, DATEADD(NOW(),-1,'days')))";
  const out: Rec[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`${API}/${base}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("filterByFormula", formula);
    for (const f of ["Title", "Venue", "Start", "Source", "ExternalId", "Url", "Canceled"]) url.searchParams.append("fields[]", f);
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
  marked: number; // newly flagged Canceled (banner shown; event stays visible)
  unmarked: { id: string; title: string }[]; // reappeared in feed → un-cancelled
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
    if (r.skipSweep) { sourcesSkipped.push({ source: r.source, why: "fallback feed with mismatched ids" }); continue; }
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
  for (const g of loadGovLive()) {
    if (liveBySource.has(g.source)) continue;
    liveBySource.set(g.source, { ids: g.ids, maxStart: g.maxStart });
  }
  const sourcesSwept = [...liveBySource.keys()];

  // 2. Approved upcoming one-time events from swept sources.
  const recs = (await approvedOneTimeUpcoming(token, base, table)).filter(
    (r) => liveBySource.has(String(r.fields.Source || ""))
  );

  // 3. Detect vanished-from-feed candidates within each source's horizon, and
  //    (the reverse) already-cancelled events that have REAPPEARED in their feed
  //    — those get un-cancelled so the banner clears automatically.
  const nowIso = new Date().toISOString();
  const vanished: Rec[] = [];
  const reappeared: Rec[] = [];
  for (const r of recs) {
    const src = liveBySource.get(String(r.fields.Source))!;
    const ext = String(r.fields.ExternalId || "");
    const start = String(r.fields.Start || "");
    const isCanceled = Boolean(r.fields.Canceled);
    if (!ext) continue;                       // can't match without an id
    if (src.ids.has(ext)) {                   // still listed in the feed
      if (isCanceled) reappeared.push(r);     // …and was cancelled → un-cancel (incl. just-passed, within the grace window)
      continue;
    }
    if (isCanceled) continue;                 // already flagged; nothing new to do
    if (start <= nowIso) continue;            // never newly-cancel a past event
    if (start > src.maxStart) continue;       // beyond the feed's current horizon
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
      // Only a physically-removed listing (404/410) auto-applies. Keyword/live/
      // inconclusive → report for review (never auto-cancel on noisy page text).
      if (sig.kind === "gone") high.push({ ...base_, confidence: "HIGH", reason: `vanished from ${base_.source} feed; ${sig.reason}` });
      else medium.push({ ...base_, confidence: "MEDIUM", reason: `vanished from ${base_.source} feed; ${sig.reason}` });
    } else {
      medium.push({ ...base_, confidence: "MEDIUM", reason: `vanished from ${base_.source} feed; no source URL to confirm` });
    }
  }

  // 5. Apply. HIGH-confidence events are MARKED cancelled (Canceled=true) — they
  //    stay Approved/visible and render a banner; they're simply never social-
  //    posted. Reappeared events are un-cancelled. We never set Approved=false
  //    or Rejected here, so a false positive only shows a (reversible) banner.
  const patch = async (records: { id: string; fields: Record<string, unknown> }[]) => {
    let n = 0;
    for (let i = 0; i < records.length; i += 10) {
      const slice = records.slice(i, i + 10);
      const res = await fetch(`${API}/${base}/${encodeURIComponent(table)}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ typecast: true, records: slice }),
      });
      if (res.ok) n += slice.length;
      else console.error(`  PATCH failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
    return n;
  };

  let marked = 0;
  const unmarked: { id: string; title: string }[] = [];
  if (apply && (high.length || reappeared.length)) {
    await ensureCancelFields(token, base);
    if (high.length) {
      marked = await patch(high.map((c) => ({
        id: c.rec.id,
        fields: { Canceled: true, CanceledAt: nowIso, CanceledReason: c.reason },
      })));
    }
    if (reappeared.length) {
      const n = await patch(reappeared.map((r) => ({
        id: r.id,
        fields: { Canceled: false, CanceledReason: "" },
      })));
      if (n) for (const r of reappeared) unmarked.push({ id: r.id, title: String(r.fields.Title || "") });
    }
  } else {
    for (const r of reappeared) unmarked.push({ id: r.id, title: String(r.fields.Title || "") });
  }

  return {
    ranAt: nowIso,
    apply,
    sourcesSwept,
    sourcesSkipped,
    scanned: recs.length,
    high,
    medium,
    marked,
    unmarked,
  };
}
