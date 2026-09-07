"""Read manually-collected listing exports out of the inbox directory.

Since this tool doesn't scrape any site (see the README for why), you feed it
data yourself: export/copy listing details you found on Craigslist, Facebook
Marketplace, Zillow, etc. into a CSV or JSON file and drop it in `inbox/`.
See `inbox/example_listings.csv` for the expected shape — column names are
flexible (matched case-insensitively against a few aliases each).
"""

from __future__ import annotations

import glob
import hashlib
import json
import os

import pandas as pd

COLUMN_ALIASES = {
    "title": ["title", "name", "headline"],
    "price": ["price", "rent", "monthly_rent"],
    "bedrooms": ["bedrooms", "beds", "bed"],
    "bathrooms": ["bathrooms", "baths", "bath"],
    "location": ["location", "city", "neighborhood", "zip", "zipcode", "address"],
    "url": ["url", "link", "listing_url"],
    "source": ["source", "site", "platform"],
    "description": ["description", "text", "details", "body"],
    "contact": ["contact", "phone", "email", "poster"],
}


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    lower_map = {c.lower().strip(): c for c in df.columns}
    rename = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in lower_map:
                rename[lower_map[alias]] = canonical
                break
    df = df.rename(columns=rename)
    for canonical in COLUMN_ALIASES:
        if canonical not in df.columns:
            df[canonical] = ""
    return df


def _listing_id(row: dict) -> str:
    """Stable id for dedup: prefer the listing URL, else hash of title+contact+price."""
    url = str(row.get("url") or "").strip()
    if url:
        return hashlib.sha256(url.encode("utf-8")).hexdigest()
    basis = f"{row.get('title','')}|{row.get('contact','')}|{row.get('price','')}"
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()


def load_file(path: str) -> list[dict]:
    if path.lower().endswith(".json"):
        with open(path, "r", encoding="utf-8") as fh:
            records = json.load(fh)
        df = pd.DataFrame(records)
    else:
        df = pd.read_csv(path)

    if df.empty:
        return []

    df = _normalize_columns(df)
    df["full_text"] = (
        df["title"].fillna("").astype(str) + ". " + df["description"].fillna("").astype(str)
    )

    listings = []
    for _, row in df.iterrows():
        record = row.to_dict()
        record["id"] = _listing_id(record)
        record["source_file"] = os.path.basename(path)
        listings.append(record)
    return listings


def load_inbox(inbox_dir: str) -> list[dict]:
    """Load every .csv/.json file currently sitting in the inbox directory."""
    listings: list[dict] = []
    for path in sorted(glob.glob(os.path.join(inbox_dir, "*.csv"))) + sorted(
        glob.glob(os.path.join(inbox_dir, "*.json"))
    ):
        if os.path.basename(path).startswith("example_"):
            continue  # skip the bundled template
        try:
            listings.extend(load_file(path))
        except Exception as exc:  # keep going even if one file is malformed
            print(f"[landlord-finder] Skipping '{path}' — could not parse: {exc}")
    return listings
