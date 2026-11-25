# Verifieringsregler

1. Sökträff ≠ verifierad. Endast en produktsida som faktiskt öppnats (verify.js/PW, eller FC/TV på icke-blockerad sida) kan ge VERIFIED.
2. Status per erbjudande:
   - **VERIFIED** – produktsidan öppnad i dag; modell, art.nr, pris, lager, CPU, RAM, SSD, skärm, tangentbord, OS lästa från sidan/tillverkarens datablad.
   - **PARTIALLY VERIFIED** – sidan öppnad, men något nyckelfält (t.ex. tangentbord, RAM-max) saknas eller kommer från annan källa.
   - **UNKNOWN** – fält ej angivet någonstans.
   - **NOT VERIFIED** – bara sett i sökresultat/prisjämförare.
   - **BLOCKED** – källan stoppade åtkomst (CAPTCHA/Cloudflare/403). Kringgå aldrig.
3. RAM-uppgradering: ange lödd / SO-DIMM / delvis lödd + max enligt tillverkarens datablad (PSREF för Lenovo, QuickSpecs för HP, Dell-manual, ASUS spec-sida). Källa skrivs i `ram_upgrade_note`.
4. Lager: bara det sidan visar. "I lager"/JSON-LD InStock = IN_STOCK. Annars OUT_OF_STOCK / LIMITED / UNKNOWN.
5. Köpbar (`buyable`): true endast om köpknapp syns och inte är avaktiverad. Klicka aldrig köp. Slutför aldrig köp.
6. Tangentbord: läs exakt (t.ex. "Nordiskt", "Svenskt/Finskt", "Nordic (SE/FI)", "Tyskt QWERTZ"). Saknas → UNKNOWN.
7. Pris i SEK inkl. moms. EU-butik i EUR → omräkna (ange kurs + datum), lägg till frakt.
8. Varje presenterad produkt ska ha en direktlänk till produktsidan, öppnad och bekräftad samma dag (se instructions.md 7b). Ingen länk = presenteras inte.
9. Hitta aldrig på värden. Okänt = "UNKNOWN".

## offers.json – ett objekt per erbjudande
```json
{
 "candidate_id": "MPN eller brand-model-cpu-ram-ssd-kb", "brand": "", "model": "", "mpn": "",
 "cpu": "", "ram_gb": 32, "ram_type": "", "ram_soldered": "YES|NO|PARTIAL|UNKNOWN", "ram_max_gb": 64,
 "ram_upgrade_note": "källa", "ssd_gb": 1024, "display": "14\" 1920x1200 IPS 60Hz", "keyboard": "Nordic|Swedish|US|DE|UNKNOWN",
 "os": "Windows 11 Pro", "weight_kg": 1.4,
 "retailer": "", "seller": "", "offer_id": "retailer:sku", "sku": "", "url": "",
 "price_sek": 12990, "price_orig_sek": null, "shipping_sek": 0, "stock": "IN_STOCK|LIMITED|OUT_OF_STOCK|UNKNOWN",
 "buyable": true, "condition": "NEW|OPEN_BOX|DEMO|B_GRADE|REFURB_A|REFURB_B|REFURB_C|USED",
 "battery": "", "warranty": "", "returns": "", "charger": "INCLUDED|EXCLUDED|UNKNOWN", "campaign": "",
 "verification": "VERIFIED|PARTIALLY VERIFIED|NOT VERIFIED|BLOCKED", "qualifies": "YES|SECONDARY|NO",
 "checked_at": "ISO-tid", "source": "PW|FC|TV|WS", "notes": ""
}
```
