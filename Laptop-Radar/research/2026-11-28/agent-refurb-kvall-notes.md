# Refurb-segment – extra kvällskörning 2026-11-28

Underlag: raw-refurb-kvall-1…5.json (Playwright), Firecrawl (Reuseit, maxAge 0), Shopify-flöden (Looptop, Nuvoo s.1–5).
Kända erbjudanden i price-history/offers-latest.json har inte verifierats om.

## Källstatus
| Källa | Status | Kommentar |
|---|---|---|
| Looptop | OK | products.json + /products/<handle>.js (available=true) + produktsida PW |
| Inrego | OK | 32 GB-filter: 8 produkter; P14s G4 (12 499) och Precision 3490 (9 999) syns inte längre i listan |
| Reuseit | OK via FC | Kategorisida + 2 produktsidor |
| Refurbed.se | OK | Sök + produkt-/offer-sidor |
| Nuvoo | OK | Flöde s.1–5; inga nya starka 32 GB (bara Latitude 7440 outlet 32/256 9 350, X1C10 'Utmärkt' 10 071) |
| Begagnad.se | FEL 520 (Cloudflare origin error) | Ett försök, 19:11 UTC |
| Back Market | BLOCKED (Cloudflare "Utför säkerhetsverifiering") | Ett försök, inte kringgått |

## Nya verifierade erbjudanden (8)
| # | Modell | Konfig | KB | Pris | Butik | Kval |
|---|---|---|---|---|---|---|
| 1 | Dell Precision 5570 | i7-12700H / 32 DDR5 (2×SODIMM, max 64) / 480 / 15,6" 1920×1200 | Svenskt | 8 499 | Inrego | SECONDARY (480 GB) |
| 2 | Dell Latitude 7430 touch | i7-1265U / 32 / 1 TB | Svensk | 10 215 | Refurbed (Rnew, PL) | YES |
| 3 | Dell Latitude 7430 touch | i7-1265U / 32 / 512 | Svensk | 8 238,60 (BF −8 %) | Refurbed (Rnew, PL) | SECONDARY |
| 4 | Dell Latitude 7430 | i5-1245U / 32 / 256 | Nordisk | 5 995 | Looptop | SECONDARY |
| 5 | Dell Latitude 7330 touch 13,3" | i5-1245U / 32 / 256 | Svensk | 5 495 | Looptop | SECONDARY |
| 6 | HP ZBook Fury 15 G7 Xeon | W-10885M / 32 / 1 TB / T2000 | Svensk | 9 995 | Looptop | YES (svag: 10th gen, 2,76 kg) |
| 7 | Dell Precision 7560 T1200 | i7-11850H / 32 / 512 / 15,6" | Svenskt | 7 999 | Reuseit | SECONDARY |
| 8 | Dell Latitude 7430 touch | i7-1265U / 32 / 256 | Svenskt (SKU "_US"!) | 5 999 (5 499?) | Reuseit | SECONDARY, PARTIALLY VERIFIED |

Ingen av dem slår kända bästa (EliteBook 840 G9 32/1TB 6 999 Reuseit, 640 G9 32/512 6 595 Looptop). Bäst nytt: Precision 5570 (stark CPU, 15,6" 16:10, svenskt, uppgraderbart) och Refurbed Latitude 7430 32/1TB svenskt.

## 16 GB uppgraderbar – kalkyl (ingen inkluderad)
RAM-priser i dag: DDR5 SO-DIMM (NetOnNet, från uppdraget) 1×16 3 749, 2×16 7 999. DDR4 SO-DIMM 3200 (NetOnNet /art/datorkomponenter/ram-minne/ddr4sodimm öppnad 19:15 UTC): Corsair Vengeance 1×16 GB **1 990 kr**, Kingston Fury Impact 2×16 GB **4 990 kr**.

| Kandidat | Pris | RAM-scenario | Total | Jämfört med |
|---|---|---|---|---|
| Nuvoo EliteBook 840 G9 i5 16/512 (DDR5) | 6 111 | 1×16+fri plats: +3 749 / 2×8: +7 999 | 9 860 / 14 110 | 840 G9 32/1TB 6 999 → sämre |
| Nuvoo EliteBook 840 G10 i5 16/512 outlet (DDR5) | 7 550 | +3 749 / +7 999 | 11 299 / 15 549 | sämre |
| Nuvoo ThinkPad T14 Gen 4 i5 16/256 | 8 451 | Intel Gen 4 = lött + 1 plats, variant okänd | ≥10 441 | T14 G4 AMD 32 nordisk 10 195 → sämre |
| Looptop EliteBook 640 G9 NORD i5 16/256 (DDR4) | 5 295 | 1×16: +1 990 / 2×8: +4 990 | 7 285 / 10 285 | 640 G9 32/512 SWE 6 595 → sämre |
| Looptop ProBook 440 G9 SWE i5 16/256 (DDR4) | 4 995 | +1 990 / +4 990 | 6 985 / 9 985 | sämre (256 GB, lägre klass) |
| Looptop ThinkPad T14 Gen 3 i5 NORD 16/256 | 5 795 | Intel Gen 3: 8 eller 16 GB lött + 1 SO-DIMM; om 16 lött + tom plats: +1 990 | 7 785 (om rätt variant) | Variant okänd + 256 GB → ej tillräckligt bra |
| Refurbed 840 G9 i7-1265U | – | 32 GB-konfig finns direkt (DE-layout, 10 535 för 32/1TB) | – | – |

Uteslutna p.g.a. lött minne (ingen datablad-kontroll behövdes för beslut): EliteBook 830 G11, Latitude 7340/7350, ThinkPad L13 Gen 5, X1 Carbon/X13 – ej utredda vidare.
Slutsats: med dagens RAM-priser och refurb-utbudet ger 16 GB + uppgradering ingen affär som slår kända 32 GB-erbjudanden (6 595–6 999 kr). Ingen RAM-datablad-citat behövs därför i JSON.

## Övrigt
- Inrego 32 GB-lista: EliteBook 860 G9 (16") = diskvalificerad. Precision 3490 9 999-varianten syns inte längre.
- Refurbed: T14 G3 Ryzen 7 32/512 (9 005) säljs av Looptop men med tysk layout.
- Reuseit Latitude 7430: titel "Svenskt" men SKU "S38152_US" och dubbla priser i svaret → bör bekräftas innan rekommendation.
- Inga klick på köp. Blocket/Tradera ej besökta.
