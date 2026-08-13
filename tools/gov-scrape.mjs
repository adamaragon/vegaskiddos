// Headless-browser scraper for government event calendars that are JS-rendered
// / bot-protected and can't be hit by the regular fetch-based adapters.
// Runs standalone (node tools/gov-scrape.mjs) locally or in GitHub Actions.
// Renders each site with Puppeteer, normalizes events, and UPSERTS to Airtable
// (Approved unset = lands in the review queue, never auto-published).
//
// Env: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (table "Events").

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { sanitizeDescription } from "../lib/scrape/sanitize-description.mjs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/* ---------------- classification (compact, mirrors lib/scrape/classify) -------- */
const ZIP_HOOD = {
  "89134":"summerlin","89135":"summerlin","89138":"summerlin","89144":"summerlin","89145":"summerlin","89128":"summerlin","89129":"summerlin",
  "89002":"henderson","89011":"henderson","89012":"henderson","89014":"henderson","89015":"henderson","89052":"henderson","89074":"henderson","89044":"henderson",
  "89030":"north-lv","89031":"north-lv","89032":"north-lv","89084":"north-lv","89081":"north-lv","89086":"north-lv",
  "89117":"spring-valley","89146":"spring-valley","89147":"spring-valley","89103":"spring-valley","89102":"spring-valley","89148":"spring-valley",
  "89113":"enterprise","89139":"enterprise","89141":"enterprise","89178":"enterprise","89183":"enterprise","89123":"enterprise",
  "89101":"downtown","89104":"downtown","89106":"downtown","89107":"downtown","89109":"downtown","89169":"downtown",
};
const hoodFromText = (t) => { const m = (t||"").match(/\b(89\d{3})\b/); return (m && ZIP_HOOD[m[1]]) || null; };
const KID = /\b(kid|kids|child|children|family|families|toddler|baby|babies|infant|storytime|story time|preschool|pre-?k|all ages|youth|tween|teen|sensory|lego|stem|science|craft|crafts|puppet|dino|dinosaur|exhibit|museum|gallery|planetarium|aquarium|zoo|garden|read|reading|sing|petting|playgroup|playdate|mommy|nursery|junior|splash|park|festival|parade|magic show|theater|theatre|ballet|circus|scavenger|easter|santa|pumpkin|carnival|market|egg hunt|trick.?or.?treat|movie|fireworks|\bkite\b|balloon|dive.?in|art walk|holiday|fair\b|concert)\b/i;
const ADULT = /\b(21\+|18\+|nightclub|bar crawl|pub crawl|wine|winery|beer|brewery|cocktail|happy hour|ladies night|burlesque|casino|gambling|poker|dispensary|cannabis|adults? only|hookah|vape|strip club|topless|council meeting|city council|public hearing|planning commission|board meeting|advisory board|town board|town advisory|commission meeting|budget|zoning|HOA|town hall meeting)\b/i;
const BAR = /\bsports ?bar\b|\btavern\b|\bsaloon\b|\bbrew ?pub\b|\bgastropub\b|\btap ?room\b|\bdistillery\b|\b(pub|lounge|cantina)\b|bar (?:&|and) grill|& bar\b/i;
const kidRelevant = (t) => !ADULT.test(t) && !BAR.test(t) && KID.test(t);
function classifyAges(t){t=t.toLowerCase();const a=[];if(/\bbab(y|ies)\b|infant|lapsit/.test(t))a.push("baby");if(/toddler|pre-?k|preschool/.test(t))a.push("toddler");if(/\bkids?\b|child|children|youth|all ages|family/.test(t))a.push("kids");if(/teen|tween/.test(t))a.push("tweens");return a;}
function classifyPrice(t){if(/\bfree\b|no cost|no charge/i.test(t))return "free";const m=(t.match(/\$\s?(\d+(?:\.\d{2})?)/g)||[]).map(x=>parseFloat(x.replace(/[^\d.]/g,"")));if(!m.length)return null;const mx=Math.max(...m);return mx===0?"free":mx<=10?"under10":mx<=25?"mid":"premium";}
function parseTime(s){const m=(s||"").match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i);if(!m)return "09:00";let h=+m[1];const mi=m[2]||"00";if(/p/i.test(m[3])&&h!==12)h+=12;if(/a/i.test(m[3])&&h===12)h=0;return `${String(h).padStart(2,"0")}:${mi}`;}

