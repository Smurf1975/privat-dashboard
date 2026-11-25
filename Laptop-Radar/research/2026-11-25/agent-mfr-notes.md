# Agent MFR – manufacturer stores (2026-11-25, Black Week)

Segment: Lenovo SE, HP SE, Dell SE, ASUS Store SE + ASUS EU stores (FI/DK/DE/NL/FR).
Output: `agent-mfr.json` (10 offers). Raw data: `raw-mfr-1..15*.json`.
No purchase buttons were clicked. No blocked site was bypassed.

## Summary of results
No manufacturer-store offer was found that meets **all** of 32 GB + 1 TB + Nordic keyboard (verified) + ≤15 000 kr with nothing more to buy. Closest offers:

| # | Offer | Price | Status | Why not a clean YES |
|---|---|---|---|---|
| 1 | HP OmniBook X Flip 14 kc0023no (D44PYEA#UUW), Ryzen AI 7 450, 32 GB, 1 TB | 14 990 | YES (PARTIAL) | Keyboard layout not stated on page; charger NOT included (a charger would push it over 15 000) |
| 2 | HP OmniBook 7 14 fr0074nox (D70BWEA#UUW), Ultra 7 255H, 32 GB, 512 GB OLED, Swedish kb | 13 490 | SECONDARY (VERIFIED) | 512 GB; charger not included |
| 3 | Lenovo ThinkPad E14 Gen 7 Intel 21T9001RMX, Core 5 210H, 16 GB (1×16 SODIMM, 2nd slot free, max 64 GB), Nordic kb, Win 11 Pro | 11 499 | SECONDARY (VERIFIED, PSREF) | Must add a 16 GB SODIMM; 512 GB (free 2nd M.2 2280 slot) |
| 4 | Dell 14 DC14255, Ryzen 5 220, 16 GB (1×16, 2 slots, max 32), Nordic kb, adapter included | 12 324 | SECONDARY (PARTIAL) | Must add 16 GB SODIMM; manual info from search snippet (manual page 403) |
| 5 | ASUS ExpertBook P1 P1403 (90NX0871-M01900), 2×DDR5 SO-DIMM max 64 GB, Nordic kb | 8 890 (estore price shown on asus.com/se) | SECONDARY (PARTIAL) | SKU's CPU/RAM/SSD unknown – estore 403 |

Upgrade cost: DDR5 SODIMM prices were NOT verified in this run (and reports say DRAM prices are rising in 2026). Check them before ranking the upgrade-path offers.

## Per source

### Lenovo SE (lenovo.com/se/sv) – OK (PW)
- Opened: deals/laptops (redirects to /laptops), ThinkPad T, E, L and X1 series, the IdeaPad category (the IdeaPad Pro/500 URLs redirect to the general IdeaPad page), Yoga, and site search ("32GB", "IdeaPad Pro 5").
- Series/model pages: E14 Gen 7 Intel (len101t0124), E14 Gen 8 Intel (len101t0187, len101t0167), E14 Gen 7 AMD (len101t0133), Yoga Slim 7a Gen 11, IdeaPad Slim 5a Gen 11, IdeaPad Slim 5i Gen 10.
- Findings: every 32 GB config on Lenovo SE costs more than 15 000 kr. Examples: E14 Gen 7 AMD 32 GB/1 TB 22 504; E14 Gen 8 Intel 32 GB/1 TB 25 410; IdeaPad Pro 5a 14 32 GB 20 460+; Yoga Slim 7 14 32 GB/512 19 990; Yoga 7 2-in-1 14 32 GB 18 990. ThinkPad T14/T14s/X1 Carbon all start at 18 000–47 000+.
- Best value: **E14 Gen 7 Intel 21T9001RMX at 11 499 kr** (web price 11 990, BLACK coupon shown, "Nästan slutsålt"). PSREF confirms 1×16 GB SODIMM, two slots, max 64 GB, Nordic (DK/FI/NO/SV) backlit keyboard, Win 11 Pro, 64 Wh battery, 1.34 kg, 1-year courier/carry-in warranty.
- The Yoga Slim 7a and IdeaPad Slim 5a model lists did not render; only the from-prices are known (10 990 / 11 672). A custom Playwright script clicked the "Visa model" view expander (not a buy button), and the lists still did not appear.
- Lenovo Outlet SE: `/se/sv/outlet/` returns 404 and `/se/sv/d/outlet/` redirects to the normal laptops listing. No Swedish outlet was found.

### HP SE (hp.com/se-sv/shop) – ERROR in Playwright (not a block), read via Firecrawl
- Every listing and product page crashes in headless Chromium ("Application error: a client-side exception"), with HTTP 200 and no CAPTCHA, so this is not a block. Firecrawl rendered the pages.
- Listing `listings/laptops?memstd=32-gb&scrnsizeus=14` reports 50 results, but only the first 12 come back; the `p=2` and `sort=` URL params are ignored. Of those 12, only two 32 GB 14" models are ≤15 000: OmniBook 7 14 fr0074nox (13 490) and OmniBook X Flip 14 kc0023no (14 990). Near misses: OmniBook X Flip kb0073no 15 990; OmniBook 7 kh0091nox 15 990 (sold out). EliteBook 8 G2i / X G2i / ProBook 4 G2i with 32 GB cost 21 199–40 999.
- No EliteBook 640/645/840/845 with 32 GB ≤15 000 was seen. The remaining 38 results were not reachable.
- Both OmniBook pages say "Laddare ingår inte" and list a 1-year limited warranty. Shipping is free over 200 kr.

### Dell SE (dell.com/sv-se) – OK (PW); support manuals BLOCKED (403)
- Opened: the laptop listing, the Dell Pro line listing, the Dell (consumer) line listing, laptop deals, and the Dell 14 DC14255, Dell 14S DS14270, Pro 14 Essential PV14250 and Pro 14 PC14255 product pages.
- No Latitude 5450/5455/7450 is sold on Dell SE (the line is now "Dell Pro"). Dell Pro 14 / 14 Plus / 14 Premium start at 16 807 / 23 010 / 27 465, all over budget. Pro 14 PC14255 32 GB is +5 496 kr on top of 16 807.
- Within budget: Dell 14 DC14255 at 12 324 (16 GB 1×16, Nordic keyboard and 65 W adapter selected in the configurator) and Pro 14 Essential PV14250 at 11 705 (16 GB 1×16, Nordic keyboard, **no adapter**). Dell 14S uses soldered LPDDR5X (max 16 GB in the listed configs), so it is disqualified.
- RAM slot data came from the Dell manuals as Tavily search snippets. The dell.com/support manual page returned 403 in the browser. The PV14250 data came from an owner's-manual PDF mirror. Both are marked PARTIAL.

### ASUS Store SE (shop.asus.com/se) – BLOCKED (403)
- Tried once: 403 with an empty body. `estore.asus.com/se` (the host asus.com links to for "Köp") also returns 403, so it is BLOCKED as well. Not bypassed.
- **www.asus.com/se is OK**. It shows "ASUS estore-pris"/"Priserna från ASUS estore startar på" prices plus JSON-LD. The page notes that the price may not match the specs shown, so the SKU configuration cannot be verified.
  - ExpertBook P1 P1403: 8 890 SEK, InStock. The SE techspec page shows 2×DDR5 SO-DIMM, max 64 GB, Nordic keyboard layout, 65 W USB-C adapter and 1.40 kg. The SKU (90NX0871-M01900) config is unknown.
  - Vivobook S14 OLED M5406: from 10 790 (was 14 990). RAM is soldered, "up to 32 GB", and the priced SKU is unknown.
  - Zenbook 14 OLED UX3405: from 15 490, OutOfStock.
  - Zenbook A14 UX3407 is from 9 290, but it is Snapdragon ARM, so it is excluded.
  - Vivobook S14 S3407QA is Snapdragon, so it is excluded.
  - ProArt PX13 from 29 990 is over budget.
  - The ExpertBook filter shows "32GB RAM (10)" across ExpertBook/Zenbook, but the tiles did not render and the price facets show only 2 models in 10 000–14 999.
- asus.com/se footer: "Fri frakt på alla ordrar över 1100 SEK", "Smidiga returer inom 14 dagar".

### ASUS EU stores – delivery to Sweden
| Store | Status | Ships to SE? | Layout | Notes |
|---|---|---|---|---|
| shop.asus.com/fi | BLOCKED 403 (estore.asus.com/fi also 403) | UNKNOWN – not verifiable | UNKNOWN | – |
| shop.asus.com/dk | BLOCKED 403 | UNKNOWN | UNKNOWN | – |
| shop.asus.com/de | BLOCKED 403 | UNKNOWN | UNKNOWN (DE store typically QWERTZ – not verified) | – |
| shop.asus.com/nl | BLOCKED 403 | UNKNOWN | UNKNOWN | – |
| shop.asus.com/fr | BLOCKED 403 | UNKNOWN | UNKNOWN | – |

- I could not open any delivery-country list, checkout country selector or terms page, because they are all on the blocked shop host.
- Web search (discovery only) found no official ASUS statement. The only hints are indirect: ASUS UK Store's FAQ says it delivers only to the UK, and Acer's DE store delivers only to DE/AT. These are **not** evidence for the ASUS EU stores. Treat delivery to Sweden as UNKNOWN/unverified.
- No EUR offers were recorded, so no EUR→SEK rate was applied.

## Could not be verified
- ASUS SKU-level configurations, cart availability and all ASUS EU delivery terms (shop/estore 403).
- HP: 38 of the 50 results in the 32 GB + 14" listing; keyboard layout of the OmniBook X Flip kc0023no.
- Dell: memory slot data from the manuals (403 in the browser; snippet only); shipping cost and stock levels (not shown).
- Lenovo: Yoga Slim 7a / IdeaPad Slim 5a model lists; shipping cost; whether the 11 499 E14 price requires the BLACK coupon (JSON-LD says 11 499).
- Upgrade module (DDR5 SODIMM) prices – not checked.
