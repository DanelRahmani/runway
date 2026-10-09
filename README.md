# Runway

**Know when your cash runs out.**

Runway is a private, browser-local cash-flow and runway forecaster for freelancers, students and
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
- **Donuts** for composition — where income comes from, what you kept, and how the outflow splits
  between spending, tax and money kept. Capped at six slices and folded to "top 5 + Other"; the
  legend carries every figure, so colour is never the only signal.
- **Stacked composition chart** — the same three parts kept apart by week or month. A donut folds
  every period into one shape, so a tax quarter and a quiet month look identical once summed.

### Editing in bulk
Every item table has a checkbox column. Tick rows and a bar appears that applies one category to the
whole selection, or deletes it after a single confirmation — with one undo for the entire set.

The bar states what the selection is worth before you touch it: a bulk change is made with the amount
in view rather than from memory of which rows were ticked. Recategorising is undoable too, not just
deleting — it is the easiest action in the app to fire by accident, and the one that used to have no
way back.

The select-all box shows a partial state when only some rows are ticked. Selection deliberately
survives filtering, so the count keeps telling the truth about what a bulk change will touch. Escape
clears the selection, matching how Escape closes a dialog.

### Savings, accounts and goals
A dedicated **Savings** tab, which reports *flows* rather than balances:

- **Set aside over the horizon** — total kept, savings rate against income, and average per month
- **Toeslagen, benefits, studiefinanciering and subsidies are income categories**, not discounts on
  the bill they cover. That is what happens to the bank account, and it keeps the savings rate honest:
  netting huurtoeslag off the rent would flatter the spending figures instead of showing income
  beside them. Dutch names are used where there is no unambiguous English one.
- **Where the money sits** — add, edit and remove savings, investment, debt or extra cash accounts,
  each with a starting balance and an optional annual rate. Editing reuses the add form rather than
  opening a second one, and keeps the account's id so transfers already pointing at it still do.
  Spendable cash and total wealth are reported separately, because cash is what decides whether you
  run out.
- **Every pot over time** — a line per account across the whole horizon, so a rate typed into a form
  becomes a curve you can read. The spending account is left off deliberately: it already has its own
  chart, and on most forecasts it swings by more across a year than the pots hold between them, which
  would flatten every growth curve into a straight line.
- **Assigned transfers are two-sided.** Tag an item as Savings, Investing, Pension or Debt repayment
  and choose which account it goes into: your spending money drops and your wealth does not, so kept
  money stops looking spent.
- **Goal tracking** — name a target with an amount and a date and Runway says whether the plan
  reaches it, cautiously. A target date beyond the horizon is reported as unknowable rather than
  optimistically "on track", and reaching the target late is reported as late.

### Currencies
Twelve: EUR, USD, GBP, CHF, SEK, NOK, DKK, PLN, CZK, CAD, AUD and JPY, each shown with its symbol in
the picker. Every currency stores 100 minor units so the arithmetic never needs a currency-specific
branch; JPY is displayed with no decimals, matching how yen is actually used.

### Recurring schedules
Weekly, fortnightly, monthly, quarterly or yearly. Monthly-style entries can be anchored either to
their start day or to **the last day of each month**. Month lengths differ, so each date is
recomputed from the month's start — which is what stops a 31st being clamped to the 28th in February
and then staying there for the rest of the year.

### Scenarios
Duplicate a forecast as a scenario, change one assumption, and compare the two on one chart with a
Base | Scenario | Difference table. Four preset questions are built in:

- Largest client pays 30 days late
- Lose a monthly client
- Hire someone for 1,500 per month
- Buy a 2,000 laptop next month

The two that name an amount state it in the forecast's own currency.

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

