// Audit Facebook Page posts linking to vegaskiddos.com events that lack a link
// preview image (usually bad/missing OG at scrape time). Optionally delete those
// posts, clear FBPostedAt in Airtable, refresh FB's OG cache, and repost.
//
//   node tools/fb-repair-posts.mjs audit          # list suspects
//   node tools/fb-repair-posts.mjs repair         # delete + clear + repost
//   node tools/fb-repair-posts.mjs repair --dry-run
//   node tools/fb-repair-posts.mjs restore-timing   # fix posts wrongly published "now"
//
// Env: AIRTABLE_TOKEN, AIRTABLE_BASE_ID, FB_PAGE_ID, FB_PAGE_TOKEN
import fs from "node:fs";

try {
  for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const AT = process.env.AIRTABLE_TOKEN;
const BASE = process.env.AIRTABLE_BASE_ID;
const PAGE_ID = (process.env.FB_PAGE_ID || "").trim();
const PAGE_TOKEN = (process.env.FB_PAGE_TOKEN || "").trim();
const GRAPH = "https://graph.facebook.com/v21.0";
const SITE = "https://vegaskiddos.com";
const HASHTAGS = "#LasVegas #VegasKids #ThingsToDoInVegas #FamilyFun #VegasFamilies #KidFriendly #EventosLasVegas";

// Site-wide fallback when an event has no scraped image — link shares using only
// this look "blank" or generic compared to event-specific art.
const GENERIC_OG_PATHS = ["/opengraph-image", "/opengraph-image.png", "opengraph-image"];

// Original intended times from the 2026-06-02 generic-preview repair batch (audit log).
const RESTORE_TIMINGS = {
  recUjmVWcD4OBfoNI: { backdateUnix: Math.floor(Date.parse("2026-05-30T18:00:17Z") / 1000) },
  recEuGZdIQLCWnIz3: { scheduleUnix: 1780509600 },
  recaHegR5okFroONJ: { scheduleUnix: 1780682400 },
  recB83NcOPm0S86oP: { scheduleUnix: 1780855200 },
  reccx2liq77KbuINs: { scheduleUnix: 1781114400 },
  recffsrk6BB0dKukU: { scheduleUnix: 1781200800 },
};

const mode = (process.argv[2] || "audit").toLowerCase();
const DRY = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");

if (!AT || !BASE) {
  console.error("AIRTABLE_TOKEN / AIRTABLE_BASE_ID required");
  process.exit(1);
}
if (!PAGE_ID || !PAGE_TOKEN) {
  console.error("FB_PAGE_ID / FB_PAGE_TOKEN required");
  process.exit(1);
}

const FIELDS = [
  "id",
  "message",
  "created_time",
  "scheduled_publish_time",
  "permalink_url",
  "full_picture",
  "status_type",
  "attachments{media,type,unshimmed_url,title,description}",
].join(",");

const fmtWhen = (iso, rec) => {
  if (rec) return String(rec);
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
};
const priceOf = (f) => f.PriceText || (f.PriceTier === "free" ? "Free" : "");

function eventPost(rec) {
  const f = rec.fields;
  const url = `${SITE}/event/${rec.id}`;
  const price = priceOf(f);
  const message = [
    `🌵 ${f.Title}`,
    `📅 ${fmtWhen(f.Start, f.Recurrence)}${f.Venue ? `   📍 ${f.Venue}` : ""}${price ? `   ·   ${price}` : ""}`,
    "",
    `Find this and every kid-safe event in Vegas — sorted by age, price & neighborhood 👇`,
    url,
    "",
    HASHTAGS,
  ].join("\n");
  return { message, url };
}

async function graphGetUrl(url) {
  const r = await fetch(url);
  const data = await r.json();
  if (!r.ok) throw new Error(`Graph GET ${r.status}: ${JSON.stringify(data).slice(0, 400)}`);
  return data;
}

async function graphDelete(postId) {
  const url = `${GRAPH}/${postId}?access_token=${encodeURIComponent(PAGE_TOKEN)}`;
  const r = await fetch(url, { method: "DELETE" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Graph DELETE ${postId} ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function scrapeOg(eventUrl) {
  const url = `${GRAPH}/?id=${encodeURIComponent(eventUrl)}&scrape=true&access_token=${encodeURIComponent(PAGE_TOKEN)}`;
  const r = await fetch(url, { method: "POST" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.warn(`    OG scrape skipped (${r.status}): ${JSON.stringify(data).slice(0, 120)}`);
    return null;
  }
  return data;
}

async function fetchAllPosts(edge) {
  const out = [];
  let url = `${GRAPH}/${PAGE_ID}/${edge}?fields=${encodeURIComponent(FIELDS)}&limit=50&access_token=${encodeURIComponent(PAGE_TOKEN)}`;
  while (url) {
    const data = await graphGetUrl(url);
    out.push(...(data.data || []));
    url = data.paging?.next || null;
  }
  return out;
}

function eventIdFromPost(post) {
  const parts = [post.message, post.permalink_url];
  for (const att of post.attachments?.data || []) {
    if (att.unshimmed_url) parts.push(att.unshimmed_url);
  }
  const blob = parts.filter(Boolean).join("\n");
  const m = blob.match(/vegaskiddos\.com\/event\/(rec[a-zA-Z0-9]+)/i);
  return m?.[1] || null;
}

function previewImageUrls(post) {
  const urls = [];
  if (post.full_picture) urls.push(post.full_picture);
  for (const att of post.attachments?.data || []) {
    if (att.media?.image?.src) urls.push(att.media.image.src);
  }
  return urls;
}

function postHasPreviewImage(post) {
  return previewImageUrls(post).length > 0;
}

function isGenericPreviewUrl(url) {
  if (!url) return true;
  const u = url.toLowerCase();
  return GENERIC_OG_PATHS.some((p) => u.includes(p));
}

function postUsesOnlyGenericPreview(post) {
  const urls = previewImageUrls(post);
  if (!urls.length) return true;
  return urls.every(isGenericPreviewUrl);
}

async function airtableGetEvent(recordId) {
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/Events/${recordId}`, {
    headers: { Authorization: `Bearer ${AT}` },
  });
  if (!r.ok) return null;
  return r.json();
}

/** True when the live event page has a dedicated image (not site default OG). */
async function eventPageHasDedicatedImage(eventId, rec) {
  const hasAirtableImage = Boolean(rec?.fields?.Image);
  if (hasAirtableImage) return true;
  try {
    const html = await fetch(`${SITE}/event/${eventId}`, {
      headers: { "User-Agent": "VegasKiddos-FB-Repair/1.0" },
    }).then((r) => r.text());
    const og = html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] || "";
    if (!og) return false;
    return !isGenericPreviewUrl(og);
  } catch {
    return false;
  }
}

async function clearFbPostedAt(recordId) {
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/Events`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${AT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ records: [{ id: recordId, fields: { FBPostedAt: null } }], typecast: true }),
  });
  if (!r.ok) throw new Error(`Airtable clear FBPostedAt ${r.status}: ${(await r.text()).slice(0, 150)}`);
}

async function stampPosted(id, when = new Date()) {
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/Events`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${AT}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      records: [{ id, fields: { FBPostedAt: when.toISOString() } }],
      typecast: true,
    }),
  });
  if (!r.ok) console.error("warn: could not set FBPostedAt:", r.status, (await r.text()).slice(0, 150));
}

function parseTimeToUnix(raw) {
  if (raw == null) return undefined;
  if (typeof raw === "number" || /^\d+$/.test(String(raw))) {
    const n = Number(raw);
    return n < 1e12 ? n : Math.floor(n / 1000);
  }
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

/** @returns {{ scheduleUnix?: number, backdateUnix?: number, granularity?: string }} */
function timingForUnix(whenUnix) {
  if (!whenUnix) return {};
  if (whenUnix * 1000 > Date.now() + 15 * 60 * 1000) return { scheduleUnix: whenUnix };
  return { backdateUnix: whenUnix, granularity: "min" };
}

function timingFromPost(post) {
  const whenUnix =
    parseTimeToUnix(post.scheduled_publish_time) ?? parseTimeToUnix(post.created_time);
  return timingForUnix(whenUnix);
}

async function publish(message, link, timing = {}) {
  const params = new URLSearchParams({ message, access_token: PAGE_TOKEN });
  if (link) params.set("link", link);
  if (timing.scheduleUnix) {
    params.set("published", "false");
    params.set("scheduled_publish_time", String(timing.scheduleUnix));
  } else if (timing.backdateUnix) {
    params.set("published", "true");
    params.set("backdated_time", String(timing.backdateUnix));
    params.set("backdated_time_granularity", timing.granularity || "min");
  }
  const r = await fetch(`${GRAPH}/${PAGE_ID}/feed`, { method: "POST", body: params });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Graph POST feed ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data.id;
}

async function classifyPosts(posts) {
  const eventPosts = [];
  for (const p of posts) {
    const eid = eventIdFromPost(p);
    if (eid) eventPosts.push({ post: p, eventId: eid });
  }

  const needsRepair = [];
  for (const item of eventPosts) {
    const rec = await airtableGetEvent(item.eventId);
    const noImage = !postHasPreviewImage(item.post);
    const genericOnly = postUsesOnlyGenericPreview(item.post);
    const shouldHaveArt = await eventPageHasDedicatedImage(item.eventId, rec);
    const reason =
      noImage ? "no_preview" : genericOnly && shouldHaveArt ? "generic_preview" : null;
    if (reason) needsRepair.push({ ...item, rec, reason, preview: previewImageUrls(item.post)[0] || "(none)" });
  }
  return { eventPosts, needsRepair };
}

async function runRepair(needsRepair) {
  if (!needsRepair.length) {
    console.log("Nothing to repair.");
    return;
  }

  console.log(`${DRY ? "(DRY RUN) " : ""}Repairing ${needsRepair.length} post(s)…\n`);

  for (const { post, eventId, rec, reason } of needsRepair) {
    const eventUrl = `${SITE}/event/${eventId}`;
    if (!rec) {
      console.warn(`  skip ${eventId}: not found in Airtable`);
      continue;
    }

    console.log(`→ ${rec.fields.Title || eventId} (${reason})`);

    if (DRY) {
      console.log(`    would: scrape OG, delete ${post.id}, clear FBPostedAt, repost`);
      continue;
    }

    await scrapeOg(eventUrl);
    await new Promise((r) => setTimeout(r, 1500));
    await graphDelete(post.id);
    await clearFbPostedAt(eventId);

    const { message, url } = eventPost(rec);
    const timing = timingFromPost(post);

    const newId = await publish(message, url, timing);
    const stampWhen = timing.scheduleUnix
      ? new Date(timing.scheduleUnix * 1000)
      : timing.backdateUnix
        ? new Date(timing.backdateUnix * 1000)
        : new Date();
    await stampPosted(eventId, stampWhen);
    const label = timing.scheduleUnix ? "rescheduled" : timing.backdateUnix ? "backdated" : "reposted";
    console.log(`    ✅ ${label}: ${newId}`);
  }
}

/** Re-post the 2026-06-02 repair batch at original schedule/backdate times. */
async function runRestoreTiming(published) {
  const repairCutoff = Date.parse("2026-06-02T21:00:00Z");
  const targets = published
    .map((post) => ({ post, eventId: eventIdFromPost(post) }))
    .filter(({ post, eventId }) => eventId && RESTORE_TIMINGS[eventId])
    .filter(({ post }) => Date.parse(post.created_time) >= repairCutoff);

  if (!targets.length) {
    console.log("restore-timing: no recent repair posts found for the known event set.");
    return;
  }

  console.log(`${DRY ? "(DRY RUN) " : ""}Restoring timing on ${targets.length} post(s)…\n`);

  for (const { post, eventId } of targets) {
    const rec = await airtableGetEvent(eventId);
    if (!rec) {
      console.warn(`  skip ${eventId}: not in Airtable`);
      continue;
    }
    const timing = RESTORE_TIMINGS[eventId];
    const eventUrl = `${SITE}/event/${eventId}`;
    const whenLabel = timing.scheduleUnix
      ? new Date(timing.scheduleUnix * 1000).toISOString()
      : new Date(timing.backdateUnix * 1000).toISOString();

    console.log(`→ ${rec.fields.Title} → ${whenLabel}`);

    if (DRY) {
      console.log(`    would: delete ${post.id}, repost with ${JSON.stringify(timing)}`);
      continue;
    }

    await scrapeOg(eventUrl);
    await new Promise((r) => setTimeout(r, 1500));
    await graphDelete(post.id);
    const { message, url } = eventPost(rec);
    const newId = await publish(message, url, timing);
    await stampPosted(
      eventId,
      new Date((timing.scheduleUnix || timing.backdateUnix) * 1000)
    );
    console.log(`    ✅ ${timing.scheduleUnix ? "scheduled" : "backdated"}: ${newId}`);
  }
}

// ── main ────────────────────────────────────────────────────────────────────
console.log("Fetching published + scheduled Page posts…\n");
const published = await fetchAllPosts("published_posts");
const scheduled = await fetchAllPosts("scheduled_posts");
const all = [...published, ...scheduled];

if (mode === "restore-timing") {
  await runRestoreTiming(published);
  process.exit(0);
}

const { eventPosts, needsRepair } = await classifyPosts(all);

const noPreview = needsRepair.filter((x) => x.reason === "no_preview");
const generic = needsRepair.filter((x) => x.reason === "generic_preview");

console.log(`Total posts fetched: ${all.length} (${published.length} published, ${scheduled.length} scheduled)`);
console.log(`Event link posts: ${eventPosts.length}`);
console.log(`Needs repair: ${needsRepair.length} (${noPreview.length} no image, ${generic.length} generic OG while event has art)\n`);

for (const { post, eventId, reason, preview } of needsRepair) {
  const when = post.scheduled_publish_time || post.created_time || "?";
  console.log(`  • [${reason}] ${when}  ${post.id}`);
  console.log(`    event: ${SITE}/event/${eventId}`);
  console.log(`    preview: ${preview.slice(0, 100)}`);
  const line = (post.message || "").split("\n").find((l) => l.includes("vegaskiddos")) || (post.message || "").slice(0, 80);
  console.log(`    ${line}\n`);
}

if (VERBOSE) {
  console.log("── sample OK posts (first 5) ──");
  const ok = eventPosts.filter((ep) => !needsRepair.some((n) => n.post.id === ep.post.id)).slice(0, 5);
  for (const { post } of ok) {
    console.log(`  ${post.id}  ${previewImageUrls(post)[0]?.slice(0, 90) || "(no url)"}`);
  }
}

if (mode === "repair") {
  await runRepair(needsRepair);
} else if (mode !== "audit") {
  console.error(`Unknown mode "${mode}". Use: audit | repair | restore-timing`);
  process.exit(1);
}
