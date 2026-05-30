# tools/

One-off and scheduled Node scripts (ESM, no deps beyond Node 22 + `fetch`).
Each loads `.env.local` automatically for local runs. Scheduled ones also run
in GitHub Actions using repo **secrets**.

## Required env / secrets

| Var | Used by |
|---|---|
| `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID` | everything |
| `OPENAI_API_KEY` | `translate-backfill`, `gov-scrape` (auto-translate), `gen-event-art` |
| `RESEND_API_KEY`, `DIGEST_FROM` | `send-digest` (preview-only if unset) |
| `FB_PAGE_ID`, `FB_PAGE_TOKEN` | `fb-post` (compose-only if unset) |

## Scripts

| Script | npm | What it does |
|---|---|---|
| `gov-scrape.mjs` | — | Headless-browser scraper for JS gov calendars → Airtable review queue. Auto-translates new events. Runs daily via `gov-scrape.yml`. |
| `translate-backfill.mjs` | `translate` | Backfills `TitleEs`/`DescriptionEs` (OpenAI). Idempotent — only fills empty. |
| `send-digest.mjs` | — | Weekly email digest (Resend), per-subscriber language. Preview-writes HTML if no `RESEND_API_KEY`. Runs Thu via `weekly-digest.yml`. |
| `fb-post.mjs` | `fb-post` | Facebook Page posting. Modes: `daily` \| `roundup` \| `schedule [n]` \| `verify`. `--dry-run`, `--force`. Crons in `fb-post.yml` (self-pause until `RESUME_AFTER`). |
| `gen-event-art.mjs` | `gen-art` | AI event artwork (OpenAI) → `ArtImage` attachment. Modes: `sample [n]` \| `batch [--limit n]`, `--dry-run`. Run via `gen-art.yml`. |
| `make-social.mjs` | — | Renders the Facebook cover/profile brand graphics (Puppeteer) → `assets/social/`. |
| `check-links.mjs` | `check-links` | Report-only dead-link checker for event source URLs. `--json`; exits 2 if dead links found. |
| `ensure-subscriber-lang.mjs` | `ensure-sub-lang` | Creates the `Lang` field on Subscribers (idempotent). |
| `ensure-fb-fields.mjs` | `ensure-fb-fields` | Creates the `FBPostedAt` field on Events (FB dedup). |
| `ensure-art-field.mjs` | `ensure-art-field` | Creates the `ArtImage` attachment field on Events. |

The `ensure-*` scripts are run-once setup helpers — safe to re-run.
