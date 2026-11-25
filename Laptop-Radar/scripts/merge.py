#!/usr/bin/env python3
"""Slår ihop research/<DATUM>/agent-*.json till offers.json.
Validerar fält, tar bort dubbletter (samma offer_id: VERIFIED > PARTIALLY > övrigt, sedan senaste checked_at).
Användning: python3 merge.py <DATUM>"""
import json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
RANK = {"VERIFIED": 3, "PARTIALLY VERIFIED": 2, "NOT VERIFIED": 1, "UNKNOWN": 1, "BLOCKED": 0, "ERROR": 0}
REQ = ["brand", "model", "retailer", "url", "price_sek", "verification", "qualifies"]
def slug(s): return re.sub(r"[^a-z0-9]+", "-", str(s or "").lower()).strip("-")
day = ROOT / "research" / sys.argv[1]
out, warn = {}, []
for f in sorted(day.glob("agent-*.json")):
    try:
        data = json.loads(f.read_text())
    except Exception as e:
        warn.append(f"{f.name}: ogiltig JSON ({e})"); continue
    for o in data:
        miss = [k for k in REQ if o.get(k) in (None, "")]
        if miss: warn.append(f"{f.name}: {o.get('model')} saknar {miss}")
        o.setdefault("offer_id", f"{slug(o.get('retailer'))}:{o.get('sku') or o.get('url')}")
        o["_file"] = f.name
        k = o["offer_id"]; p = out.get(k)
        if p is None or (RANK.get(o.get("verification"), 0), o.get("checked_at", "")) > (RANK.get(p.get("verification"), 0), p.get("checked_at", "")):
            out[k] = o
offers = list(out.values())
(day / "offers.json").write_text(json.dumps(offers, ensure_ascii=False, indent=1))
print(f"{len(offers)} unika erbjudanden -> {day/'offers.json'}")
for w in warn: print("VARNING:", w)
