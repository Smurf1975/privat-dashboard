# Tillverkarbutiker – kvällskörning 2026-11-28

Segment: Lenovo SE, HP SE, Dell SE, asus.com/se. Råfiler: `raw-mfr-kvall-1..6.json` (PW). HP lästes med Firecrawl (maxAge 0).
RAM-priser (NetOnNet, från uppdraget): 1×16 GB DDR5 SO-DIMM 3 749 kr · 1×32 GB 5 799 kr · 2×16 GB-kit 7 999 kr.

## Resultat: 2 nya erbjudanden (`agent-mfr-kvall.json`)
| Erbjudande | Pris | Beräkning | Status |
|---|---|---|---|
| HP 15" AI Laptop fd2054nox (D70QMEA#UUW), Ultra 5 225U, 1×16 GB DDR5 + ledig plats, 512 GB, 15,6" | 7 990 kr | 7 990 + 3 749 (RAM) + 1 499 (laddare säljs separat; HP 65 W GaN som referens) = **13 238 kr** | SECONDARY, PARTIALLY VERIFIED (tangentbord okänt, 512 GB) |
| HP OmniBook 5 14 hh0078nox (D92XYEA#UUW), Ultra 7 355, 32 GB LPDDR5x (lött), 1 TB, 14" OLED | 14 990 kr | laddare "säljs separat" → 14 990 + laddare > 15 000 | NO (över budget inkl. laddare) |

Datablad för HP 15-fd2xxx: Maintenance & Service Guide (kaas.hpcloud.hp.com/pdf-public/pdf_11954528_en-US-1.pdf): "DDR5-5600, dual channel support (Ultra processors) – Supports up to 32 GB … 32 GB (2 × 16 GB)". 1×16 + 1×16 = 32 GB.

## Kontrollerat men inte medtaget (total > 15 000 eller inte verifierbar)
- **Lenovo SE** (PW OK): Det finns inget ≤15 000 kr. T14 Gen 5 från 21 499 / 23 999 kr, T14 Gen 6 från 18 090 kr. E14 Gen 7 Intel "inte tillgänglig". E14 Gen 7 AMD (CTO 21T0CTO1WWSE4/SE5/SE1): 8 GB SO-DIMM 256 GB 14 024 kr; 16 GB 256 GB 17 474 kr; 32 GB 1 TB 22 504 kr. E14 Gen 8 Intel 21Y8CTO1WWSE3/SE4/SE1: 13 009 kr (8 GB/256 GB), 18 159 kr (16 GB), 25 410 kr (32 GB). E14 Gen 8 AMD 32 GB från 23 770 kr. L14 Gen 7 AMD: 16 GB 1 TB 19 744 kr, 32 GB 21 937 kr. IdeaPad Pro-sidan gav inga 32 GB-modeller ≤15 000 kr (granskades ytligt). Kända 21T9001RMX/83J0CTO1WWSE1 har inte kontrollerats igen.
- **HP SE**: ProBook 4 G2i/G2ah 14" kostar från 15 999 kr (16 GB) och 21 199 kr (32 GB). EliteBook 6/8 G2 14" kostar från 18 499 kr. ProBook 4 G1q är Snapdragon och uteslöts. Följande stoppades av RAM eller laddare:
  - fd2055no och fd2077no: 2×8 GB, SLUT I LAGER. Med 2×16-kit blir totalen 15 989 kr, och 40 GB är över databladets max på 32 GB.
  - fd2076nox (Ultra 7 255U, 1×16 GB): 10 990 + 3 749 + 1 499 = 16 238 kr.
  - OmniBook 3 15 fn0028no: 2×8 GB, SLUT I LAGER.
  - OmniBook 3 15 fn0009no: 2×8 GB, 7 990 + 7 999 = 15 989 kr.
  - **OmniBook 3 14 hs0072no (D5WX2EA#UUW)**: Ultra 7 355, 1×16 GB, i lager, 9 990 kr, men laddaren säljs separat. Seriedatabladet (support.hp.com ish_13661198-13661240-16) anger alternativen 1×32 / 1×24 / 2×8 / 1×16, alltså två platser och max 32 GB. Totalen 9 990 + 3 749 + 1 499 = 15 238 kr är 238 kr över taket. Med en billigare 65 W USB-C PD-laddare (inget pris kontrollerat i dag) hamnar den under 15 000 kr. 2×16 står inte uttryckligen i databladet. **Kandidat att bevaka.**
  - OmniBook X Flip 14 16 GB (9 990 / 12 490 kr) har lött LPDDR och uteslöts.
- **Dell SE** (PW OK):
  - Dell 14 Intel DC14250 (dc14250_reg_01), ny för oss: 12 733 kr, Core 5 120U, 1×16 GB DDR5, 512 GB, **nordiskt tangentbord**, 65 W-adapter ingår. Totalen 12 733 + 3 749 = 16 482 kr. Inte heller med Core 3 (−1 091 kr) blir den 15 391 kr, så den uteslöts. Antalet platser kontrollerades inte i manualen.
  - Dell Pro 14 Essential, annan konfig: Core 7 150U, 16 GB, 14 451 kr, "Ingen nätadapter". Den är över taket.
  - Dell Pro 14 (PC14250): från 27 465 kr, JSON-LD OutOfStock.
  - Dell 15 DC15255/DC15250: URL:erna gav ingen produktsida.
- **ASUS**: shop.asus.com/se/laptops.html gav 403 och markerades **BLOCKED** efter ett försök (kringgicks inte). ExpertBook P3 P3405 techspec (asus.com/se): "DDR5 SO-DIMM, Minne Max Upp till: 64GB", men sidan har inget pris eller köpställe och gav därför inget erbjudande.

## Iakttagelser
- HP:s konsumentmodeller i SE (15-fd2, OmniBook 3/5) säljs ofta **utan laddare** ("rekommenderas, säljs separat"). Lägg till ett laddarpris i totalen.
- Dells "Ingen nätadapter" är förvald på Pro 14 Essential fixed-konfig. Kontrollera detta på det redan kända pv14250_fixed_01.
- HP:s egen 65 W GaN-laddare (600Q7AA#ABB, 1 499 kr) var SLUT I LAGER i dag.
