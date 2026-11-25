#!/usr/bin/env python3
"""Länkkontroll före publicering. Öppnar VARJE produktlänk i en md-fil med riktig webbläsare
(verify.js; Firecrawl-reserv görs av Claude för FC-källor) och skriver research/<DATUM>/linkcheck.json.
Användning: python3 check_links.py <DATUM> [fil.md ...]   (standard: daily-report.md current-ranking.md)
Utskrift: OK/BLOCKED/ERROR per länk. Exit 1 om någon länk inte är OK."""
import json, re, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
date = sys.argv[1]
files = sys.argv[2:] or ["daily-report.md", "current-ranking.md"]
urls = []
for f in files:
    urls += re.findall(r"https?://[^\s|)>\]]+", (ROOT / f).read_text())
urls = list(dict.fromkeys(urls))
day = ROOT / "research" / date; day.mkdir(parents=True, exist_ok=True)
out = day / "linkcheck.json"
subprocess.run(["node", str(ROOT / "scripts/verify.js"), "--out", str(out), "--text", "3000", *urls], check=False)
res = json.loads(out.read_text())
bad = 0
for r in res:
    t = (r.get("title") or "")
    notfound = re.search(r"404|hittades inte|not found|sidan finns inte", t, re.I)
    st = "NOT_FOUND" if notfound else r.get("status")
    if st != "OK": bad += 1
    print(f"{st:9} {r.get('httpStatus')} {r['url']}  | {t[:70]}")
print(f"\n{len(res)} länkar, {bad} ej OK")
sys.exit(1 if bad else 0)
