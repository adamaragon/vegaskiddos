# Vegas Kiddos 🌵

A free, bright & playful resource that helps Las Vegas parents find safe,
age-appropriate events for their children — filterable by **age**, **price**,
and **neighborhood**, with both **list** and **map** views.

Live domain: **vegaskiddos.com**

## Tech stack

- **Next.js 15** (App Router) + **React 19**
- **Tailwind CSS** (custom desert-sunset theme)
- **Leaflet + OpenStreetMap** for the map (no API key needed)
- **Airtable** as the database **and** admin panel
- **Netlify** for hosting

## Running locally

```bash
npm install
npm run dev      # http://localhost:3000
```

With no env vars set, the app runs on built-in seed data (`lib/mock-events.ts`)
so you can develop with zero configuration.

## Connecting Airtable (database + admin)

1. Create an Airtable base with a table named **Events**.
2. Add these fields:

   | Field | Type | Notes |
   |---|---|---|
   | Title | Single line text | required |
   | Description | Long text | |
   | Venue | Single line text | required |
   | Address | Single line text | |
   | Neighborhood | Single select | `summerlin`, `henderson`, `north-lv`, `spring-valley`, `enterprise`, `downtown` |
   | Lat | Number (decimal) | for the map |
   | Lng | Number (decimal) | for the map |
   | Start | Date (incl. time) | required |
   | End | Date (incl. time) | |
   | AgeTiers | Multiple select | `baby`, `toddler`, `kids`, `tweens` |
   | PriceTier | Single select | `free`, `under10`, `mid`, `premium` |
   | PriceText | Single line text | e.g. "$8 / child" |
   | Url | URL | RSVP / source link |
   | Image | URL | optional |
   | Source | Single line text | Library / Venue / Community … |
   | Indoor | Checkbox | |
   | Approved | Checkbox | **only `Approved` records show publicly** |
   | SubmitterEmail | Email | populated by community submissions |

3. Create a [personal access token](https://airtable.com/create/tokens) with
   `data.records:read` and `data.records:write` on the base.
4. Copy `.env.example` to `.env.local` and fill in `AIRTABLE_TOKEN` and
   `AIRTABLE_BASE_ID`.

**Admin workflow:** community submissions arrive with `Approved` unchecked.
Review them in Airtable and tick `Approved` to publish. The Airtable grid view
*is* your admin panel.

## Data sources to wire up (scrapers / feeds)

Planned ingestion (each becomes a Netlify scheduled function writing to Airtable):

- **Libraries:** LVCCLD, Henderson Libraries, North Las Vegas Library (LibCal/iCal feeds)
- **Parks & Rec:** City of Las Vegas, City of Henderson, Clark County
- **Venues:** DISCOVERY Children's Museum, LV Natural History Museum, Springs Preserve, Smith Center
- **Aggregators:** Eventbrite API (LV / kids & family), Yelp Events API
- **Community:** `/submit` form (already built) → Airtable for review

## Project structure

```
app/
  page.tsx            Home — hero + filterable browser
  event/[id]/page.tsx Event detail
  submit/page.tsx     Community submission form
  about/page.tsx      About + sources
  api/submit/route.ts Submission endpoint → Airtable (Approved=false)
components/
  Header, EventCard, EventBrowser (filters + view toggle), MapView
lib/
  constants.ts        Age / price / neighborhood taxonomy
  types.ts            KidEvent shape
  data.ts             Airtable-or-seed data layer
  mock-events.ts      Seed data
```

## Roadmap

- [ ] Scheduled scrapers for each source above
- [ ] Google sign-in (NextAuth) → save / favorite events
- [ ] "Near me" geolocation sort
- [ ] Weekly email digest for subscribed parents
- [ ] iOS app (wrap or React Native)
