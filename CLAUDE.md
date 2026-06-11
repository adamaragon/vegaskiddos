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

1. **Deploy ONLY on explicit request.** Deploys are manual via
   `npm run cf:deploy` (OpenNext build → `wrangler deploy`). Needs
   `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` env vars (token in
   vault `Logins & Passwords/Hermes-Keys.md ## Cloudflare`). Pushing to
   `main` does NOT deploy on its own — no Cloudflare GH Actions workflow
   exists yet. → Commit + push freely; hold `npm run cf:deploy` until Adam
   says "deploy."
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

- No auto-deploy on `git push`. If you want one, add a `.github/workflows/
  cf-deploy.yml` that runs `npm run cf:deploy` with the existing
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` GH secrets.
