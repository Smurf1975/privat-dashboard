#!/usr/bin/env python3
"""Laptop Radar – historikmotor.

Läser dagens erbjudanden (research/<DATUM>/offers.json), jämför med historiken
och skriver:
  price-history/observations.csv   – en rad per erbjudande och körning (append)
  price-history/candidates.json    – en post per underliggande laptop (upsert)
  price-history/offers-latest.json – senaste kända läge per erbjudande
  research/<DATUM>/changes.json + changes.md – vad som faktiskt ändrats

Användning:  python3 record.py <DATUM> [--dry-run]
Identitet:
  candidate_id = tillverkarens art.nr (MPN) i gemener, annars
                 brand-model-cpu-ram-ssd-keyboard (normaliserat)
  offer_id     = retailer + ':' + (butikens SKU eller URL)
Samma laptop i flera butiker = EN kandidat med flera erbjudanden.
"""
import csv, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PH = ROOT / "price-history"
OBS = PH / "observations.csv"
CANDS = PH / "candidates.json"
LATEST = PH / "offers-latest.json"
FIELDS = ["date", "candidate_id", "offer_id", "retailer", "seller", "sku", "mpn", "model",
          "price_sek", "price_orig_sek", "shipping_sek", "stock", "buyable", "condition",
          "campaign", "keyboard", "qualifies", "verification", "url", "source"]
CAND_FIELDS = ["brand", "model", "mpn", "cpu", "ram_gb", "ram_type", "ram_soldered", "ram_max_gb",
               "ram_upgrade_note", "ssd_gb", "display", "keyboard", "os", "weight_kg", "notes"]
PRICE_ABS, PRICE_PCT = 300, 0.03


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s or "").lower()).strip("-")


def cand_id(o):
    if o.get("candidate_id"):
        return slug(o["candidate_id"])
    if o.get("mpn"):
        return slug(o["mpn"])
    return slug("-".join(str(o.get(k, "")) for k in ["brand", "model", "cpu", "ram_gb", "ssd_gb", "keyboard"]))


def offer_id(o):
    return o.get("offer_id") or f"{slug(o.get('retailer'))}:{o.get('sku') or o.get('url')}"


def load_json(p, default):
    try:
        return json.loads(p.read_text())
    except Exception:
        return default


def num(x):
    try:
        return float(str(x).replace(" ", "").replace(" ", "").replace(",", "."))
    except Exception:
        return None


