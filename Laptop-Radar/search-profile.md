# Sökprofil (permanent)

| Krav | Värde |
|---|---|
| Skärm | Helst 14". Max 15,6". (16" = diskvalificerad) |
| RAM | Minst 32 GB. Alt. realistiskt + ekonomiskt uppgraderbar till 32 GB (verifiera lödd/SO-DIMM/max). Anta aldrig. |
| Lagring | Helst 1 TB SSD. 512 GB = sekundär kandidat om affären är exceptionell. Notera M.2-plats/uppgraderbarhet. |
| CPU | x86 (Intel/AMD). Snapdragon/ARM = endast om klart överlägsen, och markeras. Bedöm generation/prestanda, inte marknadsnamn. |
| Tangentbord | Svensk/nordisk layout krävs för fullt kvalificerad rekommendation. Annan layout märks tydligt. Anta aldrig layout utifrån butikens land. |
| OS | Windows ingår = önskat. Win 11 Pro = bonus. Utan Windows märks tydligt. |
| Budget | Idealt 10 000–13 000 kr. Absolut max 15 000 kr (inkl. frakt). Billigare begagnat/refurb välkommet. |
| Märken | ASUS prioriteras. Jämför ThinkPad, IdeaPad, HP EliteBook, Dell Latitude/Precision m.fl. Inte låst till dessa. |

## Kvalificering (fält `qualifies` i offers.json)
- **YES** – ≤15,6", ≥32 GB (eller verifierat uppgraderbar till 32 GB inom budget), x86, ≤15 000 kr, köpbar. Nordiskt tangentbord krävs för "fullt kvalificerad"; annars YES men flagga `keyboard` ≠ Nordic.
- **SECONDARY** – 512 GB med exceptionellt pris, eller okänd layout/OS men i övrigt stark.
- **NO** – bryter hårt krav (för stor skärm, <32 GB utan verifierad uppgradering, >15 000 kr, ARM utan skäl).

## Rankingvikter (0–100)
Värde/pris 25 · CPU 12 · RAM + uppgraderbarhet 12 · SSD 6 · Skärm 8 · Bygg/affärsklass 8 · Batteri 5 · Vikt 4 · Tangentbord 6 · Skick/garanti/retur 8 · Säljare/tillgänglighet 6.
Ett refurbished affärsdator kan slå en ny konsumentdator. En 7 000 kr-dator som uppfyller kraven kan vara bättre än en för 12 000 kr – men offra aldrig hårda krav för lågt pris.
