"""Optional: push new matches to a Google Sheet, in addition to output/matches.csv.

One-time setup (all free, no coding needed beyond editing config.yaml):

1. Go to https://console.cloud.google.com/ and create a project (or reuse one).
2. In that project, enable the "Google Sheets API" (APIs & Services -> Library).
3. Create a Service Account: IAM & Admin -> Service Accounts -> Create Service
   Account. Any name is fine, no roles needed.
4. Open the service account -> Keys -> Add Key -> Create new key -> JSON.
   This downloads a .json file — move it into this project folder, e.g. as
   `landlord-finder/service_account.json` (already gitignored, never commit it).
5. Open that JSON file and copy the "client_email" value
   (looks like xxxxx@xxxx.iam.gserviceaccount.com).
6. Create (or open) the Google Sheet you want matches written to, click
   "Share", and share it with that client_email as an Editor.
7. Copy the spreadsheet ID out of its URL:
   https://docs.google.com/spreadsheets/d/  <THIS PART>  /edit
8. In config.yaml, fill in the `google_sheets` section with `enabled: true`,
   that spreadsheet_id, a worksheet_name (e.g. "Matches"), and the path to
   the JSON key file.

Nothing here needs an Apple/Google *developer* account — a regular free
Google account is enough to create a Cloud project and a service account.
"""

from __future__ import annotations

from datetime import datetime, timezone

HEADER = [
    "Date Found", "Title", "Price", "Bedrooms", "Bathrooms",
    "Location", "Source", "URL", "Contact", "Landlord Confidence",
]


def push_new_matches(sheets_config: dict | None, new_matches: list[dict]) -> None:
    """Append newly-found matches as rows to a configured Google Sheet.

    Silently no-ops if google_sheets isn't enabled/configured, so this is
    always safe to call. Any failure (bad credentials, no network, sheet not
    shared with the service account, etc.) is printed, not raised, so it
    never breaks a `run` that otherwise succeeded locally.
    """
    if not sheets_config or not sheets_config.get("enabled"):
        return
    if not new_matches:
        return

    try:
        import gspread
    except ImportError:
        print(
            "[landlord-finder] google_sheets.enabled is true but the 'gspread' "
            "package isn't installed. Run: pip install -r requirements.txt"
        )
        return

    key_path = sheets_config.get("service_account_json")
    spreadsheet_id = sheets_config.get("spreadsheet_id")
    worksheet_name = sheets_config.get("worksheet_name", "Matches")

    if not key_path or not spreadsheet_id:
        print(
            "[landlord-finder] google_sheets is enabled but 'service_account_json' "
            "or 'spreadsheet_id' is missing in config.yaml — see sheets.py for setup steps."
        )
        return

    try:
        gc = gspread.service_account(filename=key_path)
        sh = gc.open_by_key(spreadsheet_id)
        try:
            worksheet = sh.worksheet(worksheet_name)
        except gspread.exceptions.WorksheetNotFound:
            worksheet = sh.add_worksheet(title=worksheet_name, rows=1000, cols=len(HEADER))

        if not worksheet.get_all_values():
            worksheet.append_row(HEADER)

        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        rows = [
            [
                now,
                m.get("title", ""),
                m.get("price", ""),
                m.get("bedrooms", ""),
                m.get("bathrooms", ""),
                m.get("location", ""),
                m.get("source", ""),
                m.get("url", ""),
                m.get("contact", ""),
                round(float(m.get("landlord_confidence", 0) or 0), 2),
            ]
            for m in new_matches
        ]
        worksheet.append_rows(rows, value_input_option="USER_ENTERED")
        print(f"[landlord-finder] Added {len(rows)} new match(es) to Google Sheet '{worksheet_name}'.")
    except Exception as exc:
        print(f"[landlord-finder] Failed to write to Google Sheets: {exc}")