**Visual language.** Modern fintech: a cool neutral ground, a vivid rose accent, and depth from
layered surfaces. It began as an implementation of `DESIGN.md` from
[danelrahmani.com](https://danelrahmani.com) — warm editorial minimalism, creme cloth and maroon
thread — and was deliberately moved away from it. **The default is "match system"**; light and dark
remain real options in the header.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `bg` | `#F7F8FA` cool white | `#07080B` near-black | page ground |
| `surface` | `#FFFFFF` | `#0D0F14` | cards |
| `ink` | `#0B0D12` | `#F4F6F9` | primary text |
| `muted` | `#5B6472` | `#98A1B0` | secondary text |
| `accent` | `#E11D48` rose | `#FF4D6D` rose | identity, links, emphasis, and the alarm hue |
| `gain` | `#0D9488` teal | `#2FE0A0` mint | inflows and growth |

Hairlines are cool and neutral, and the accent carries emphasis instead. Cards take a faint top-light
gradient and rise 1px on hover, so depth is present without ever being heavy.

**Typography.** Two registers, each with one job:

| Register | Face | Used for |
| --- | --- | --- |
| Display and body | **Geist Sans** | page titles, headings, hero figures, all prose and controls |
| Label | **Geist Mono** | dates, tags, captions, table figures — capped at 0.8125rem |

A geometric grotesque with tight tracking is what this class of dashboard sets figures in; the
original Didone read as editorial rather than financial and was removed along with its font files.
Both remaining faces are self-hosted via `@fontsource-variable`, so no font is fetched from a CDN.
That is a privacy and performance choice, not an offline guarantee — see the service worker note
under limitations.

**Three decisions worth stating**, all documented in `src/index.css`:

1. **The accent is one hue doing two jobs** — identity and alarm. Primary buttons stay ink/white and
the solid accent fill is reserved for destructive actions, so a delete button is the loudest thing on
screen rather than the easiest to press by accident.
2. **Text on the bright rose fill is near-black, not white.** White on `#FF4D6D` measures 3.3:1,
which fails AA for button labels; near-black clears 6.9:1 and reads crisper on a vivid fill anyway.
In light mode the rose is dark enough that white stays the correct choice.
3. **The headline gradient deliberately avoids `color-mix`.** It is paired with `text-transparent`,
so a declaration that failed to parse would leave *invisible text* rather than a plain headline.
Every other new effect does use `color-mix`, because those degrade to "no effect" rather than
"no content".

**Motion.** Still no springs and no bounce, but there is now a real motion layer, all in CSS:

- **`.rise` / `.rise-stagger`** — entrance with an `nth-child` cascade, so a group arrives in
  sequence without inline styles or a JS timeline. Capped at six, so a long list settles instead of
  the last row arriving a beat late.
- **`.lift`** — a 1px rise and a deeper shadow on hover, rather than a uniform scale.
- **Sliding tab pill** — the active marker is measured off the active trigger and animated on
  `transform`. A `MutationObserver` catches Radix flipping `data-state` and a `ResizeObserver`
  catches the row reflowing when a label changes.
- **Counting KPI figures** — money counts to its new value over 220ms when it changes, animating in
  whole cents, and deliberately *not* on mount so the first paint is instant.
- The headline carries a slow travelling gradient; the hero has a dot grid and an accent bloom.

All of it is neutralised by the `prefers-reduced-motion` rule in the base layer.

> Deliberately no framer-motion. The motion here is bounded and declarative, which CSS covers
> without shipping a runtime animation library.

**Theme.** Light, dark and "match system" are selectable from the header. **The default is "match
system"** — the app follows the OS, and keeps following it if the setting changes mid-session. The
preference is stored in `localStorage` under `runway.theme`, and a small inline script in `index.html`
applies it before first paint so there is no flash of the wrong theme. That script also sets the
`theme-color` meta to match, so a light app never sits under dark browser chrome.

**Money is never a float.** Every amount is stored and calculated as an integer number of minor
units. Parsing goes through digit-wise logic rather than `Number(x) * 100`, and
`assertIntegerCents` throws if a fractional value ever reaches the engine. Formatting with
`Intl.NumberFormat` is the only place a division happens, and that is presentation, not accounting.

**A chart tick is a coordinate, not an amount.** Axis bounds are padded outwards to whole cents, and
tick labels go through `formatCentsTick`, which rounds. Both are needed: an explicit `domain` makes
Recharts pin ticks to its own endpoints, so a narrow range produces labels like `54320.16`, and
handing one of those to the amount formatter threw and took the page down. Amounts still assert —
only ticks round.

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
- **No live exchange rates.** Nothing is converted; a scenario preset names its amount in the
  forecast's own currency.
- **Real terms only.** There is no inflation modelling.
- **One spending account.** Account balances are modelled, but only one account is spendable, so a
  second current account cannot yet be marked as money you can actually spend from.
- **Growth is a smooth average.** Rates compound monthly at a flat rate. A real sequence has bad
  years, and a bad early year hurts more than the average implies — the UI says so wherever growth
  is shown.
- **Only assigned transfers move between accounts.** Money kept without naming an account leaves the
  spending balance and lands nowhere, because Runway will not invent an account it was not told
  about.
- **No service worker, so no true offline mode.** The page loads from the network and the browser's
  ordinary HTTP cache; the app owns no cache of its own. Close the tab with no connection and it may
  not reopen. A `vite-plugin-pwa` service worker is the upgrade path, and it needs PNG maskable
  icons alongside the existing SVG favicon.
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
2. **Invoice ageing view** — outstanding receivables bucketed by how overdue they are.
3. **Recurring item templates** — a library of common freelancer costs.
4. **Multiple spending accounts** — mark several accounts as spendable and measure the cash-out date
   across all of them.
5. **Offline install as a PWA** — a service worker so the app opens with no connection, which the
   copy currently promises but the code does not yet deliver.
6. **Multi-currency forecasts** with explicit rates.
6. **PDF summary** for sharing a forecast with an accountant.
7. **Optional end-to-end encryption plus a sync backend**, for people who want their data on more
   than one device.
8. **Baseline comparison** — import last month's actuals and compare them against the projection.

---

## License

Released under the MIT License.
