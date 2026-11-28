# Agent new-SE, kvällskörning 2026-11-28

Segment: nya datorer och outlet hos Elgiganten, POWER, NetOnNet, Webhallen och Komplett. Fokus på den nya regeln om 16 GB som går att bygga ut. Blocket och Tradera är inte med.
RAM-priser kommer från NetOnNet och lästes i dag:
- DDR5 (raw-ram.json): 1×16 GB 3 749 kr, 1×32 GB 5 799 kr, 2×16 GB 7 999 kr.
- DDR4 (sodimm-ddr4-sidan, raw-newse-kvall-9.json): Corsair 1×16 GB DDR4-3200 1 990 kr, Kingston 2×16 GB DDR4-3200-kit 4 990 kr. Ingen 1×32 GB DDR4 låg i listan, bara ett 2×32-kit för 10 999 kr.

## Nya erbjudanden (4, alla YES, alla 16 GB som går att bygga ut)
| Erbjudande | Pris | RAM | Totalt | Status |
|---|---|---|---|---|
| ThinkPad E14 Gen 7 AMD 21T0004VMX (Ryzen 5 220, 512 GB, Nordic, W11 Pro), Elgiganten 1047390 | 10 995 | 1×16 + ledig plats (PSREF) → +3 749 | **14 744** | VERIFIED |
| ASUS ExpertBook P3 PM3406CKA (Ryzen AI 5 330, 512 GB), Elgiganten Outlet 1184395, "Nyskick i originalförpackning" | 9 097 | 1×16 SO-DIMM + plats (ASUS-spec) → +3 749 | **12 846** + laddare | PARTIALLY (laddare ingår ej, tangentbord bara från ASUS SE-spec) |
| ThinkPad L14 Gen 3 i5-1235U, 512 GB, RePOWER klass A, POWER 4534136 | 6 799 | DDR4 2×SO-DIMM (PSREF), konfiguration okänd → +1 990 / +4 990 | **8 789 / 11 789** | PARTIALLY (OS/garanti/laddare anges inte) |
| ThinkPad L14 Gen 2 i5-1135G7, 512 GB, RePOWER klass A, W11 Pro, POWER 4534130 | 5 489 | DDR4 2×SO-DIMM (PSREF), konfiguration okänd → +1 990 / +4 990 | **7 479 / 10 479** | PARTIALLY (garanti/laddare anges inte, viktuppgiften i texten är fel) |

RePOWER är POWER:s eget varumärke för rekonditionerade datorer. De två ThinkPad-datorerna är alltså refurb och inte nya.

## Kontrollerade men uteslutna (totalpriset blir över 15 000 eller datorn går inte att bygga ut)
- ThinkPad L14 G5 21L1007BMX, Elgiganten 1100195: 9 495 kr. PSREF anger "2x 8GB SODIMM". Totalt 9 495 + 7 999 = 17 494, eller med 1×32 9 495 + 5 799 = 15 294 → NO.
- ThinkPad E14 Gen 7 Intel 21SX000QMX, Elgiganten 1047389: 13 995 kr. PSREF anger 1×16. Totalt 13 995 + 3 749 = 17 744 → NO.
- ExpertBook P3 PM3406CKA ny, Elgiganten 1055062: 12 995 + 3 749 = 16 744 → NO.
- Lenovo LOQ Essential 83S0008DMX, Elgiganten 1013396 (15,6", 10 990): PSREF anger "Max Memory: Up to 16GB DDR5-4800 offering". Datablad bekräftar inte 32 GB → NO.
- POWER B2B: L14 Gen 5 CTO (16/512, 14 499, i lager) → 18 248 → NO. E14 Gen 7 21T00067MX 13 999 är slut i lager. ProBook 440 G11 12 999 är slut i lager. ProBook 4 G1i/G1iR/G2i/G2a, 450 G10 och T14 Gen 6 kostar alla över 15 000.
- RePOWER T14 G2 AMD (Ryzen 5 PRO 5650U, 16/256, 5 999, POWER 4534134): PSREF anger "1x Soldered + 1x SO-DIMM, max 48GB". Hur 16 GB är fördelat (16+0 eller 8+8) är okänt, och det finns inget pris i dag på 1×32 GB DDR4 → inte med. Den kan bli 32 GB för 7 989 kr om den har 16 GB lött och en tom plats. Fråga POWER.
- ASUS ExpertBook B1 B1403CVA-S69121XAEW, Elgiganten 1055059, 7 495 kr: ASUS spec-sida gick inte att öppna (generisk listsida), så RAM-konfigurationen är inte verifierad → inte med. Kan vara intressant.
- HP Laptop 15-fc0852no (R7-7730U/16/1 TB, 7 495) och outlet-varianter: DDR4, HP QuickSpecs kontrollerades inte. Inte med. Kan undersökas.
- RePOWER T14 G3 (14 999) och L15 G3 (11 999) är slut i lager.

## Källstatus
| Källa | Resultat |
|---|---|
| Elgiganten | OK med PW för produktsidor och kategori. Sökningen (`/search?q=`) renderas inte i PW (0 produkter) men fungerar med Firecrawl-scrape och links-format. Spec-fliken renderas inte; använd "Kort om produkten", produktbeskrivningen, JSON-LD (mpn finns) och PSREF/ASUS för MPN. JSON-LD:s andra offer är priset exkl. moms (×0,8), inte ett outletpris. |
| Elgiganten Outlet | `/outlet/datorer-kontor/...` ger 404. Använd sökningen med `&3|hierarchicalCategories.lvl1[]=Outlet` via FC. |
| POWER | OK med PW. Sökningen ger B2B- och RePOWER-länkar. Specifikationsfliken renderas inte. |
| NetOnNet | OK. Sökningen "expertbook"/"probook"/"thinkpad e14" gav 0 nya bärbara (bara refurb T14 G1). `/art/outlet` och outlet-laptop gav 0 produktlänkar. |
| Webhallen | Sökningen renderar 0 produkter både i PW och i FC i kväll. `/api/search` ger 404. Tidigare körningar hittade inga ThinkPad/EliteBook/Latitude där. |
| Komplett | 502 (ett försök). |
| Dustin / Inet / Proshop | BLOCKED: 403 "Vänta..." hos Dustin och Inet, Cloudflare hos Proshop. Ett försök vardera, inget kringgåtts. |
| PSREF | OK med PW, både modellsidor (`/Detail/...?M=`) och plattformssidor (`/Product/...`). |
| ASUS SE spec | PM3406 OK. B1403CVA-URL:en ledde till listsida. |

Råfiler: raw-newse-kvall-1 … -10.json.
