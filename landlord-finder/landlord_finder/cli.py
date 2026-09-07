"""Command-line entry point.

Usage:
    python -m landlord_finder.cli train
    python -m landlord_finder.cli run [--config config.yaml]
    python -m landlord_finder.cli list-matches [--config config.yaml]
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from datetime import datetime, timezone

from . import classifier as classifier_mod
from .config import ConfigError, load_config
from .filters import matches_criteria
from .ingest import load_inbox
from .notify import notify_new_matches
from .store import ListingStore


def cmd_train(args) -> int:
    summary = classifier_mod.train()
    print(f"[landlord-finder] {summary}")
    return 0


def cmd_run(args) -> int:
    try:
        config = load_config(args.config)
    except ConfigError as exc:
        print(f"[landlord-finder] {exc}", file=sys.stderr)
        return 1

    inbox_dir = config.paths["inbox_dir"]
    output_dir = config.paths["output_dir"]
    os.makedirs(output_dir, exist_ok=True)

    listings = load_inbox(inbox_dir)
    if not listings:
        print(f"[landlord-finder] No listing files found in '{inbox_dir}/'. "
              "Drop a CSV or JSON export there (see inbox/example_listings.csv) and re-run.")
        return 0

    clf = classifier_mod.Classifier.load()
    store = ListingStore(config.paths["database"])
    already_seen = store.seen_ids()

    new_matches = []
    all_results = []
    for listing in listings:
        confidence = clf.score(listing.get("full_text", ""))
        is_match, reasons = matches_criteria(listing, confidence, config.criteria)
        listing["landlord_confidence"] = confidence
        listing["is_match"] = is_match
        listing["reject_reasons"] = "; ".join(reasons)
        store.upsert(listing, confidence, is_match)
        all_results.append(listing)
        if is_match and listing["id"] not in already_seen:
            new_matches.append(listing)

    store.close()

    # Write a full report every run (all listings evaluated this run).
    report_path = os.path.join(output_dir, "matches.csv")
    fieldnames = [
        "title", "price", "bedrooms", "bathrooms", "location", "source",
        "url", "contact", "landlord_confidence", "is_match", "reject_reasons",
    ]
    write_header = not os.path.exists(report_path)
    with open(report_path, "a", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
        if write_header:
            writer.writeheader()
        for listing in all_results:
            if listing["is_match"]:
                writer.writerow(listing)

    log_path = os.path.join(output_dir, "run.log")
    with open(log_path, "a", encoding="utf-8") as fh:
        fh.write(
            f"{datetime.now(timezone.utc).isoformat()} evaluated={len(all_results)} "
            f"matches={sum(1 for l in all_results if l['is_match'])} "
            f"new_matches={len(new_matches)}\n"
        )

    print(f"[landlord-finder] Evaluated {len(all_results)} listing(s) from '{inbox_dir}/'.")
    print(f"[landlord-finder] {sum(1 for l in all_results if l['is_match'])} matched your criteria, "
          f"{len(new_matches)} are new since last run.")
    print(f"[landlord-finder] Full match report: {report_path}")

    if new_matches:
        notify_new_matches(config.notifications, new_matches)
        for m in new_matches:
            print(f"  NEW MATCH: {m.get('title')} | ${m.get('price')} | {m.get('location')} "
                  f"| confidence={m.get('landlord_confidence'):.2f} | {m.get('url')}")

    return 0


def cmd_list_matches(args) -> int:
    try:
        config = load_config(args.config)
    except ConfigError as exc:
        print(f"[landlord-finder] {exc}", file=sys.stderr)
        return 1
    store = ListingStore(config.paths["database"])
    matches = store.all_matches()
    store.close()
    if not matches:
        print("[landlord-finder] No matches recorded yet. Run `run` first.")
        return 0
    for m in matches:
        print(f"- {m['title']} | ${m['price']} | {m['location']} | "
              f"confidence={m['landlord_confidence']:.2f} | first seen {m['first_seen']} | {m['url']}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="landlord-finder")
    sub = parser.add_subparsers(dest="command", required=True)

    p_train = sub.add_parser("train", help="(Re)train the private-landlord classifier")
    p_train.set_defaults(func=cmd_train)

    p_run = sub.add_parser("run", help="Process the inbox, filter, dedupe, and notify on new matches")
    p_run.add_argument("--config", default=None, help="Path to config.yaml (default: ./config.yaml)")
    p_run.set_defaults(func=cmd_run)

    p_list = sub.add_parser("list-matches", help="List every match found so far")
    p_list.add_argument("--config", default=None, help="Path to config.yaml (default: ./config.yaml)")
    p_list.set_defaults(func=cmd_list_matches)

    return parser


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
