# Vegas Kiddos — project guidance

Free, bright/playful resource helping **Las Vegas parents find kid-safe events**
filterable by age, price, and neighborhood. By Adam & Michelle Aragon under
Threesided Studios.

- **Live:** https://vegaskiddos.com · **Repo:** GitHub `adamaragon/vegaskiddos` (private)
- **Host: Cloudflare Workers** (OpenNext). Worker name `vegaskiddos`,
  account `Adam@threesided.com's Account`. Worker URL:
  `https://vegaskiddos.threesided.workers.dev`. The R2 bucket
  `vegaskiddos-cache` backs the Next incremental cache; `img.vegaskiddos.com`
  is a separate R2 bucket (`vegaskiddos-media`) for synced event images.
  **NOT Netlify** — the site moved fully off Netlify (all Netlify config,
  packages, and the old scheduled scrape function have been removed); pushing
  to `main` does NOT auto-deploy. The Cloudflare R2 sync is what actually moves
  images to production.
- **Dev port:** **3100** (`next dev -p 3100`) — port 3000 is dndcards
- **Full handoff / deep context:** `_Claude/Projects/VegasKiddos.md` in the
  Obsidian vault (`~/Dropbox/Apps/Obsidian/Obsidian Vault/`). Read it first.

## ⚠️ Working rules (read before doing anything)

1. **Deploy = push to `main` (auto CI), or `npm run cf:deploy` manually.**
   GitHub Actions auto-deploy on push to `main` is **enabled and working**
   (fixed 2026-07-13). Both paths run the same `opennextjs-cloudflare build →
   deploy`, which pre-warms the R2 incremental cache (`open-next.config.ts` →
   `r2IncrementalCache`) via Cloudflare's R2 API. That fetch used to die with
   "Premature close" on **GitHub-hosted runners** — root cause was **no working
   IPv6 route to `api.cloudflare.com`** on the runners (OpenNext's fetch client
   reaches for IPv6 and doesn't fall back to IPv4 the way plain fetch/curl do;
   it was never the token — the R2-capable secret returns `200` off-runner and
   via `curl -4` on-runner). **The fix** is the `Pin api.cloudflare.com to IPv4`
   step in `deploy.yml` (writes the host's current IPv4 into `/etc/hosts` before
   the deploy) — **do not remove it** or CI breaks again. Bot image-sync commits
   carry `[skip ci]`, so they don't trigger a deploy. **Manual deploy still
   works any time** (off-runner it never had the IPv6 problem): `export` CF +
   `AIRTABLE_*` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, then `npm run cf:deploy`. (CF
   has no build/data caps, so frequent deploys are fine — the old Netlify
   "deploy only on request" rule is retired.)
2. **After each batch, give Adam a localhost:3100 preview link** to review before
   deploying. Don't run `next build` (or `npm run cf:deploy`) while the dev
   server is up — they fight over `.next` → 500s. Use `npx tsc --noEmit` to
   typecheck during a preview. Kill the dev server before any deploy build.
3. **Never add `Co-Authored-By: Claude`** (or any AI attribution) to commits/PRs.
4. **Autopilot:** execute multi-step tasks end-to-end; only pause for genuinely
   destructive actions (mass deletes, force-push, branch deletion).
5. **Show files/SQL inline** in chat; don't make Adam hunt for paths.
6. **Airtable, not Supabase** (Adam runs enough Supabase projects).
7. Sandbox blocks `gh` TLS, `git push`, `wrangler`, localhost `listen`, and
   external API hosts (airtable/openai/resend/cloudflare) — run those with
   the sandbox disabled.

## Stack

Next.js 15 (App Router, React 19) · Tailwind v3 (desert-sunset theme: coral
`#FF6B5E` / sunny `#FFC93C` / teal `#23C4B5` / grape `#7B5EA7` / ink `#2D2A32`;
fonts Fredoka + Nunito) · plain Leaflet + markercluster (no react-leaflet —
React 19 peer issues) · Three.js hero · **Airtable as DB + admin panel** ·
**Cloudflare Workers host (OpenNext)** · Node 22.

## Data

- Airtable base `appJu8YZ63WNHMPhF` ("Vegas Kiddos — Events"). Only `Approved=1`
  shows publicly. `lib/data.ts` reads Airtable (else `lib/mock-events.ts` seeds);
  `getEvents(lang)` is `cache()`-wrapped, `revalidate:600`.
- Taxonomy in `lib/constants.ts`: ages baby/toddler/kids/tweens; prices
  free/under10/mid/premium; 6 neighborhoods.
- Secrets: `.env.local` (gitignored) + `SECRETS.local.md` (gitignored). Actual
  values also in vault `Memory/VegasKiddos-Secrets.md`.

