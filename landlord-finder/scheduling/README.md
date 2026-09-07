# Scheduling Landlord Finder to run on its own

This tool has no server and no app to install — it's just a Python script,
so "scheduling" it means asking your own computer's built-in scheduler to run
it periodically. Nothing here needs Apple Developer signing, an app store,
or any install step beyond Python + `pip install -r requirements.txt`.

You can still always run it on demand too:

```bash
cd landlord-finder
python -m landlord_finder.cli run
```

## macOS / Linux (cron)

1. Find the absolute path to the project and your python interpreter:
   ```bash
   cd landlord-finder && pwd          # e.g. /home/you/landlord-finder
   which python3                       # e.g. /usr/bin/python3
   ```
2. Open your crontab: `crontab -e`
3. Add a line (see `crontab.example` in this folder) — this example runs
   every day at 8am and 6pm:
   ```
   0 8,18 * * * cd /home/you/landlord-finder && /usr/bin/python3 -m landlord_finder.cli run >> output/cron.log 2>&1
   ```
4. Save and exit. Check `output/cron.log` and `output/run.log` after the
   next scheduled time to confirm it ran.

macOS note: cron notifications need Terminal (or `cron`/`launchd`) to have
Full Disk/Automation permission if you use `osascript` notifications — macOS
will prompt you the first time.

## Windows (Task Scheduler)

1. Open **Task Scheduler** → **Create Basic Task**.
2. Name it "Landlord Finder", pick a trigger (e.g. Daily, repeat every few
   hours using the trigger's "Repeat task every" option).
3. Action: **Start a program**.
   - Program/script: full path to `python.exe`
   - Add arguments: `-m landlord_finder.cli run`
   - Start in: the full path to the `landlord-finder` folder
4. Finish, then right-click the task → **Run** once to confirm it works.

## What "scheduled" actually does here

Since this tool doesn't scrape anything automatically (see the main
README for why), a scheduled run only processes whatever new files you've
dropped into `inbox/` since the last run — it re-scans the inbox, skips
listings it's already scored, and only pops a notification for genuinely
**new** matches. So the workflow is:

1. Whenever you're browsing Craigslist/Facebook/Zillow/etc. yourself, export
   or copy the listings you find into a CSV (see `inbox/example_listings.csv`
   for the format) and drop it in `inbox/`.
2. The scheduled job (or you, running it on demand) picks it up, classifies
   and filters it, and tells you about anything new that matches.