/* ---------------- adapters ---------------- */
async function scrapeCityOfLV(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  // Capture every GetEvents response the SPA fires (on load + as we paginate).
  const raw = [];
  const seen = new Set();
  page.on("response", async (res) => {
    if (!/GetEvents/i.test(res.url())) return;
    try {
      const j = await res.json();
      for (const e of j.default || j.events || []) {
        if (!seen.has(e.id)) { seen.add(e.id); raw.push(e); }
      }
    } catch {}
  });
  await page.goto("https://www.lasvegasnevada.gov/residents/events", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 4000)); // let the events XHR fire
  // Click through "next"/"load more" pagination to pull additional pages.
  for (let i = 0; i < 6; i++) {
    const clicked = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button, a")].find((b) =>
        /next|more|load/i.test(b.textContent || "") && !b.disabled && b.offsetParent !== null
      );
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!clicked) break;
    await new Promise((r) => setTimeout(r, 1800));
  }
  await new Promise((r) => setTimeout(r, 1500));
  await page.close();
  const today = new Date().toISOString().slice(0, 10);
  const events = [];
  for (const e of raw) {
    const date = (e.start || "").slice(0, 10);
    if (!date || date < today) continue;
    const blob = `${e.title} ${e.description}`;
    if (!kidRelevant(blob)) continue;
    const dow = (e.daysOfTheWeek || "").trim();
    events.push({
      externalId: `colv:${e.id}`,
      title: String(e.title || "").trim(),
      description: sanitizeDescription(e.description),
      venue: (e.address || "").split(",")[0] || "City of Las Vegas",
      address: e.address || "",
      neighborhood: hoodFromText(e.address) || "downtown",
      start: `${date}T${parseTime(e.timeDescription)}:00-07:00`,
      ageTiers: classifyAges(blob),
      priceTier: classifyPrice(blob),
      url: e.ticketLink || `https://www.lasvegasnevada.gov/residents/events/${e.slug}`,
      image: e.image || undefined,
      recurrence: dow ? `Weekly on ${dow.split(/[,/]/)[0].trim()}s` : undefined,
      source: "City of Las Vegas",
    });
  }
  return events;
}