## Event images (AI art + R2)

- `tools/gen-event-art.mjs` generates on-brand illustrations (OpenAI gpt-image-1)
  into the Airtable `ArtImage` attachment. `subjectFor()` maps title/description
  keywords → an illustration subject (17+ categories: storytime, art, music,
  ice cream, …). Add a new category by adding a `[regex, subject]` row **near the
  top** of the map (first match wins). Daily cron only generates for events with
  no image at all; `--ids rec1,rec2` regenerates specific events on demand.
- **Gotcha — uploads APPEND:** Airtable's `uploadAttachment` adds to the field,
  and `lib/data.ts` reads attachment `[0]`. So when regenerating art for an event
  that **already has** an ArtImage (e.g. via `--ids`), CLEAR the field first
  (`PATCH ArtImage: []`) or the new image lands second and is ignored.
- `tools/sync-images.mjs` resizes each event's image to WebP widths and uploads
  to R2 (`vegaskiddos-media`), served at `img.vegaskiddos.com/event/<id>/<w>.webp`.
  Idempotent via `tools/.image-sync-manifest.json` (keyed on attachment id).
  Runs as the last step of the daily scrape; trigger standalone with the **Sync
  images to R2** workflow (`workflow_dispatch`, `.github/workflows/sync-images.yml`).
- **Gotcha — immutable edge cache:** R2 images are served `cache-control:
  immutable, max-age=1yr`. Overwriting an image at the same key leaves Cloudflare's
  edge serving the OLD copy for up to a year. `lib/data.ts` therefore appends
  `?v=<hash of the image's identity>` to every image URL (and `lib/imageLoader.ts`
  preserves that query when swapping responsive widths), so a regenerated/reassigned
  image gets a fresh cache key automatically. Don't strip the `?v=`.

## SEO collection pages

`lib/collections.ts` defines dynamic filtered "guide" feeds, each with its own
URL + meta, rendered by `components/CollectionView.tsx` and auto-added to
`app/sitemap.ts` + footer. To add one: append a `Collection` (slug, title,
heading, description, emoji, predicate) and create `app/<slug>/page.tsx` mirroring
an existing one (e.g. `app/beat-the-heat/page.tsx`). `/es` versions and hreflang
come for free via `middleware.ts`.

## Deploy (Cloudflare Workers via OpenNext)

```bash
# One-time per shell: export CF creds (token in vault Hermes-Keys.md)
export CLOUDFLARE_API_TOKEN=<token>
export CLOUDFLARE_ACCOUNT_ID=7f5f54b5b6d1f046e6025bfcc4053982

# Stop the dev server first (they fight over .next), then:
npm run cf:deploy
```

This runs `opennextjs-cloudflare build` → `opennextjs-cloudflare deploy`
(uses `wrangler.jsonc` → Worker `vegaskiddos` → `vegaskiddos.com`). Worker
secrets (AIRTABLE_TOKEN, AUTH_SECRET, RESEND_API_KEY, etc.) live in CF
dashboard, not in this repo — already set on the production Worker.

Verify the deploy:
```bash
curl -s https://vegaskiddos.com/ | grep -o "WeatherPill\|hero-canvas" | sort -u
curl -s https://vegaskiddos.com/sitemap.xml | grep -c /event/   # hundreds, not 12
```
(12 means it fell back to seed data on an Airtable 401.)

Cache: production HTML is `s-maxage=55120, stale-while-revalidate=2592000`,
so repeat visitors may see stale HTML for a bit after a deploy. New visitors
or hard reloads get the fresh deploy immediately.

## Other gotchas

- **Deploy CI is live again (see Working rule #1).** `.github/workflows/deploy.yml`
  runs on push to `main` (+ `workflow_dispatch`). It was paused 2026-06-27→07-13
  because the R2 cache pre-warm failed with "Premature close" on the runner. That
  turned out to be a **network** problem, not the token: GH runners can't reach
  `api.cloudflare.com` over IPv6, and OpenNext's fetch client won't fall back to
  IPv4. The `Pin api.cloudflare.com to IPv4` step fixes it. Diagnose future CI
  issues with `gh run view <id> --log` (via the git-credential token); note the
  deploy step's full tail only shows in the **raw** job log
  (`gh api repos/adamaragon/vegaskiddos/actions/jobs/<jobid>/logs`), not always
  in `--log`.
- **Native Cloudflare Workers Build git-trigger:** if a *separate* "deploy
  failed" email still appears, disconnect it (CF dashboard → vegaskiddos →
  Settings → Builds). The Workers-Builds API isn't reachable with the standard
  CF API token, so this stays a dashboard step.
