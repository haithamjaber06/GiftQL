"""Score the parser against the hand-labelled cases in cases.json.
Run from backend/: python -m evals.run
"""
import json
import time
from pathlib import Path

from app.llm import parse_item
from app.routes.items import same

CASES = Path(__file__).parent / "cases.json"
FIELDS = ["kind", "price", "currency"]
PAUSE_SECONDS = 5  # Free-tier breathing room. Raise it if "failed" is high.


def main():
    cases = json.loads(CASES.read_text(encoding="utf-8"))

    unlabelled = [case["url"] for case in cases if case["expected"]["kind"] is None]
    if unlabelled:
        print("Label these first:", *unlabelled, sep="\n  ")
        return

    right = {field: 0 for field in FIELDS}
    misses = []
    failed = 0

    for case in cases:
        parsed = parse_item(case["url"], case["title"], case["page_text"])
        time.sleep(PAUSE_SECONDS)

        # A failed call says nothing about the prompt, so it isn't scored.
        if parsed is None:
            failed += 1
            continue

        for field in FIELDS:
            expected = case["expected"][field]
            got = getattr(parsed, field)
            if same(expected, got):
                right[field] += 1
            else:
                misses.append((case["url"], field, expected, got))

    scored = len(cases) - failed
    print(f"\nScored: {scored}   failed: {failed}\n")
    if scored == 0:
        return

    for field in FIELDS:
        print(f"{field:<10}{right[field]:>3}/{scored}  {right[field] / scored:.0%}")

    print(f"\nMisses: {len(misses)}")
    for url, field, expected, got in misses:
        print(f"  {field}: expected {expected}, got {got}  ({url})")


if __name__ == "__main__":
    main()
