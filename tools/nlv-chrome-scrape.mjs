// Attach to Chrome on :9222, scrape NLV library calendar, upsert to Airtable.
import puppeteer from "puppeteer";
import { readFileSync, existsSync } from "node:fs";
import { sanitizeDescription } from "../lib/scrape/sanitize-description.mjs";

const CAL =
  "https://www.cityofnorthlasvegas.com/things-to-do/libraries/about-us/library-calendar";
const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";
const dryRun = process.argv.includes("--dry");
const SOURCE = "NLV Libraries";

const BRANCH = {
  "alexander library": { venue: "Alexander Library", address: "1755 W Alexander Rd, North Las Vegas, NV 89032" },
  "aliante library": { venue: "Aliante Library", address: "2400 W Deer Springs Way, North Las Vegas, NV 89084" },
  "city hall library": { venue: "City Hall Library", address: "2250 Las Vegas Blvd N, North Las Vegas, NV 89030" },
};

const KID = /\b(kid|kids|child|children|family|families|toddler|baby|babies|infant|storytime|story time|preschool|pre-?k|little learners|youth|tween|teen|lego|stem|steam|craft|crafts|puppet|read|reading|sing|playgroup|splash|cafe)\b/i;
const ADULT = /\b(21\+|18\+|city council|public hearing|board meeting|computer workshop|book club|job |resume|citizenship|esl for adults|adults? only)\b/i;

