# Runway

**Know when your cash runs out.**

Runway is a private, offline-first cash-flow and runway forecaster for freelancers, students and
small-business owners. Set a starting balance, add what actually moves money in and out, and see a
day-by-day projection of your balance — including the date it goes negative, and what happens when
one assumption changes.

It is deliberately *not* an accounting app. There are no ledgers, no categories to reconcile and no
tax rules. It answers one question fast: **based on my expected income and expenses, when will my
cash run out?**

> Runway provides estimates for planning purposes only and is not financial advice.

---

## Features

### Two kinds of forecast

Runway starts by asking *what* you are forecasting, because a household and a business do not keep
the same books:

| | Personal | Business |
| --- | --- | --- |
| Starter items | Salary, rent, groceries, utilities, transport, savings | Retainer, office rent, software, accountant, tax provision, insurance |
| Invoices | none — households do not raise them | expected client invoices with payment delays |
| Typical squeeze | an unplanned repair against a thin buffer | an under-provisioned tax bill landing mid-year |

The kind is a label that shapes defaults and grouping — it changes nothing about the maths. You
choose it when you create a forecast, can switch it afterwards from the **Assumptions** tab, filter
by it on the home page, and it survives export and import. Forecasts created before the field
existed simply show no kind.

Each kind has a **starter**: a full, editable forecast with typical items and clearly-labelled
placeholder amounts. Both starters deliberately contain a shortfall so the tool demonstrates the
thing it is for — the personal one dips for a fortnight and recovers, the business one runs out in
July and stays out.

### Forecast setup
- Name, starting balance, start date and notes
- Currency: **EUR** (default), **USD**, **JPY**
- Horizon: **13 weeks**, **6 months** or **12 months**

### What moves your cash
- **Recurring items** — weekly, biweekly, monthly, quarterly or yearly, with an optional end date,
  category and note, plus an active/inactive toggle
- **One-off items** — a single dated event (a laptop, a bonus, an annual tax bill)
- **Invoices** — client, amount, issue date, expected payment date, a payment-delay allowance in
  days, a status (expected / paid / cancelled) and optional monthly or quarterly recurrence

The projection always uses **expected payment date + delay**. A late payer shows up as a real gap in
the curve, because that is what actually happens to your cash.

### Reading the forecast
- **KPI cards:** starting balance, projected ending balance, minimum projected balance, cash-out
  date (or "no projected shortfall"), total inflows, total outflows
- **Balance chart** — the area below the zero line is painted red, the lowest point is marked, and
  the zero line is always drawn
- **Daily / weekly / monthly** toggle for both the chart and the table
- **Cash-flow table** — opening balance, inflows, outflows, net movement and closing balance per
  period, downloadable as CSV

### Scenarios
Duplicate a forecast as a scenario, change one assumption, and compare the two on one chart with a
Base | Scenario | Difference table. Four preset questions are built in:

- Largest client pays 30 days late
- Lose a monthly client
- Hire someone for €1,500 per month
- Buy a €2,000 laptop next month

### Your data
- Everything is stored locally in **IndexedDB**
- Export one forecast or all of them as JSON
- Import JSON via file picker or drag-and-drop, with a preview and a **merge** or **replace** mode
- Export the projection as CSV at daily, weekly or monthly granularity
- Clear all local data, behind a confirmation

---

## Tech stack

| Concern | Choice |
| --- | --- |
| Build tool | Vite 8 |
| UI | React 19, TypeScript (strict), Tailwind CSS 4, shadcn/ui on Radix |
| Routing | React Router 7 (client-side, lazy-loaded routes) |
| Validation | Zod 4 |
| Persistence | Dexie 4 over IndexedDB |
| Charts | Recharts 3 |
| Tests | Vitest 5 |
| Hosting | Vercel (static) |

There is **no backend**. No API routes, no server actions, no database, no authentication, no
analytics.

---

## Local development

Requires **Node.js 20 or newer**.

```bash
git clone https://github.com/<your-account>/runway.git
cd runway
npm install
npm run dev
```

Vite serves the app at <http://localhost:5173>.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Typecheck, then build the static site into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run typecheck` | `tsc --noEmit` across `src/` and `tests/` |
| `npm run lint` | ESLint over the whole project |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

---

## Environment variables

**None are required.** Runway is a static site with no server-side configuration and no secrets. The
only value a deployment might want is the canonical URL used in `index.html` for SEO tags; change
`<link rel="canonical">` and the `og:url` meta tag there if you deploy to a custom domain.

---

## Testing

```bash
npm run test
```

The suite (`tests/`) covers the two pieces where a silent bug would be costly:

**`forecast-engine.test.ts`** — weekly, biweekly, monthly (across 28-, 29-, 30- and 31-day months),
quarterly and yearly recurrence; month-end clamping and the *absence* of drift; invoice payment
delay; negative-balance detection and the first shortfall date; scenario comparison; aggregation
reconciliation; and integer-cent arithmetic (including the `0.1 + 0.2` and `19.99 × 100` traps).

**`backup.test.ts`** — JSON export/import round trips, schema rejection of malformed files, import
collision resolution, CSV escaping and filename generation.

