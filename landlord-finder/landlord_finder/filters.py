"""Apply the user's config.yaml criteria to a normalized listing + its classifier score."""

from __future__ import annotations

import re

from .config import Criteria

# A short token like "n1" or "sw4" (postcode-district style) is matched as a
# whole word, not a bare substring — otherwise "n1" would wrongly match inside
# "n19" or "e1" inside "e17". A plain name like "islington" still matches as
# a substring anywhere in the location text.
_POSTCODE_TOKEN = re.compile(r"^[a-z]{1,2}\d{1,2}[a-z]?$")


def _to_float(value, default=None):
    try:
        if value in (None, ""):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _location_matches(location_filters: list[str], location_text: str) -> bool:
    if not location_filters:
        return True
    for loc in location_filters:
        if _POSTCODE_TOKEN.match(loc):
            if re.search(rf"\b{re.escape(loc)}\b", location_text):
                return True
        elif loc in location_text:
            return True
    return False


def matches_criteria(listing: dict, confidence: float, criteria: Criteria) -> tuple[bool, list[str]]:
    """Returns (is_match, reasons_rejected). Empty reasons list means it matched."""
    reasons = []
    text = (listing.get("full_text") or "").lower()
    location = str(listing.get("location") or "").lower()
    source = str(listing.get("source") or "").lower()

    price = _to_float(listing.get("price"))
    if price is not None:
        if price < criteria.min_price:
            reasons.append(f"price {price} below min {criteria.min_price}")
        if price > criteria.max_price:
            reasons.append(f"price {price} above max {criteria.max_price}")

    beds = _to_float(listing.get("bedrooms"))
    if beds is not None:
        if beds < criteria.min_bedrooms:
            reasons.append(f"bedrooms {beds} below min {criteria.min_bedrooms}")
        if beds > criteria.max_bedrooms:
            reasons.append(f"bedrooms {beds} above max {criteria.max_bedrooms}")

    baths = _to_float(listing.get("bathrooms"))
    if baths is not None and baths < criteria.min_bathrooms:
        reasons.append(f"bathrooms {baths} below min {criteria.min_bathrooms}")

    if not _location_matches(criteria.locations, location):
        reasons.append("location not in allow-list")

    if criteria.allowed_sources and source not in criteria.allowed_sources:
        reasons.append(f"source '{source}' not in allowed sources {criteria.allowed_sources}")

    if criteria.pets_allowed is True and "no pets" in text:
        reasons.append("listing says no pets")

    if criteria.require_no_app_fee and "no application fee" not in text and "application fee" in text:
        reasons.append("listing charges an application fee")

    if criteria.exclude_keywords and any(kw in text for kw in criteria.exclude_keywords):
        hit = next(kw for kw in criteria.exclude_keywords if kw in text)
        reasons.append(f"contains excluded keyword '{hit}'")

    if criteria.include_keywords and not any(kw in text for kw in criteria.include_keywords):
        reasons.append("missing a required include keyword")

    if confidence < criteria.min_landlord_confidence:
        reasons.append(
            f"landlord confidence {confidence:.2f} below threshold {criteria.min_landlord_confidence}"
        )

    return (len(reasons) == 0, reasons)
