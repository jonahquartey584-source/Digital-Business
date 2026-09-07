"""Turn a raw paste (e.g. Cowork's reply, asked to answer in CSV form) into a
clean CSV file in the inbox — no manual reformatting needed.

Expects the paste to roughly follow the column order requested in the
README's suggested Cowork prompt: title, price, bedrooms, bathrooms,
location, url, source, description, contact. It's forgiving about:
  - Markdown code fences (```...```) wrapped around the data
  - A missing header row (one is added automatically)
  - Leading/trailing blank lines and stray commentary lines Cowork adds
"""

from __future__ import annotations

import csv
import io

EXPECTED_HEADER = [
    "title", "price", "bedrooms", "bathrooms",
    "location", "url", "source", "description", "contact",
]


def _looks_like_header(line: str) -> bool:
    tokens = {t.strip().strip('"').lower() for t in line.split(",")}
    return len(tokens & set(EXPECTED_HEADER)) >= 3


def _looks_like_data_row(line: str) -> bool:
    # A real data row has commas (it's CSV) and isn't just prose commentary.
    return "," in line and not line.strip().startswith(("#", "Here", "Sure", "I found", "Note:"))


def clean_pasted_text(raw_text: str) -> str:
    """Return a valid CSV string with a header row, ready to write to inbox/."""
    lines = [ln for ln in raw_text.strip("\n").splitlines()]
    # Drop markdown code fences.
    lines = [ln for ln in lines if not ln.strip().startswith("```")]
    # Drop obviously non-data commentary lines, but keep the header if present.
    data_lines = [ln for ln in lines if ln.strip() and (_looks_like_header(ln) or _looks_like_data_row(ln))]

    if not data_lines:
        return ""

    if not _looks_like_header(data_lines[0]):
        data_lines.insert(0, ",".join(EXPECTED_HEADER))

    # Round-trip through csv to normalize quoting/line-endings.
    reader = csv.reader(data_lines)
    rows = list(reader)
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerows(rows)
    return out.getvalue()
