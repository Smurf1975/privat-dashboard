# Refurb-segment – anteckningar 2026-11-25 (Black Week)

Utdata: `agent-refurb.json` (15 objekt: 13 VERIFIED, 1 PARTIALLY VERIFIED, 1 NOT VERIFIED).
Råfiler: `raw-refurb-1..6.json` (Playwright via `scripts/verify.js`).

## Källor

| Källa | Metod | Status | Kommentar |
|---|---|---|---|
| Looptop.se | Shopify-produktflöde (`/collections/begagnade-laptops/products.json`, offentligt) för upptäckt + PW på variant-URL:er | OK | Bästa källan: 98 produkter, varje variant anger layout (NORD/SWE/DEU/ENG-US), CPU/RAM/SSD/skick. 8 produktsidor verifierade. Sidan visar ej batterihälsa eller laddare. 12 mån garanti, 30 dagar test, fri frakt till ombud. |
| Reuseit.se | PW + Firecrawl (FC) | OK via FC | Playwright renderar "404 Page not found" (klientsidesfel i headless, HTTP 200, ingen CAPTCHA) → produktsidor lästa med Firecrawl scrape (maxAge 0). Flera sökträffar (840 G9 32/1TB "very good"/"good") var redan sålda (riktig 404). 2 års garanti, 30 dagar öppet köp, fri frakt, laddare ingår, min 70 % batterihälsa. |
| Inrego (shop.inrego.se) | PW | OK | `inrego.se/datorer/barbara-datorer` = 404; butiken ligger på shop.inrego.se. Flera 32 GB-sökträffar (T14 G4 i7 32/480, T14 G1 32/1TB, Latitude 7320 32GB, T14 G4 i5 32/240) omdirigerar till startsidan = sålda. Verifierat: P14s G4 32/1TB (12 499), Precision 3490 32/1TB (14 999). Garantilängd och frakt ej angivna på produktsidan. Filter för 32 GB finns i UI men URL-parametern hittades inte. |
| refurbed.se | PW | OK | Marknadsplats; säljare kan vara utländsk (belco24, DE). Latitude 7330 32/1TB US 9 615 kr verifierad; Latitude 5410 32GB nordisk = slut. Få 32 GB-affärsdatorer med nordisk layout. |
| Back Market (backmarket.se) | PW | **BLOCKED** | 403 + "Vänta..." (testchallengepage). Ej kringgått. |
| Dustin Pre-owned (dustin.se/.../pre-owned) | PW | **BLOCKED** | 403 + "Vänta..." 20:39 UTC. Sökträff (ej verifierad): EliteBook 1040 G10 i7 32/512 9 999 kr exkl. moms (= 12 499 inkl.), T14 G4 i7 32/256 9 999 exkl. moms. Priser exkl. moms (B2B). |
| NetOnNet Refurbished | PW | OK, inget relevant | Refurb-URL omdirigerar till laptop-kategori; enda refurb sett: EliteBook 840 G7 i5/8GB/256 4 490 kr. |
| Webhallen/Foxway refurb | WS (Tavily) | Ej hittat | Inga refurb-laptops med 32 GB i sökning. Ej vidare undersökt. |
| Begagnad.se | PW | FEL 520 | Cloudflare 520 (serverfel hos källan), ej blockering. Testa igen. |
| Nuovo (nuovo.se) | PW | Död | Domänen till salu (Nameshift). Obs: **Nuvoo.com** (annan aktör, sv-se, nordisk layout, 24 mån garanti) dök upp i sökning – ej verifierad, kandidat för nästa körning. |
| Övrigt upptäckt (ej verifierat) | WS | – | smartselling.shop (T14 G2 R5 32/1TB **finskt** tangentbord), Proshop refurb T14 G2 i7 32/512 Nordic 8 296 kr (Proshop = BLOCKED enl. sources.md), Inet refurb (BLOCKED enl. sources.md). |

## RAM-datablad som kontrollerats
- HP EliteBook 840 G9: 2x DDR5 SO-DIMM, max 64 GB (HP Support/QuickSpecs). Reuseit skriver "DDR4" – felaktigt enl. HP.
- HP EliteBook 840 G10: 2x DDR5 SO-DIMM, max 64 GB (QuickSpecs c08487722).
- HP EliteBook 845 G11: 2x DDR5-5600 SO-DIMM, max 64 GB.
- HP EliteBook 640 G9: 2x DDR4 SO-DIMM, max 64 GB.
- HP ZBook Firefly 14 G9: 2x DDR5 SO-DIMM, max 64 GB.
- Lenovo T14 Gen 4 AMD / T14 Gen 3 AMD: lött, ej uppgraderbart (PSREF) – 32 GB redan installerat.
- Lenovo P14s Gen 4 Intel m. dGPU: LPDDR5x lött (PSREF).
- Lenovo P15v Gen 1: 2x DDR4 SO-DIMM, max 64 GB (PSREF).
- Dell Latitude 7330: integrerat, ej uppgraderbart, max 32 GB (Dell Setup & Specs).
- Dell Precision 3490: endast Inregos uppgift (2x SODIMM, max 64) – Dell-manual ej öppnad.
- MSI Prestige 14 AI Studio C1VEG: ej verifierat.

## Kunde inte verifieras
- Batterihälsa på Looptop/Inrego (anges inte). Laddare på Looptop/Inrego (anges inte).
- Inregos garantilängd och fraktkostnad (ej på produktsidan).
- Exakt MPN för refurb-enheter (anges inte av säljarna) → candidate_id = märke-modell-cpu-ram-ssd-tangentbord.
- Looptop lagerstatus per variant: JSON-LD listar alla varianter utan SKU; variantens `available=true` i Shopify-flödet + InStock-erbjudande med samma pris användes.

## Slutsats (refurb)
Inga 16 GB-maskiner behövde uppgraderas – det finns gott om verifierade 32 GB-erbjudanden under 15 000 kr. Klart bäst värde: Reuseit HP EliteBook 840 G9 i7-1265U/32/1TB/svenskt/nytt batteri för 6 999 kr (Okej skick, 2 års garanti).