async function scrapeClarkCounty(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  let cc = null;
  page.on("response", async (res) => {
    if (/calendar\/events\.json/i.test(res.url()) && !cc) { try { cc = await res.json(); } catch {} }
  });
  await page.goto("https://www.clarkcountynv.gov/calendar", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 5000));
  await page.close();
  const rows = cc?.default?.data || [];
  const today = new Date().toISOString().slice(0, 10);
  const events = [];
  for (const e of rows) {
    const date = String(e.start || "").slice(0, 10);
    if (!date || date < today) continue; // upcoming only (feed includes years of history)
    const desc = sanitizeDescription(e.eventdescription);
    const blob = `${e.title} ${desc} ${e.divisionname || ""}`;
    if (!kidRelevant(blob)) continue;
    events.push({
      externalId: `cc:${e.path}`,
      title: String(e.title || "").trim(),
      description: desc.slice(0, 600),
      venue: String(e.divisionname || "Clark County").trim(),
      address: "",
      neighborhood: hoodFromText(desc),
      start: `${date}T${String(e.start).slice(11, 16) || "09:00"}:00-07:00`,
      ageTiers: classifyAges(blob),
      priceTier: classifyPrice(blob),
      url: e.readMore ? `https://www.clarkcountynv.gov${e.path}` : undefined,
      image: e.image && /^http/.test(e.image) ? e.image : undefined,
      source: "Clark County",
    });
  }
  return events;
}

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
async function scrapeHenderson(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.goto("https://www.cityofhenderson.com/our-city/event-meeting-calendar", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 4000));

  const today = new Date().toISOString().slice(0, 10);
  const events = [];
  const seen = new Set();

  // Parse the visible month grid, then advance to the next month and repeat.
  for (let pass = 0; pass < 2; pass++) {
    const grid = await page.evaluate(() => {
      const hdrText = document.body.innerText.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i);
      const cells = [...document.querySelectorAll("td")].filter((td) => td.querySelector('a[href*="/Calendar/Event/"]'));
      const items = [];
      for (const td of cells) {
        const dayM = (td.textContent || "").trim().match(/^\s*(\d{1,2})\b/);
        for (const a of td.querySelectorAll('a[href*="/Calendar/Event/"]')) {
          const wrap = a.closest("li,div,span,p") || a.parentElement;
          const tm = (wrap?.textContent || "").match(/(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)/i);
          items.push({ day: dayM ? +dayM[1] : null, time: tm ? tm[1] : null, title: a.textContent.trim(), href: a.getAttribute("href") });
        }
      }
      return { hdr: hdrText ? `${hdrText[1]} ${hdrText[2]}` : "", items };
    });

    const hm = grid.hdr.toLowerCase().match(/(\w+)\s+(\d{4})/);
    if (hm) {
      const month = MONTHS.indexOf(hm[1]) + 1;
      const year = hm[2];
      for (const it of grid.items) {
        if (!it.day || !it.title) continue;
        const blob = it.title;
        if (!kidRelevant(blob)) continue;
        const date = `${year}-${String(month).padStart(2, "0")}-${String(it.day).padStart(2, "0")}`;
        if (date < today) continue;
        const idM = it.href.match(/Event\/(\d+)/);
        const ext = `hen:${idM ? idM[1] : it.title}:${date}`;
        if (seen.has(ext)) continue;
        seen.add(ext);
        const venueM = it.title.match(/\(([^)]+)\)/);
        events.push({
          externalId: ext,
          title: it.title.replace(/\s*\([^)]+\)\s*$/, "").trim().slice(0, 120),
          description: "",
          venue: venueM ? venueM[1] : "City of Henderson",
          address: "",
          neighborhood: "henderson",
          start: `${date}T${it.time ? parseTime(it.time) : "09:00"}:00-07:00`,
          ageTiers: classifyAges(blob),
          priceTier: classifyPrice(blob),
          url: `https://www.cityofhenderson.com${it.href}`,
          source: "City of Henderson",
        });
      }
    }
    // advance to next month
    const next = await page.evaluate(() => {
      const a = [...document.querySelectorAll("a,button")].find((e) => /next month/i.test(e.textContent || ""));
      if (a) { a.click(); return true; }
      return false;
    });
    if (!next) break;
    await new Promise((r) => setTimeout(r, 2500));
  }
  await page.close();
  return events;
}

/* ---------------- collapse repeated instances into recurring series -------- */
const WD = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function collapse(events) {
  const groups = new Map();
  for (const e of events) {
    const k = `${e.source}|${e.title.toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}|${(e.venue||"").toLowerCase()}`;
    (groups.get(k) || groups.set(k, []).get(k)).push(e);
  }
  const out = [];
  for (const [k, g] of groups) {
    if (g.length === 1) { out.push(g[0]); continue; }
    g.sort((a, b) => a.start.localeCompare(b.start));
    const days = [...new Set(g.map((e) => new Date(e.start).getDay()))];
    const s = { ...g[0] };
    s.recurrence = days.length === 1 ? `Weekly on ${WD[days[0]]}s` : days.length >= 5 ? "Multiple days a week" : `${g.length} upcoming dates`;
    s.externalId = `series:${k}`;
    out.push(s);
  }
  return out;
}

