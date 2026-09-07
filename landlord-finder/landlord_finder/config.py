"""Load and validate the user's config.yaml (copied from config.example.yaml)."""

from __future__ import annotations

import copy
import os
from dataclasses import dataclass, field
from typing import Any

import yaml

DEFAULT_CONFIG_PATH = "config.yaml"
EXAMPLE_CONFIG_PATH = "config.example.yaml"


class ConfigError(RuntimeError):
    pass


def _deep_merge(base: dict, override: dict) -> dict:
    merged = copy.deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


@dataclass
class Criteria:
    min_price: float = 0
    max_price: float = float("inf")
    min_bedrooms: float = 0
    max_bedrooms: float = float("inf")
    min_bathrooms: float = 0
    locations: list[str] = field(default_factory=list)
    pets_allowed: bool | None = None
    require_no_app_fee: bool = False
    exclude_keywords: list[str] = field(default_factory=list)
    include_keywords: list[str] = field(default_factory=list)
    min_landlord_confidence: float = 0.6


@dataclass
class AppConfig:
    criteria: Criteria
    notifications: dict[str, Any]
    paths: dict[str, str]
    raw: dict[str, Any]


def load_config(path: str | None = None) -> AppConfig:
    """Load config.yaml, falling back to config.example.yaml with a warning
    so the tool is still runnable out of the box."""

    candidate = path or DEFAULT_CONFIG_PATH
    used_example = False
    if not os.path.exists(candidate):
        if os.path.exists(EXAMPLE_CONFIG_PATH):
            candidate = EXAMPLE_CONFIG_PATH
            used_example = True
        else:
            raise ConfigError(
                f"No config found at '{path or DEFAULT_CONFIG_PATH}' and no "
                f"'{EXAMPLE_CONFIG_PATH}' to fall back to."
            )

    with open(candidate, "r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}

    if used_example:
        print(
            f"[landlord-finder] No config.yaml found — using {EXAMPLE_CONFIG_PATH} "
            "defaults. Copy it to config.yaml and edit your own criteria."
        )

    crit_data = data.get("criteria", {})
    criteria = Criteria(
        min_price=crit_data.get("min_price", 0),
        max_price=crit_data.get("max_price", float("inf")),
        min_bedrooms=crit_data.get("min_bedrooms", 0),
        max_bedrooms=crit_data.get("max_bedrooms", float("inf")),
        min_bathrooms=crit_data.get("min_bathrooms", 0),
        locations=[str(loc).lower() for loc in crit_data.get("locations", [])],
        pets_allowed=crit_data.get("pets_allowed"),
        require_no_app_fee=crit_data.get("require_no_app_fee", False),
        exclude_keywords=[str(k).lower() for k in crit_data.get("exclude_keywords", [])],
        include_keywords=[str(k).lower() for k in crit_data.get("include_keywords", [])],
        min_landlord_confidence=crit_data.get("min_landlord_confidence", 0.6),
    )

    paths = data.get("paths", {}) or {}
    paths.setdefault("inbox_dir", "inbox")
    paths.setdefault("output_dir", "output")
    paths.setdefault("database", os.path.join(paths["output_dir"], "listings.db"))

    return AppConfig(
        criteria=criteria,
        notifications=data.get("notifications", {"method": "desktop"}),
        paths=paths,
        raw=data,
    )
