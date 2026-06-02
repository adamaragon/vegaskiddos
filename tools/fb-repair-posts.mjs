// Audit Facebook Page posts linking to vegaskiddos.com events that lack a link
// preview image (usually bad/missing OG at scrape time). Optionally delete those
// posts, clear FBPostedAt in Airtable, refresh FB's OG cache, and repost.
//
//   node tools/fb-repair-posts.mjs audit          # list suspects
//   node tools/fb-repair-posts.mjs repair         # delete + clear + repost
//   node tools/fb-repair-posts.mjs repair --dry-run
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

const mode = (process.argv[2] || "audit").toLowerCase();
const DRY = process.argv.includes("--dry-run");

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
  if (!r.ok) throw new Error(`OG scrape ${r.status}: ${JSON.stringify(data).slice(0, 200)}`);
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

function postHasPreviewImage(post) {
  if (post.full_picture) return true;
  for (const att of post.attachments?.data || []) {
    if (att.media?.image?.src) return true;
    if (att.media?.source) return true;
  }
  return false;
}

async function airtableGetEvent(recordId) {
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/Events/${recordId}`, {
    headers: { Authorization: `Bearer ${AT}` },
  });
  if (!r.ok) return null;
  return r.json();
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

async function publish(message, link, whenUnix) {
  const params = new URLSearchParams({ message, access_token: PAGE_TOKEN });
  if (link) params.set("link", link);
  if (whenUnix) {
    params.set("published", "false");
    params.set("scheduled_publish_time", String(whenUnix));
  }
  const r = await fetch(`${GRAPH}/${PAGE_ID}/feed`, { method: "POST", body: params });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Graph POST feed ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data.id;
}

function classify(posts) {
  const eventPosts = [];
  for (const p of posts) {
    const eid = eventIdFromPost(p);
    if (eid) eventPosts.push({ post: p, eventId: eid });
  }
  const missingImage = eventPosts.filter(({ post }) => !postHasPreviewImage(post));
  return { eventPosts, missingImage };
}

async function runRepair(missingImage) {
  if (!missingImage.length) {
    console.log("Nothing to repair.");
    return;
  }

  console.log(`${DRY ? "(DRY RUN) " : ""}Repairing ${missingImage.length} post(s)…\n`);

  for (const { post, eventId } of missingImage) {
    const eventUrl = `${SITE}/event/${eventId}`;
    const rec = await airtableGetEvent(eventId);
    if (!rec) {
      console.warn(`  skip ${eventId}: not found in Airtable`);
      continue;
    }

    console.log(`→ ${rec.fields.Title || eventId}`);

    if (DRY) {
      console.log(`    would: scrape OG, delete ${post.id}, clear FBPostedAt, repost`);
      continue;
    }

    await scrapeOg(eventUrl);
    await graphDelete(post.id);
    await clearFbPostedAt(eventId);

    const { message, url } = eventPost(rec);
    const whenUnix = post.scheduled_publish_time
      ? Math.floor(new Date(post.scheduled_publish_time).getTime() / 1000)
      : undefined;
    const useSchedule =
      whenUnix && whenUnix * 1000 > Date.now() + 15 * 60 * 1000 ? whenUnix : undefined;

    const newId = await publish(message, url, useSchedule);
    await stampPosted(eventId, useSchedule ? new Date(useSchedule * 1000) : new Date());
    console.log(`    ✅ ${useSchedule ? "rescheduled" : "reposted"}: ${newId}`);
  }
}

// ── main ────────────────────────────────────────────────────────────────────
console.log("Fetching published + scheduled Page posts…\n");
const published = await fetchAllPosts("published_posts");
const scheduled = await fetchAllPosts("scheduled_posts");
const all = [...published, ...scheduled];
const { eventPosts, missingImage } = classify(all);

console.log(`Total posts fetched: ${all.length} (${published.length} published, ${scheduled.length} scheduled)`);
console.log(`Event link posts: ${eventPosts.length}`);
console.log(`Missing preview image: ${missingImage.length}\n`);

for (const { post, eventId } of missingImage) {
  const when = post.scheduled_publish_time || post.created_time || "?";
  console.log(`  • ${when}  ${post.id}`);
  console.log(`    event: ${SITE}/event/${eventId}`);
  const line = (post.message || "").split("\n").find((l) => l.includes("vegaskiddos")) || (post.message || "").slice(0, 80);
  console.log(`    ${line}\n`);
}

if (mode === "repair") {
  await runRepair(missingImage);
} else if (mode !== "audit") {
  console.error(`Unknown mode "${mode}". Use: audit | repair`);
  process.exit(1);
}