def main():
    if len(sys.argv) < 2:
        sys.exit("Användning: record.py <YYYY-MM-DD> [--dry-run]")
    date, dry = sys.argv[1], "--dry-run" in sys.argv
    day = ROOT / "research" / date
    offers = load_json(day / "offers.json", None)
    if offers is None:
        sys.exit(f"Saknar eller ogiltig {day/'offers.json'}")
    cands = load_json(CANDS, {})
    latest = load_json(LATEST, {})
    changes, rows, seen = [], [], set()

    for o in offers:
        cid, oid = cand_id(o), offer_id(o)
        o["candidate_id"], o["offer_id"] = cid, oid
        if oid in seen:
            continue  # dubblett inom samma körning
        seen.add(oid)
        status = o.get("verification", "NOT VERIFIED")
        # kandidat
        if cid not in cands:
            cands[cid] = {k: o.get(k) for k in CAND_FIELDS}
            cands[cid].update(first_seen=date, offers=[])
            if o.get("qualifies") in ("YES", "SECONDARY"):
                changes.append(dict(type="NEW_CANDIDATE", candidate_id=cid, offer_id=oid))
        else:
            for k in CAND_FIELDS:  # fyll i luckor, skriv aldrig över verifierad data med tomt
                if o.get(k) not in (None, "", "UNKNOWN") and cands[cid].get(k) in (None, "", "UNKNOWN"):
                    cands[cid][k] = o[k]
        if oid not in cands[cid]["offers"]:
            cands[cid]["offers"].append(oid)
        cands[cid]["last_seen"] = date
        # erbjudande-diff
        prev = latest.get(oid)
        p_new = num(o.get("price_sek"))
        if status in ("BLOCKED", "ERROR"):
            pass
        elif prev is None:
            if cid in cands and cands[cid].get("first_seen") != date and o.get("qualifies") in ("YES", "SECONDARY"):
                changes.append(dict(type="NEW_OFFER", candidate_id=cid, offer_id=oid, price=p_new))
        else:
            p_old = num(prev.get("price_sek"))
            if p_new is not None and p_old is not None and p_new != p_old:
                d = p_new - p_old
                if abs(d) >= PRICE_ABS or abs(d) / p_old >= PRICE_PCT:
                    changes.append(dict(type="PRICE_DROP" if d < 0 else "PRICE_RISE", candidate_id=cid,
                                        offer_id=oid, old=p_old, new=p_new, diff=d))
            if (prev.get("stock") or "").upper() != (o.get("stock") or "").upper():
                changes.append(dict(type="STOCK_CHANGE", candidate_id=cid, offer_id=oid,
                                    old=prev.get("stock"), new=o.get("stock")))
            for k in ("condition", "warranty", "campaign"):
                if (prev.get(k) or "") != (o.get(k) or "") and o.get(k):
                    changes.append(dict(type=f"{k.upper()}_CHANGE", candidate_id=cid, offer_id=oid,
                                        old=prev.get(k), new=o.get(k)))
        # lägsta kända pris
        best = cands[cid].get("best_price_sek")
        if p_new is not None and status not in ("BLOCKED", "ERROR") and (best is None or p_new < best):
            if best is not None:
                changes.append(dict(type="NEW_BEST_PRICE", candidate_id=cid, offer_id=oid, old=best, new=p_new))
            cands[cid]["best_price_sek"], cands[cid]["best_price_date"], cands[cid]["best_price_offer"] = p_new, date, oid
        if status not in ("BLOCKED", "ERROR"):
            latest[oid] = {**o, "date": date}
        rows.append({k: o.get(k, "") for k in FIELDS} | {"date": date, "price_sek": p_new if p_new is not None else ""})

    # försvunna: senast sedda i en tidigare körning men inte bland dagens kontrollerade erbjudanden
    checked_retailers = {slug(o.get("retailer")) for o in offers if o.get("verification") not in ("BLOCKED", "ERROR")}
    for oid, prev in list(latest.items()):
        if oid in seen or prev.get("date") == date:
            continue
        if slug(prev.get("retailer")) in checked_retailers and prev.get("stock") != "GONE" \
                and prev.get("qualifies") in ("YES", "SECONDARY"):
            changes.append(dict(type="DISAPPEARED_OR_NOT_RECHECKED", candidate_id=prev.get("candidate_id"),
                                offer_id=oid, last_seen=prev.get("date"), last_price=prev.get("price_sek")))

    md = [f"# Förändringar {date}", ""]
    if not changes:
        md.append("Inga meningsfulla förändringar enligt historikmotorn.")
    for c in changes:
        md.append("- " + c["type"] + ": " + ", ".join(f"{k}={v}" for k, v in c.items() if k != "type"))

    if dry:
        print("\n".join(md))
        return
    PH.mkdir(exist_ok=True)
    new_file = not OBS.exists()
    with OBS.open("a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        if new_file:
            w.writeheader()
        w.writerows(rows)
    CANDS.write_text(json.dumps(cands, ensure_ascii=False, indent=1))
    LATEST.write_text(json.dumps(latest, ensure_ascii=False, indent=1))
    (day / "changes.json").write_text(json.dumps(changes, ensure_ascii=False, indent=1))
    (day / "changes.md").write_text("\n".join(md) + "\n")
    print("\n".join(md))
    print(f"\n{len(rows)} observationer, {len(cands)} kandidater totalt, {len(changes)} förändringar.")


if __name__ == "__main__":
    main()