The engine is pure — no React, no Dexie, no browser APIs, no clock — so the tests need no mocks and
no DOM.

---

## Build

```bash
npm run build
```

This runs `tsc --noEmit` first, so a type error fails the build rather than shipping. The output is a
fully static site in `dist/`: `index.html`, one CSS file and a handful of JS chunks. Routes are
lazily loaded, keeping the landing page small.

Preview the production output with:

```bash
npm run preview
```

---

## Deploying to Vercel

### Option A — dashboard

1. Push the repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Vercel detects Vite. Confirm the settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Install command:** `npm install`
4. Deploy. No environment variables are needed.

`vercel.json` is included, so these settings are applied automatically and client-side routes are
rewritten to `index.html` — refreshing on `/forecast/<id>` or `/compare` works instead of 404ing.

### Option B — CLI

```bash
npm install -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

### Custom subdomain

In **Project → Settings → Domains**, add the domain (for example `runway.example.com`) and create
the CNAME record Vercel shows you. Then update the canonical URL in `index.html` so search engines
and social previews point at the real host.

---

## How export and import work

### Export

Two buttons on the **Data** tab (or the standalone **Data** page):

- **Export this forecast** → `runway-forecast-{name}-{YYYY-MM-DD}.json`
- **Export all forecasts** → `runway-all-forecasts-{YYYY-MM-DD}.json`

The file is a versioned envelope:

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-10-09T13:00:00.000Z",
  "app": "runway",
  "forecasts": []
}
```

The payload is validated against the same Zod schema the app uses before download, so a corrupt
export fails loudly rather than producing a file that cannot be restored.

### Import

Drop a file onto the import area or choose one. Runway then:

1. Parses the JSON and validates **every** forecast against the schema.
2. Shows a **preview** — how many forecasts, their names, and the count of recurring items, one-off
   items, invoices and scenarios.
3. Asks how to apply it:
   - **Merge** (default) — keeps everything already stored. Any id or name that clashes is added
     under a fresh one, and the rename is reported.
   - **Replace** — deletes your existing forecasts first, behind an extra warning.
4. Reports exactly what happened.

An invalid file is refused as a whole, with the reason. Nothing is written until you confirm.

### CSV

The projection exports as `runway-{name}-{granularity}-{YYYY-MM-DD}.csv` with columns: period start,
period end, opening balance, inflows, outflows, net change, closing balance. Amounts are formatted in
the forecast currency and properly escaped, so a spreadsheet opens the file correctly.

---

## Privacy

**All data stays in your browser.** Runway has no server, no accounts, no cookies and no analytics.
Every forecast, item and invoice you enter lives in your browser's IndexedDB, on your device, and is
never transmitted anywhere.

The only things kept in `localStorage` are UI preferences: the theme, and nothing financial.

The consequence is that your data is only on the device and browser profile you used. Clearing site
data, or opening the app in a different browser, means starting fresh — which is why the JSON export
exists. **Export a backup before clearing your browser data or switching devices.**

---

## Project structure

```text
src/
  main.tsx                 entry point
  App.tsx                  routes (lazy-loaded) and 404
  index.css                Tailwind 4 theme tokens, light and dark
  routes/                  Home, Forecast, Compare, Data
  components/
    ui/                    shadcn/ui primitives on Radix
    layout/                AppShell, ThemeToggle, ErrorBoundary, Disclaimer
    forecast/              KPI cards, tabs, save indicator, comparison logic
    forms/                 forecast, item and invoice forms; money input
    charts/                balance chart and comparison chart
  hooks/
    useForecastEditor.ts   editable draft plus debounced autosave
  lib/
    money.ts               integer-cent arithmetic and currency formatting
    dates.ts               UTC-safe ISO calendar date helpers
    validation.ts          Zod schemas for every persisted shape
    csv.ts                 CSV escaping and download
    sample.ts              the sample forecast
    forecast/
      engine.ts            the pure projection engine
      recurrence.ts        occurrence generation
      aggregate.ts         daily → weekly/monthly folding
      scenarios.ts         presets and comparison
    storage/
      db.ts                Dexie schema and the in-memory fallback
      forecasts.ts         CRUD, the observable cache, autosave
      backup.ts            JSON export/import and CSV filenames
  types/
    forecast.ts            domain types
tests/
  forecast-engine.test.ts
  backup.test.ts
```

---

## Design notes

