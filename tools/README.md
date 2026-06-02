# tools/

One-off and scheduled Node scripts (ESM, no deps beyond Node 22 + `fetch`).
Each loads `.env.local` automatically for local runs. Scheduled ones also run
in GitHub Actions using repo **secrets**.

## Required env / secrets

| Var | Used by |
|---|---|
| `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID` | everything |
| `OPENAI_API_KEY` | `translate-backfill`, `gov-scrape` (auto-translate), `gen-event-art`, `fill-blank-descriptions`, `infer-ages` |
| `RESEND_API_KEY`, `DIGEST_FROM` | `send-digest`, `send-reminders` (email channel) |
| `FB_PAGE_ID`, `FB_PAGE_TOKEN` | `fb-post` (compose-only if unset) |
| `VAPID_PUBLIC_KEY`/`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `send-reminders` (web push) |

## Scripts

| Script | npm | What it does |
|---|---|---|
| `gov-scrape.mjs` | — | Headless-browser scraper for JS gov calendars → Airtable review queue. Auto-translates new events, then runs the three enrichers below. Runs daily via `gov-scrape.yml`. |
| `translate-backfill.mjs` | `translate` | Backfills `TitleEs`/`DescriptionEs` (OpenAI). Idempotent — only fills empty. |
| `fill-blank-descriptions-cli.ts` | `fill-descriptions` | Generates grounded bilingual descriptions for events that arrive blank (e.g. Henderson gov, Nevada Moms). Logic in `lib/scrape/fill-descriptions.ts`; also runs inside `runScrape` before auto-publish. Upserts omit empty descriptions so AI text is not wiped. `--dry`. Idempotent. |
| `geocode-events.mjs` | `geocode` | Backfills missing `Lat`/`Lng` via OSM Nominatim (metro-bounded, no key) so events map. `--dry`, `--limit n`. Idempotent. |
| `infer-ages.mjs` | `infer-ages` | Tags missing `AgeTiers` from title+description (gpt-4o-mini). `--dry`. Idempotent. |
| `send-reminders.mjs` | `send-reminders` | Daily: notifies subscribers about favorited events happening tomorrow via web push + email. `--dry`. Runs via `reminders.yml` (5pm PT). |
| `ensure-reminders-table.mjs` | `ensure-reminders-table` | Creates the `Reminders` table (push/email subscriptions). Idempotent. |
| `send-digest.mjs` | — | Weekly email digest (Resend), per-subscriber language. Preview-writes HTML if no `RESEND_API_KEY`. Runs Thu via `weekly-digest.yml`. |
| `fb-post.mjs` | `fb-post` | Facebook Page posting. Modes: `daily` \| `roundup` \| `schedule [n]` \| `verify`. `--dry-run`, `--force`. Crons in `fb-post.yml` (self-pause until `RESUME_AFTER`). |
| `fb-repair-posts.mjs` | `fb-repair` / `fb-repair-audit` | Find event link posts with missing or generic OG previews; `repair` deletes, refreshes FB cache, and reposts. GH workflow modes `repair` / `repair-audit`. |
| `gen-event-art.mjs` | `gen-art` | AI event artwork (OpenAI) → `ArtImage` attachment. Modes: `sample [n]` \| `batch [--limit n]`, `--dry-run`. Run via `gen-art.yml`. |
| `make-social.mjs` | — | Renders the Facebook cover/profile brand graphics (Puppeteer) → `assets/social/`. |
| `check-links.mjs` | `check-links` | Report-only dead-link checker for event source URLs. `--json`; exits 2 if dead links found. |
| `ensure-subscriber-lang.mjs` | `ensure-sub-lang` | Creates the `Lang` field on Subscribers (idempotent). |
| `ensure-fb-fields.mjs` | `ensure-fb-fields` | Creates the `FBPostedAt` field on Events (FB dedup). |
| `ensure-art-field.mjs` | `ensure-art-field` | Creates the `ArtImage` attachment field on Events. |

The `ensure-*` scripts are run-once setup helpers — safe to re-run.