function kidRelevant(t) {
  if (ADULT.test(t) && !KID.test(t)) return false;
  return KID.test(t);
}
function classifyAges(t) {
  t = t.toLowerCase();
  const a = [];
  if (/\bbab(y|ies)\b|infant|lapsit/.test(t)) a.push("baby");
  if (/toddler|pre-?k|preschool|little learners/.test(t)) a.push("toddler");
  if (/\bkids?\b|child|children|youth|cafe|steam|stem|family/.test(t)) a.push("kids");
  if (/teen|tween/.test(t)) a.push("tweens");
  return a;
}
function parseTime(s) {
  const m = (s || "").match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i);
  if (!m) return "09:00";
  let h = +m[1];
  const mi = m[2] || "00";
  if (/p/i.test(m[3]) && h !== 12) h += 12;
  if (/a/i.test(m[3]) && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${mi}`;
}

function loadEnv() {
  const home = process.env.HOME || "";
  const files = [
    ".env.local",
    "SECRETS.local.md",
    `${home}/Dropbox/Apps/Obsidian/Obsidian Vault/_Claude/Memory/VegasKiddos-Secrets.md`,
  ];
  for (const p of files) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*(AIRTABLE_TOKEN|AIRTABLE_BASE_ID|AIRTABLE_TABLE_NAME|OPENAI_API_KEY)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

async function extractList(page) {
  return page.evaluate(() => {
    const out = [];
    for (const item of document.querySelectorAll(".vi-events-tiles-item")) {
      const a = item.querySelector("a.vi-events-tiles-link, a[href*='/Calendar/Event/']");
      const href = a?.href || "";
      const title = (item.querySelector(".vi-events-tiles-title")?.textContent || "").replace(/\s+/g, " ").trim();
      const time = (item.querySelector(".vi-events-tiles-time")?.textContent || "").replace(/\s+/g, " ").trim();
      const startEl = item.querySelector('time[itemprop="startDate"]');
      const endEl = item.querySelector('time[itemprop="endDate"]');
      const startIso = startEl?.getAttribute("datetime") || "";
      const endIso = endEl?.getAttribute("datetime") || "";
      const hiddenDate = (startEl?.textContent || "").trim();
      const dateM = (time + " " + hiddenDate).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      const isoDay = (startIso.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || "";
      const cats = [...item.querySelectorAll(".vi-events-tiles-category")].map((c) => c.textContent.trim());
      const desc = (item.querySelector(".vi-events-tiles-desc")?.textContent || "").replace(/\s+/g, " ").trim();
      const times = [...time.matchAll(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?)/gi)].map((x) => x[1]);
      const idM = href.match(/Event\/(\d+)/i);
      const branch =
        cats.find((c) => /^(alexander|aliante|city hall) library$/i.test(c)) ||
        cats.find((c) => /library/i.test(c) && !/events/i.test(c)) ||
        "";
      if (!title) continue;
      out.push({
        title,
        date: isoDay || (dateM ? `${dateM[3]}-${dateM[1].padStart(2, "0")}-${dateM[2].padStart(2, "0")}` : ""),
        startTime: times[0] || "",
        endTime: times[1] || "",
        startIso,
        endIso,
        branch,
        cats,
        desc,
        href,
        id: idM ? idM[1] : "",
      });
    }
    return out;
  });
}

async function gotoUpcoming(page) {
  const dest =
    "https://www.cityofnorthlasvegas.com/things-to-do/libraries/about-us/library-calendar/-toggle-allupcoming";
  await page.goto(dest, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".vi-events-tiles-item", { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 1500));
  console.log(`calendar view: ${page.url()}`);
}

async function paginate(page, collect) {
  const all = [...collect];
  for (let i = 0; i < 20; i++) {
    const next = await page.evaluate(() => {
      const a = document.querySelector("a.pg-next-button");
      if (!a || /disabled/i.test(a.className) || a.getAttribute("aria-disabled") === "true") {
        return false;
      }
      a.click();
      return true;
    });
    if (!next) break;
    const prevUrl = page.url();
    try {
      await page.waitForFunction(
        (u) => location.href !== u && document.querySelectorAll(".vi-events-tiles-item").length > 0,
        { timeout: 8000 },
        prevUrl
      );
    } catch {
      await new Promise((r) => setTimeout(r, 2500));
    }
    const batch = await extractList(page);
    console.log(`page ${i + 2}: ${batch.length} tiles`);
    if (!batch.length) break;
    all.push(...batch);
  }
  return all;
}

function normalize(raw) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const events = [];
  const seen = new Set();
  const skipped = { noDate: 0, adult: 0, past: 0, dup: 0 };
  for (const r of raw) {
    const title = (r.title || "").replace(/\s+/g, " ").trim();
    if (!title || !r.date) {
      skipped.noDate++;
      continue;
    }
    const blob = `${title} ${r.branch} ${r.desc || ""}`;
    if (!kidRelevant(blob)) {
      skipped.adult++;
      continue;
    }
    const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : "";
    if (!date || date < today) {
      skipped.past++;
      continue;
    }
    const branch = BRANCH[(r.branch || "").toLowerCase()] || {
      venue: r.branch || "North Las Vegas Library",
      address: "North Las Vegas, NV",
    };
    const ext = `nlv:${r.id || title}:${date}`;
    if (seen.has(ext)) {
      skipped.dup++;
      continue;
    }
    seen.add(ext);
    events.push({
      externalId: ext,
      title: title.slice(0, 120),
      description: sanitizeDescription(r.desc || ""),
      venue: branch.venue,
      address: branch.address,
      neighborhood: "north-lv",
      start: `${date}T${parseTime(r.startTime)}:00-07:00`,
      end: r.endTime ? `${date}T${parseTime(r.endTime)}:00-07:00` : undefined,
      ageTiers: classifyAges(blob),
      priceTier: "free",
      url: r.href || CAL,
      source: SOURCE,
    });
  }
  console.log(
    `normalize: kept ${events.length}  skipped no-date ${skipped.noDate} adult ${skipped.adult} past ${skipped.past} dup ${skipped.dup}`
  );
  if (raw[0]) console.log(`sample: ${raw[0].title}  date=${raw[0].date}  ${raw[0].startTime}`);
  return events;
}

const WD = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function collapse(events) {
  const groups = new Map();
  for (const e of events) {
    const k = `${e.source}|${e.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${(e.venue || "").toLowerCase()}`;
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

async function upsert(events) {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || "Events";
  if (!token || !base) throw new Error("AIRTABLE_TOKEN / AIRTABLE_BASE_ID required");
  let created = 0, updated = 0;
  for (let i = 0; i < events.length; i += 10) {
    const records = events.slice(i, i + 10).map((e) => {
      const f = {
        Title: e.title,
        Venue: e.venue,
        Address: e.address,
        Start: e.start,
        AgeTiers: e.ageTiers,
        Source: e.source,
        ExternalId: e.externalId,
        Neighborhood: e.neighborhood,
        PriceTier: e.priceTier,
        ScrapedAt: new Date().toISOString(),
      };
      if (e.url) f.Url = e.url;
      if (e.end) f.End = e.end;
      const description = sanitizeDescription(e.description);
      if (description.trim().length >= 15) f.Description = description;
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

loadEnv();
const browser = await puppeteer.connect({ browserURL: CDP, defaultViewport: null });
const pages = await browser.pages();
let page = pages.find((p) => /library-calendar/i.test(p.url()));
if (!page) {
  page = await browser.newPage();
  await page.goto(CAL, { waitUntil: "domcontentloaded", timeout: 60000 });
}
console.log(`using tab ${page.url()}`);
await gotoUpcoming(page);
let raw = await extractList(page);
console.log(`page 1: ${raw.length} tiles`);
raw = await paginate(page, raw);
const events = collapse(normalize(raw));
console.log(`kid-relevant after collapse: ${events.length}`);
for (const e of events) {
  console.log(`  - ${e.start.slice(0, 16)}  ${e.venue.padEnd(22)}  ${e.title}${e.recurrence ? `  [${e.recurrence}]` : ""}`);
}
if (dryRun) {
  console.log("(dry run, no Airtable write)");
} else if (events.length) {
  const r = await upsert(events);
  console.log(`upserted → created ${r.created}, updated ${r.updated}`);
} else {
  console.log("nothing to upsert");
}
await browser.disconnect();
