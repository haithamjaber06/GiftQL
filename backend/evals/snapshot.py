"""Save each page in urls.txt to cases.json, ready to label by hand.
Run from backend/: python -m evals.snapshot
"""
import json
from pathlib import Path

from app.scraper import fetch_meta

HERE = Path(__file__).parent
URLS = HERE / "urls.txt"
CASES = HERE / "cases.json"


def main():
    # Keep what's already saved, so re-running never overwrites your labels.
    cases = json.loads(CASES.read_text(encoding="utf-8")) if CASES.exists() else []
    saved = {case["url"] for case in cases}

    for line in URLS.read_text(encoding="utf-8").splitlines():
        url = line.strip()
        if not url or url.startswith("#") or url in saved:
            continue

        title, _, page_text = fetch_meta(url)
        if not page_text:
            print("Skipped, no text:", url)
            continue

        cases.append({
            "url": url,
            "title": title,
            "page_text": page_text,
            "expected": {"kind": None, "price": None, "currency": None},
        })
        print("Saved:", url)

    CASES.write_text(json.dumps(cases, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{len(cases)} case(s) in {CASES.name}")


if __name__ == "__main__":
    main()
