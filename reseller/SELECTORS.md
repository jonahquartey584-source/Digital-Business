# Fixing a browser flow when a site changes

The five browser channels (Poshmark, Depop, Mercari, Facebook Marketplace,
OfferUp) have no public listing API, so the app fills in their listing form the
way you would. That means it depends on CSS selectors, and marketplaces
redesign their forms a few times a year.

This is the maintenance cost of those channels. It's designed to be a two-minute
fix, not an afternoon.

## The flows are unverified starting points

Every flow in `src/channels/browser/flows.ts` ships with `verified: false`. The
selectors follow each site's current form structure, but they have **not** been
run against a live seller account — that requires your own login, which only
you have. Verify each channel once, then set `verified: true` for it.

## Verify a channel in four steps

```bash
# 1. save a session (a real window opens; you log in)
npm run login -- poshmark

# 2. fill the form but DON'T publish
BROWSER_DRY_RUN=1 npm start
```

3. Post an item to Poshmark from the UI. It comes back as **needs action** with
   a screenshot in `data/outbox/failures/`. Open it and check every field:
   title, description, price, photos.

4. Fix whatever didn't land (below), then flip `verified: true` in `flows.ts`
   and restart without `BROWSER_DRY_RUN`.

## Reading a failure

Every failure saves two files to `data/outbox/failures/`:

| File | Use |
| --- | --- |
| `<channel>-<time>.png` | Full-page screenshot — what the form looked like |
| `<channel>-<time>.html` | The DOM at that moment — grep it for the real selector |

The error message also names the step that failed and the selector it tried:

```
Poshmark: could not find field input[data-vv-name="title"] || input[name="title"]
```

## Finding the replacement selector

Open the site's listing form in your own browser, right-click the field →
**Inspect**, and look for something stable, in this order of preference:

1. **A test id** — `[data-testid="Name"]`, `[data-vv-name="title"]`. These are
   put there for automation and survive redesigns best.
2. **A form name** — `input[name="price"]`.
3. **An accessible label** — `input[aria-label="Title"]`, or
   `label:has-text("Price") input`. Stable because screen readers depend on it.
4. **Placeholder text** — `input[placeholder*="What are you selling" i]`.

Avoid generated class names like `.css-1x9fd2p` — those change on every deploy.

## Editing the flow

Add your selector to the **front** of the `||` list, keeping the old ones as
fallbacks. The engine tries each in order and uses the first one that becomes
visible, so an extra candidate costs nothing and covers you if the site A/B
tests two versions of the form:

```ts
{
  do: 'fill',
  selector: 'input[data-testid="ListingTitle"] || input[data-vv-name="title"] || input[name="title"]',
  value: '{{title}}',
},
```

### Step types

| Step | What it does |
| --- | --- |
| `goto` | Navigate to a URL |
| `upload` | `setInputFiles` with every photo, in order |
| `fill` | Click the field, then type the value |
| `select` | Pick a `<select>` option (by label, then by value) |
| `click` | Click the first matching element |
| `waitFor` | Wait for a selector to become visible |
| `waitForUrl` | Wait for the URL to match a regex — how we detect success |
| `press` | Press a key (`Enter`, `Escape`, …) |
| `sleep` | Fixed wait, for animations and image processing |

`optional: true` on a `click`, `fill` or `select` skips the step when the
selector isn't found, instead of failing the post. Use it for fields that only
appear for some categories.

`isSubmit: true` marks the publish button. That's the step `BROWSER_DRY_RUN=1`
stops at, so mark it correctly or your dry run will post for real.

### Template values

Any step's `value` (and `goto`'s `url`) can interpolate:

`{{title}}` `{{description}}` `{{caption}}` `{{priceAmount}}` (e.g. `145.00`)
`{{priceWhole}}` (`145`) `{{brand}}` `{{size}}` `{{color}}` `{{category}}`
`{{condition}}` `{{sku}}` `{{quantity}}`

## Watching it happen

When a screenshot isn't enough, watch the browser drive itself:

```bash
BROWSER_HEADFUL=1 BROWSER_SLOWMO_MS=300 npm start
```

Each step is logged as it runs, and `GET /api/posts/:id/logs` has the same
trace for a post that already finished.

## The parts a flow can't do

Custom dropdowns — Poshmark's category picker, Depop's size selector — are
multi-step widgets, not `<select>` elements, and they differ by category. The
shipped flows deliberately leave them alone rather than guess wrong: they fill
the text fields and photos, which is most of the typing.

If you always sell the same kind of thing, adding the two or three `click`
steps for your own category is worth doing once:

```ts
{ do: 'click', selector: 'button:has-text("Select Category")' },
{ do: 'click', selector: 'div[role="option"]:has-text("Shoes")' },
{ do: 'click', selector: 'div[role="option"]:has-text("Sneakers")' },
```

Use `BROWSER_HEADFUL=1` to see what each click needs to be.