**Visual language.** Runway implements `DESIGN.md` from
[danelrahmani.com](https://danelrahmani.com): warm editorial minimalism with an atelier thread —
creme cloth, maroon thread, engraved-label typography.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `bg` | `#FDFBF6` creme | `#0F090E` aubergine-black | page ground |
| `ink` | `#1C1917` stone-900 | `#F4EFEA` warm white | primary text |
| `muted` | `#57534E` stone-600 | `#A8A29E` stone-400 | secondary text |
| `accent` | `#4A0E0E` maroon | `#D43D55` raspberry | thread, links, seams, emphasis |
| `accent-hover` | `#6B1515` | `#E8566A` | hover states |
| `seam` | `rgba(74,14,14,.15)` | `rgba(212,61,85,.18)` | hairline rules |

Hairlines are tinted toward the accent rather than neutral grey, and shadows are maroon-tinted in
light mode and raspberry-tinted in dark. Cards are flat — depth is a seam and a background tint,
never elevation, and never a uniform scale on hover.

**Typography.** Three registers, each with one job:

| Register | Face | Used for |
| --- | --- | --- |
| Display | **Bodoni Moda** | page titles, section headings, the wordmark, and hero figures |
| Body / UI | **Geist Sans** | everything read as prose or used as a control |
| Label | **Geist Mono** | dates, tags, captions, table figures — capped at 0.8125rem |

Geist Mono is the "woven label" register and is never body copy or a display size, which is why the
large figures in the KPI cards and the hero use Bodoni instead. All three faces are self-hosted via
`@fontsource-variable`, so nothing is fetched from a CDN and the app still renders correctly offline.

**Two deliberate departures from the source palette**, both documented in `src/index.css`:

1. **The accent is the alarm hue.** In this palette maroon and raspberry are both the identity thread
   and the colour of blood, so the accent carries links, seams, the wordmark *and* negative money.
   Primary buttons therefore stay ink rather than accent, which keeps the solid accent fill reserved
   for destructive actions and stops a delete button reading as the main call to action.
2. **A sage green is introduced for gains** (`#3D6B4A` light, `#82B892` dark). The source palette has
   no "healthy" hue, and without one inflow and outflow would be indistinguishable.

Contrast was checked against WCAG AA at each step: ink on creme is 16.9:1, muted is 7.4:1, maroon on
creme is 14.9:1. Raspberry `#D43D55` measures 4.3:1 on aubergine-black — just under AA for body text
— so dark mode uses the lighter `#E8566A` (5.6:1) for text while fills, rings and seams keep the
specified raspberry.

**Motion.** Low energy — "barely seen, perfectly finished". Transitions are 200ms `ease-out`
(cubic-bezier 0.22, 1, 0.36, 1), links draw an accent underline from the left, and cards respond with
a tint and a hairline rather than a transform. There are no springs and no bounce. Every animation has
a `prefers-reduced-motion` alternative.

> This is implemented with CSS transitions rather than framer-motion. The brief calls for motion that
> is barely seen, which CSS covers without shipping a runtime animation library; if entrances or
> orchestrated sequences are added later, framer-motion is the intended tool.

**Theme.** Light, dark and "match system" are selectable from the header. The preference is stored in
`localStorage` under `runway.theme`, and a small inline script in `index.html` applies it before first
paint so there is no flash of the wrong theme. In "system" mode the app follows the OS and keeps
following it if the setting changes mid-session.

**Money is never a float.** Every amount is stored and calculated as an integer number of minor
units. Parsing goes through digit-wise logic rather than `Number(x) * 100`, and
`assertIntegerCents` throws if a fractional value ever reaches the engine. Formatting with
`Intl.NumberFormat` is the only place a division happens, and that is presentation, not accounting.

**Dates are calendar dates, not instants.** Forecast dates are `YYYY-MM-DD` strings handled purely
through `Date.UTC` and `getUTC*`, so a rent payment cannot shift by a day because of a timezone.

**Recurrence steps from a fixed anchor.** A monthly item anchored to the 31st lands on 28 February
and then back on 31 March — it does not clamp once and stay clamped for the rest of the year.

**The engine is pure.** It takes a forecast and returns a projection: no React, no storage, no clock,
no randomness. The same forecast always produces the same numbers, which is what makes scenario
comparison meaningful.

---

## Known limitations

- **Single device.** Data lives in the browser. There is no sync and no account — move data between
  devices with JSON export/import.
- **One currency per forecast.** Multi-currency cash flow would need exchange-rate assumptions.
- **No live exchange rates.** Scenario presets are euro-denominated and are not converted.
- **Real terms only.** There is no inflation modelling.
- **No drill-down by category.** `category` is captured on items but only used in the assumptions
  summary.
- **Scenarios are full forecasts.** A scenario is a separate stored forecast linked to its base, not
  a lightweight overlay, so each one costs a row.
- **Forecasts are recalculated on the client.** Fine up to a few hundred items; a very large forecast
  would be worth memoising further.
- **No PDF report.** CSV and JSON only.
- **Yen is stored at two decimal places** like the other currencies so the arithmetic stays uniform;
  it is displayed with none, matching how yen is actually used.

---

## Suggested next features

1. **Sensitivity table** — ending balance and cash-out date across a range of one assumption (for
   example payment delay from 0 to 90 days).
2. **Category breakdown chart** — where the money actually goes.
3. **Invoice ageing view** — outstanding receivables bucketed by how overdue they are.
4. **Recurring item templates** — a library of common freelancer costs.
5. **Multi-currency forecasts** with explicit rates.
6. **PDF summary** for sharing a forecast with an accountant.
7. **Optional end-to-end encryption plus a sync backend**, for people who want their data on more
   than one device.
8. **Baseline comparison** — import last month's actuals and compare them against the projection.

---

## License

Released under the MIT License.
