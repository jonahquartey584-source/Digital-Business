"""SQLite history so scheduled/repeated runs only alert you about *new* matches."""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    title TEXT,
    price REAL,
    bedrooms REAL,
    bathrooms REAL,
    location TEXT,
    url TEXT,
    source TEXT,
    contact TEXT,
    landlord_confidence REAL,
    is_match INTEGER,
    first_seen TEXT,
    last_seen TEXT
);
"""


class ListingStore:
    def __init__(self, db_path: str):
        os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
        self.conn = sqlite3.connect(db_path)
        self.conn.execute(SCHEMA)
        self.conn.commit()

    def close(self):
        self.conn.close()

    def seen_ids(self) -> set[str]:
        cur = self.conn.execute("SELECT id FROM listings")
        return {row[0] for row in cur.fetchall()}

    def upsert(self, listing: dict, confidence: float, is_match: bool):
        now = datetime.now(timezone.utc).isoformat()
        existing = self.conn.execute(
            "SELECT first_seen FROM listings WHERE id = ?", (listing["id"],)
        ).fetchone()
        first_seen = existing[0] if existing else now
        self.conn.execute(
            """
            INSERT INTO listings (id, title, price, bedrooms, bathrooms, location, url,
                                   source, contact, landlord_confidence, is_match,
                                   first_seen, last_seen)
            VALUES (:id, :title, :price, :bedrooms, :bathrooms, :location, :url,
                    :source, :contact, :confidence, :is_match, :first_seen, :last_seen)
            ON CONFLICT(id) DO UPDATE SET
                landlord_confidence=excluded.landlord_confidence,
                is_match=excluded.is_match,
                last_seen=excluded.last_seen
            """,
            {
                "id": listing["id"],
                "title": listing.get("title"),
                "price": listing.get("price"),
                "bedrooms": listing.get("bedrooms"),
                "bathrooms": listing.get("bathrooms"),
                "location": listing.get("location"),
                "url": listing.get("url"),
                "source": listing.get("source"),
                "contact": listing.get("contact"),
                "confidence": confidence,
                "is_match": int(is_match),
                "first_seen": first_seen,
                "last_seen": now,
            },
        )
        self.conn.commit()

    def all_matches(self) -> list[dict]:
        cur = self.conn.execute(
            "SELECT * FROM listings WHERE is_match = 1 ORDER BY first_seen DESC"
        )
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
