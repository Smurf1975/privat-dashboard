# Sökprofil (permanent)

| Krav | Värde |
|---|---|
| Skärm | Helst 14". Max 15,6". (16" = diskvalificerad) |
| RAM | Minst 32 GB, **eller 16 GB som går att bygga ut till 32 GB** (från 2026-11-28). Verifiera i tillverkarens datablad: SO-DIMM-platser, lött minne, max RAM. Anta aldrig. Lött 16 GB = diskvalificerad. |
| Lagring | Helst 1 TB SSD. 512 GB = sekundär kandidat om affären är exceptionell. Notera M.2-plats/uppgraderbarhet. |
| CPU | x86 (Intel/AMD). Snapdragon/ARM = endast om klart överlägsen, och markeras. Bedöm generation/prestanda, inte marknadsnamn. |
| Tangentbord | Svensk/nordisk layout krävs för fullt kvalificerad rekommendation. Annan layout märks tydligt. Anta aldrig layout utifrån butikens land. |
| OS | Windows ingår = önskat. Win 11 Pro = bonus. Utan Windows märks tydligt. |
| Budget | Idealt 10 000–13 000 kr. Absolut max 15 000 kr (inkl. frakt). Billigare begagnat/refurb välkommet. |
| Märken | ASUS prioriteras. Jämför ThinkPad, IdeaPad, HP EliteBook, Dell Latitude/Precision m.fl. Inte låst till dessa. |

## Kvalificering (fält `qualifies` i offers.json)
- **YES** – ≤15,6", ≥32 GB (eller 16 GB verifierat uppgraderbar till 32 GB, totalpris inkl. RAM ≤15 000), x86, ≤15 000 kr, köpbar. Nordiskt tangentbord krävs för "fullt kvalificerad"; annars YES men flagga `keyboard` ≠ Nordic.
- **SECONDARY** – 512 GB med exceptionellt pris, eller okänd layout/OS men i övrigt stark.
- **NO** – bryter hårt krav (för stor skärm, <32 GB utan verifierad uppgradering, >15 000 kr, ARM utan skäl).

## 16 GB uppgraderbar (gäller från 2026-11-28)
- Tas med om datorn har 16 GB och databladet (PSREF/QuickSpecs/Dell-manual/ASUS-spec) bekräftar att RAM kan byggas ut till minst 32 GB.
- Ange konfiguration: `1×16 GB + ledig plats` (köp 1×16 GB), `2×8 GB` (byt båda → 2×16 GB-kit) eller `8 lött + 1 plats` (räcker inte till 32 → NO om max <32 med befintlig konfig).
- Ange RAM-kostnad från en svensk butikssida öppnad samma dag (rätt typ: DDR4/DDR5 SO-DIMM, rätt hastighet). Totalpris = dator + RAM.
- Budgettaket 15 000 kr gäller **totalpriset**. Rapporten visar alltid: `pris + RAM = total`.
- Kvalificering: YES om total ≤15 000 och övriga krav uppfylls; annars SECONDARY/NO enligt vanliga regler. Märk `ram_upgrade_note` med källa och modulpris.

## Uteslutna källor (från 2026-11-28)
Blocket och Tradera tas inte med i genomgångar, omkontroller, ranking eller rapporter (användarens beslut 2026-11-27). Facebook Marketplace likaså.

## Rankingvikter (0–100)
Värde/pris 25 · CPU 12 · RAM + uppgraderbarhet 12 · SSD 6 · Skärm 8 · Bygg/affärsklass 8 · Batteri 5 · Vikt 4 · Tangentbord 6 · Skick/garanti/retur 8 · Säljare/tillgänglighet 6.
Ett refurbished affärsdator kan slå en ny konsumentdator. En 7 000 kr-dator som uppfyller kraven kan vara bättre än en för 12 000 kr – men offra aldrig hårda krav för lågt pris.
