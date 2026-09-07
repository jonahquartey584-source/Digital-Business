"""Apply the user's config.yaml criteria to a normalized listing + its classifier score."""

from __future__ import annotations

from .config import Criteria


def _to_float(value, default=None):
    try:
        if value in (None, ""):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def matches_criteria(listing: dict, confidence: float, criteria: Criteria) -> tuple[bool, list[str]]:
    """Returns (is_match, reasons_rejected). Empty reasons list means it matched."""
    reasons = []
    text = (listing.get("full_text") or "").lower()
    location = str(listing.get("location") or "").lower()

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

    if criteria.locations and not any(loc in location for loc in criteria.locations):
        reasons.append("location not in allow-list")

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
