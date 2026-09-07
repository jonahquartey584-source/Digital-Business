# Landlord Finder

A small local "computer assistant" that reads real-estate listings you've
collected, tells private landlords apart from property-management
companies/agencies using a text classifier, filters everything against your
own criteria (price, bedrooms, location, pets, keywords...), and alerts you
only about **new** matches — on demand, or on a schedule.

## Why this isn't a downloadable app

You mentioned not having an Apple Developer account — good news: you don't
need one, because this isn't a Mac app bundle at all. It's a plain Python
command-line tool. There's nothing to code-sign, notarize, or submit to any
store. You just install Python once and run a script, on macOS, Windows, or
Linux, the same way.

## Why it doesn't scrape Craigslist/Facebook/Zillow for you

Automatically scraping those sites was considered, but Craigslist, Facebook
Marketplace, and Zillow/Realtor.com all prohibit automated
scraping in their Terms of Service, and Facebook/Zillow have no public API
for this kind of data either. Building a scraper for personal use is still a
ToS violation and can get accounts/IPs blocked, so instead this tool takes
listing data **you** hand it — you stay the one browsing and deciding what's
worth exporting, and the tool does the tedious classification/filtering
afterward. If you'd rather have live automated pulling, the safe path is an
official data source (e.g. a paid MLS/rental-listing API) — say the word and
this can be adapted to pull from one.

## How it works

```
inbox/*.csv, *.json  →  ingest & normalize  →  classify (private landlord vs
                                                agency) → filter by your
                                                criteria → dedupe against
                                                history → notify + report
```

1. **You export/collect** listings into a CSV or JSON file (columns like
   title, price, bedrooms, bathrooms, location, url, description, contact —
   see `inbox/example_listings.csv`) and drop the file into `inbox/`.
2. **Classifier**: a TF-IDF + Logistic Regression model (`scikit-learn`),
   trained on `data/labeled_examples.csv`, blended with a transparent
   regex-based heuristic (phrases like "no agents", "property management",
   "leasing office", "application fee"), scores each listing's likelihood of
   being a private landlord vs. an agency/property manager.
3. **Filters**: your `config.yaml` criteria (price range, bedroom/bathroom
   range, allowed locations, pet policy, required/excluded keywords, minimum
   landlord-confidence) decide what counts as a match.
4. **History (SQLite)**: every listing is remembered by ID (URL, or a hash of
   title+contact+price if there's no URL), so re-running only reports
   listings that are new since last time.
5. **Notify**: new matches trigger a desktop notification (Linux
   `notify-send`, macOS `osascript`, Windows PowerShell balloon tip) and,
   optionally, an email if you fill in SMTP settings in `config.yaml`.
   Everything is also written to `output/matches.csv` and `output/run.log`,
   and optionally appended as rows to a Google Sheet (see below).

### Restricting to specific sites (`allowed_sources`)

If you only want listings you found on certain sites, set `allowed_sources`
in `config.yaml` (e.g. `["spareroom", "gumtree", "openrent"]`) — it's matched
case-insensitively against the `source` column in your inbox file, so tag
each row with where you found it.

### Using Cowork (or any live search) as the "finder"

This tool doesn't browse the web itself (see above). If you already ask
Claude Cowork to search sites live and it replies with results, you can feed
that straight in without manually reformatting it:

1. Ask Cowork something like:
   > Search SpareRoom, Gumtree, and OpenRent for private-landlord (not
   > agency) rental listings: studio to 2-bed flats, Zone 1 or 2 London,
   > rent £1,200+. For each one, give me a CSV row with these exact
   > columns: title, price, bedrooms, bathrooms, location, url, source,
   > description, contact
2. Save its reply as a plain text file, e.g. `raw.txt`.
3. Run:
   ```bash
   python -m landlord_finder.cli import-paste raw.txt --run
   ```
   This strips out commentary and markdown code fences, adds a header row
   if Cowork left one out, saves a clean CSV into `inbox/`, and (with
   `--run`) immediately classifies, filters, dedupes, notifies, and pushes
   to Google Sheets — same as a normal `run`. Drop `--run` to just import
   without processing yet.

### Google Sheets output

Set `google_sheets.enabled: true` in `config.yaml` to also append every new
match as a row in a Google Sheet you own, alongside the local CSV. This
needs a one-time, free setup (a Google Cloud service account — no developer
account, no cost): full step-by-step instructions are in the docstring at
the top of `landlord_finder/sheets.py`.

## Setup

```bash
cd landlord-finder
python3 -m venv .venv && source .venv/bin/activate   # optional but recommended
pip install -r requirements.txt

cp config.example.yaml config.yaml
# edit config.yaml with your price range, locations, etc.

python -m landlord_finder.cli train     # builds data/model.joblib from data/labeled_examples.csv
```

## Running it

**On demand**, any time you like:

```bash
python -m landlord_finder.cli run
```

**On a schedule**, so it checks the inbox automatically (e.g. every morning
and evening) and pops a notification when something new matches — see
`scheduling/README.md` for cron (macOS/Linux) and Task Scheduler (Windows)
setup. You can freely mix both: schedule it for routine checks and still run
it manually whenever you've just dropped in a fresh export.

**See everything matched so far:**

```bash
python -m landlord_finder.cli list-matches
```

## Improving the classifier over time

`data/labeled_examples.csv` is a starter set of ~40 example listing snippets
labeled `owner` or `agency`. As you see real listings get mis-classified,
add a row for them (the real text, the correct label) and re-run:

```bash
python -m landlord_finder.cli train
```

The more real examples you add, the more accurate it gets for the phrasing
actually used in your market.

## Project layout

```
landlord_finder/
  config.py      # loads & validates config.yaml
  classifier.py  # ML + rule-based private-landlord scoring
  ingest.py      # reads inbox/*.csv|*.json into a normalized shape
  filters.py     # applies your criteria to each listing
  store.py       # SQLite history for dedup across runs
  notify.py      # desktop + optional email notifications
  cli.py         # `train` / `run` / `list-matches` commands
data/
  labeled_examples.csv  # seed training data (edit/extend this)
  model.joblib           # trained model (generated, gitignored)
inbox/           # drop your exported listing CSV/JSON files here
output/          # matches.csv, run.log, listings.db (generated, gitignored)
scheduling/      # cron / Task Scheduler setup instructions
config.example.yaml  # copy to config.yaml and edit your criteria
```

## Limitations / honesty check

- This tool is only as good as the data you feed it — it does not fetch
  anything from the internet on its own.
- The classifier is a lightweight starter model; treat its confidence score
  as a helpful signal; skim the listing text yourself before contacting anyone.
- Always double-check anyone you contact — "private landlord" language in a
  listing is not proof of legitimacy; watch for common rental scam patterns
  (wiring money before viewing, "I'm out of the country" stories, prices far
  below market).
