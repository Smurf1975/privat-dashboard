#!/usr/bin/env python3
"""Listar URL:er att kontrollera igen i dag: alla erbjudanden med qualifies YES/SECONDARY
i price-history/offers-latest.json + bevakningslistans URL:er (watchlist.md).
Användning: python3 recheck.py <DATUM>  -> research/<DATUM>/recheck-urls.txt"""
import json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
day = ROOT / "research" / sys.argv[1]; day.mkdir(parents=True, exist_ok=True)
EXCL = re.compile(r"blocket\.se|tradera\.com", re.I)  # uteslutna källor från 2026-11-28
urls = []
try:
    for o in json.loads((ROOT / "price-history/offers-latest.json").read_text()).values():
        if o.get("qualifies") in ("YES", "SECONDARY") and o.get("url") and o.get("stock") != "GONE" and not EXCL.search(o["url"]): urls.append(o["url"])
except FileNotFoundError: pass
urls += re.findall(r"https?://[^\s|)>\]]+", (ROOT / "watchlist.md").read_text())
urls = list(dict.fromkeys(u for u in urls if "example" not in u and not EXCL.search(u)))
(day / "recheck-urls.txt").write_text("\n".join(urls) + "\n")
print(f"{len(urls)} URL:er -> {day/'recheck-urls.txt'}")
