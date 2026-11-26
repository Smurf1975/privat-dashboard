# Agent MFR – manufacturer stores (2026-11-26, Black Week, day before Black Friday)

Segment: Lenovo SE, HP SE, Dell SE, ASUS SE (asus.com/se + estore) and ASUS EU stores.
Output: `agent-mfr.json` (2 new offers). Raw data: `raw-mfr-1.json` … `raw-mfr-11-hp-fc.json`.
Known offers in `offers-latest.json` were not re-verified. No buy buttons were clicked, and no blocked site was bypassed.

## Result
No new fully qualifying offer (32 GB + ≤15 000 kr all-in + x86 + ≤15,6") was found in any manufacturer store today. The Black Friday cuts did not bring any 32 GB Lenovo or Dell config under 15 000 kr.

New offers (both SECONDARY):
| Offer | Price | Status | Why only SECONDARY |
|---|---|---|---|
| HP OmniBook 7 14-fr0075no (C42D4EA#UUW), Ultra 7 255H, 32 GB soldered, 512 GB, 2K OLED, Swedish keyboard, **charger included** | 14 990 | VERIFIED (FC) | 512 GB. It is the same machine as the known fr0074nox (13 490, no charger), so the totals are close. |
| ASUS Vivobook 14 X1407 (16 GB on board + 1 free SO-DIMM slot, max 32 GB), Nordic keyboard, 512 GB | 8 449 (estore price on asus.com/se, was 13 990) | PARTIALLY VERIFIED | Needs a 16 GB SO-DIMM. The exact SKU/CPU is unknown because the estore returns 403. Weak 300-nit, 45% NTSC panel. |

## Per source

### Lenovo SE – OK (PW)
- Opened: deals/laptops, search "32GB", "32GB 14", "Yoga Slim 7i", "IdeaPad Slim 5", "IdeaPad Pro 5", "ThinkPad T14" and "ThinkPad X13", the ThinkPad E, IdeaPad and Yoga categories, and the model pages E14 Gen 8 Intel (len101t0167, len101t0187), E14 Gen 7 Intel (len101t0143), E14 Gen 8 AMD (len101t0182), Yoga Slim 7i Gen 11 Aura (len101y0069) and Yoga Slim 7a Gen 11 (len101y0065).
- **Every 32 GB config is still over 15 000 kr.** The cheapest 32 GB 14" configs:
  - IdeaPad Slim 5a Gen 11 14" AMD (Ryzen AI 7 445, 32 GB SODIMM 2×16, 512 GB): 16 343 (webprice 18 159, −10%).
  - Yoga 7 2-in-1 14 (32 GB/1 TB): 18 990.
  - Yoga Slim 7 14 (32 GB/512 GB): 19 990.
  - ThinkPad E14 Gen 8 AMD 32 GB/512 GB: 24 354. E14 Gen 8 AMD 32 GB/1 TB: 23 770.
  - E14 Gen 8 Intel Core 7 350 32 GB/1 TB: 25 410.
  - E14 Gen 8 Intel Ultra 7 355 32 GB/1 TB: 27 366.
  - ThinkPad T14 Gen 6: from 18 090 ("MEGADEAL").
  - IdeaPad Pro 5a/5i 14: 20 460–21 221.
  - X13 Gen 7: 27 328 and up.
- Upgrade-path options are not better than the known E14 Gen 7 21T9001RMX:
  - IdeaPad Slim 5a 14 16 GB (2×8 SODIMM) / 256 GB at 11 672. Both sticks would have to be replaced.
  - E14 Gen 8 Intel Core 5 320 16 GB / 512 GB at 18 159.
  - IdeaPad Slim 5i Ultra Gen 11 has soldered LPDDR5X (8/16 GB), so it is excluded.
- Seen in passing, not re-verified: the E14 Gen 7 Intel series card now shows "from 17 404" (len101t0143, 21U2CTO1WWSE1). The known 21T9001RMX (len101t0124) is not in the series listing. The recheck should confirm whether it is still sold.
- Yoga Slim 7a/7i model lists still do not render on the product pages. Only the from-prices are shown (10 990 and 13 346), and search shows that the 32 GB configs cost 21 495–25 109.

### HP SE – OK via Firecrawl (maxAge 0). PW not used (known crash).
- The listing `memstd=32-gb&scrnsizeus=14&price=0-15000` returned 16 results, of which 12 were shown. The `p=2` parameter is still ignored, so 4 results were not reachable.
- x86 14" 32 GB models priced ≤15 000:
  - kc0023no 14 990 (known).
  - fr0074nox 13 490 (known, unchanged).
  - **fr0075no 14 990 (NEW)**, verified on its product page: Swedish keyboard, "Laddare ingår" (100 W USB-C), in stock.
- OmniBook 5 14 he0830nox (12 990) and he0831no (14 990) have 32 GB/1 TB, but they are Snapdragon X Plus, so they are excluded (ARM).
- Near misses over budget:
  - OmniBook X Flip kb0073no 15 990.
  - OmniBook 7 kh0091nox 15 990 (sold out).
  - fr0079no 15 990 (sold out).
  - OmniBook 5 14 hh0078nox 16 990.
  - fr0078nox 16 990 (sold out).
  - OmniBook X ka0078no 17 990.
  - OmniBook Ultra kd0091no 17 990 (sold out).
- EliteBook 8 G2i 14 with 32 GB costs 29 499–30 999, ProBook 4 G2i 14 with 32 GB costs 21 199, and EliteBook X costs 35 499 and up. No EliteBook 6 series or OmniBook 7 Aero 32 GB ≤15 000 was seen.
- The `scrnsizeus=13.3`/`15.6` filters and the subbrand filters do not work as URL parameters.
- Known price unchanged: kc0023no 14 990 (Black Friday Deal, was 15 990).

### Dell SE – OK (PW)
- Opened: the Dell product-line listing, laptops listing, laptop deals (10 results), Dell 14 Plus DB14250 and Dell Pro 14 PC14250.
- No 32 GB config ≤15 000.
  - Dell 14 Plus DB14250 starts at 17 614.
  - Pro 14 PC14250 starts at 0/OutOfStock in JSON-LD, but the page offers 32 GB (2×16 or 1×32 DDR5) options. The price was not read.
  - Pro 14 Plus starts at 23 010.
  - XPS 13 9350 (16 GB soldered) costs 15 368.
- A new Black Friday offer ID was seen: Dell Pro 14 Essential pv14250_so_1 (Core 7 150U, 16 GB DDR5, 512 GB) at 16 576. It is over budget even before a RAM upgrade.
- Known offers unchanged: Dell 14 DC14255 12 324 and Pro 14 Essential pv14250_fixed_01 11 705.

### ASUS – asus.com/se OK (PW). shop.asus.com/se and estore.asus.com/se BLOCKED (403).
- Tried once each (raw-mfr-1.json): shop.asus.com/se, estore.asus.com/se. Both returned **403 BLOCKED**. They were not bypassed. Firecrawl was not used on estore URLs either.
- `www.asus.com/se/deals/black-friday/` (new useful entry point) lists estore from-prices. The 14" x86 cards are:
  - Vivobook 14 X1407: **8 449** (was 13 990), "Köp", JSON-LD InStock. This is the new SECONDARY offer above.
  - Vivobook S 14 S5406: estore price **9 990** (was 13 990), but OutOfStock / "Meddela mig". The S5406SA techspec lists both 32 GB (Ultra 7 258V, 1 TB) and 16 GB (Ultra 5 226V, 512 GB) variants, and the priced SKU is unknown. It is not buyable, so it was not recorded. If it returns in stock as the 32 GB variant, it would be a top deal; watch it.
  - Vivobook S14 D3407: from 8 990 (was 10 990), "Meddela mig". The D3407 HA/KA/GA models have 16 GB on board plus a SO-DIMM slot, max 32 GB. Not buyable, not recorded.
  - Vivobook S14 M5406: from 10 790 (soldered RAM; the SKU is unknown, same as yesterday).
  - Zenbook 14 UX3480 Intel: from 12 990. The techspec says it has a max of 24 GB on board, so it is **disqualified**.
  - Zenbook 14 OLED UX3405: from 15 490.
  - Zenbook A14, Zenbook 14 UX3480 Qualcomm and Vivobook S14 S5408 are Snapdragon, so they are excluded.
  - Zenbook Duo UX8406: from 19 490.

### ASUS EU stores – Sweden delivery
| Store | Status 2026-11-26 | Ships to SE? | Layout |
|---|---|---|---|
| shop.asus.com/fi | BLOCKED 403 | UNKNOWN | UNKNOWN |
| shop.asus.com/dk | BLOCKED 403 | UNKNOWN | UNKNOWN |
| shop.asus.com/de | BLOCKED 403 | UNKNOWN | UNKNOWN |
| shop.asus.com/nl | BLOCKED 403 | UNKNOWN | UNKNOWN |
| shop.asus.com/fr | BLOCKED 403 | UNKNOWN | UNKNOWN |
| estore.asus.com/se | BLOCKED 403 | – | – |

- Each store was tried once (one page each). No delivery terms could be read. No EUR offers were recorded, so no exchange rate was used.

## Could not be verified
- ASUS: the estore SKU behind each from-price, the cart, the warranty, and whether X1407 at 8 449 is the CA (Ultra 5 225H) or AA (Ultra 5 325) variant. All ASUS EU delivery terms are unknown.
- HP: 4 of the 16 results in the 32 GB + 14" + ≤15 000 listing (pagination ignored). HP QuickSpecs were not opened.
- Lenovo: the Yoga Slim 7a/7i model lists (they do not render).
- Dell: Pro 14 PC14250 32 GB price (the configurator price was not shown).
- DDR5 SO-DIMM upgrade prices: not checked. This matters for the X1407 and the other upgrade-path offers.
