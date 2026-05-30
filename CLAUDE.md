# Vegas Kiddos — project guidance

Free, bright/playful resource helping **Las Vegas parents find kid-safe events**
filterable by age, price, and neighborhood. By Adam & Michelle Aragon under
Threesided Studios.

- **Live:** https://vegaskiddos.com · **Repo:** GitHub `adamaragon/vegaskiddos` (private)
- **Netlify:** site `vegaskiddos`, project id `d5375712-aa44-44a4-be14-947b942d26e7`
- **Dev port:** **3100** (`next dev -p 3100`) — port 3000 is dndcards
- **Full handoff / deep context:** `_Claude/Projects/VegasKiddos.md` in the
  Obsidian vault (`~/Dropbox/Apps/Obsidian/Obsidian Vault/`). Read it first.

## ⚠️ Working rules (read before doing anything)

1. **Deploy ONLY on explicit request.** Pushing to `main` triggers a Netlify CD
   build, and the site is near its data caps. → Commit locally, build/preview
   locally, **hold `git push` until Adam says "deploy."**
2. **After each batch, give Adam a localhost:3100 preview link** to review before
   deploying. Don't run `next build` while the dev server is up (they fight over
   `.next`); use `npx tsc --noEmit` to typecheck during a preview.
3. **Never add `Co-Authored-By: Claude`** (or any AI attribution) to commits/PRs.
4. **Autopilot:** execute multi-step tasks end-to-end; only pause for genuinely
   destructive actions (mass deletes, force-push, branch deletion).
5. **Show files/SQL inline** in chat; don't make Adam hunt for paths.
6. **Airtable, not Supabase** (Adam runs enough Supabase projects).
7. Sandbox blocks `gh`/`netlify` TLS, `git push`, localhost `listen`, and external
   API hosts (airtable/openai/resend) — run those with the sandbox disabled.

## Stack

Next.js 15 (App Router, React 19) · Tailwind v3 (desert-sunset theme: coral
`#FF6B5E` / sunny `#FFC93C` / teal `#23C4B5` / grape `#7B5EA7` / ink `#2D2A32`;
fonts Fredoka + Nunito) · plain Leaflet + markercluster (no react-leaflet —
React 19 peer issues) · Three.js hero · **Airtable as DB + admin panel** ·
Netlify host · Node 22.

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

## Deploy gotchas

- Confirm `netlify status` shows **vegaskiddos** before any CLI deploy (a stray
  `~/.netlify/state.json` can point at dndcards).
- Verify deploys: `curl vegaskiddos.com/sitemap.xml | grep -c /event/`
  (hundreds, not 12 — 12 means it fell back to seed data on an Airtable 401).