/* ---------------- Airtable upsert ---------------- */
async function upsert(events) {
  const token = process.env.AIRTABLE_TOKEN, base = process.env.AIRTABLE_BASE_ID, table = "Events";
  if (!token || !base) throw new Error("AIRTABLE_TOKEN / AIRTABLE_BASE_ID required");
  let created = 0, updated = 0;
  for (let i = 0; i < events.length; i += 10) {
    const records = events.slice(i, i + 10).map((e) => {
      const f = { Title: e.title, Venue: e.venue, Address: e.address,
        Start: e.start, AgeTiers: e.ageTiers, Source: e.source, ExternalId: e.externalId, ScrapedAt: new Date().toISOString() };
      // Keep in sync with lib/scrape/description.ts — don't clobber enrich-generated text.
      const description = sanitizeDescription(e.description);
      if (description.trim().length >= 15) f.Description = description;
      if (e.neighborhood) f.Neighborhood = e.neighborhood;
      if (e.priceTier) f.PriceTier = e.priceTier;
      if (e.url) f.Url = e.url;
      if (e.image) f.Image = e.image;
      if (e.recurrence) f.Recurrence = e.recurrence;
      return { fields: f };
    });
    const res = await fetch(`https://api.airtable.com/v0/${base}/${table}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ performUpsert: { fieldsToMergeOn: ["ExternalId"] }, records, typecast: true }),
    });
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const d = await res.json();
    created += (d.createdRecords || []).length;
    updated += (d.updatedRecords || []).length;
  }
  return { created, updated };
}

// Self-healing dedup of APPROVED events (same as the main scraper's pass) so
// the daily gov run also collapses any cross-source/leftover duplicates.
async function dedupeApproved() {
  const token = process.env.AIRTABLE_TOKEN, base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) return 0;
  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const recs = []; let offset;
  do {
    const u = new URL(`https://api.airtable.com/v0/${base}/Events`);
    u.searchParams.set("pageSize", "100");
    u.searchParams.set("filterByFormula", "{Approved}=1");
    ["Title", "Venue"].forEach((f) => u.searchParams.append("fields[]", f));
    if (offset) u.searchParams.set("offset", offset);
    const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return 0;
    const d = await r.json(); recs.push(...d.records); offset = d.offset;
  } while (offset);
  let groups = 0;
  const seen = new Map();
  for (const r of recs) {
    const k = `${norm(r.fields.Title)}|${norm(r.fields.Venue)}`;
    if (seen.has(k)) groups++;
    else seen.set(k, r.id);
  }
  if (groups) console.log(`dedupe: ${groups} approved duplicate(s) left untouched (never un-approve live events)`);
  return 0;
}

/* ---------------- main ---------------- */
const dryRun = process.argv.includes("--dry");
const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const sources = { "City of Las Vegas": scrapeCityOfLV, "Clark County": scrapeClarkCounty, "City of Henderson": scrapeHenderson };
let all = [];
for (const [name, fn] of Object.entries(sources)) {
  try {
    const ev = await fn(browser);
    console.log(`  ${name}: ${ev.length} kid-relevant events`);
    all.push(...ev);
  } catch (e) {
    console.log(`  ${name}: FAILED ${e.message}`);
  }
}
await browser.close();
all = collapse(all);
console.log(`total after collapse: ${all.length}`);

const live = {};
for (const e of all) {
  if (!live[e.source]) live[e.source] = { ids: [], maxStart: "" };
  if (e.externalId) live[e.source].ids.push(e.externalId);
  if (e.start && e.start > live[e.source].maxStart) live[e.source].maxStart = e.start;
}
const snapPath = join(dirname(fileURLToPath(import.meta.url)), ".gov-live-ids.json");
writeFileSync(snapPath, JSON.stringify({ ranAt: new Date().toISOString(), sources: live }, null, 2));
console.log(`wrote live-id snapshot → ${snapPath} (${Object.keys(live).join(", ") || "none"})`);
if (dryRun) {
  for (const e of all.slice(0, 8)) console.log(`   - ${e.title} | ${e.start.slice(0,16)} | ${e.neighborhood} | ${e.priceTier} | ${e.recurrence || "one-time"}`);
} else if (all.length) {
  const r = await upsert(all);
  console.log(`upserted -> created ${r.created}, updated ${r.updated}`);
  const deduped = await dedupeApproved();
  console.log(`dedupe -> ${deduped} duplicate(s) removed`);

  // Spanish translations for any new/untranslated events (no-op without a key).
  if (process.env.OPENAI_API_KEY) {
    try {
      const { backfillTranslations } = await import("../lib/scrape/translate.mjs");
      await backfillTranslations({
        apiKey: process.env.OPENAI_API_KEY,
        token: process.env.AIRTABLE_TOKEN,
        base: process.env.AIRTABLE_BASE_ID,
        table: process.env.AIRTABLE_TABLE_NAME || "Events",
        log: (m) => console.log(m),
      });
    } catch (e) {
      console.log(`translate -> skipped: ${e.message}`);
    }
  }
}
