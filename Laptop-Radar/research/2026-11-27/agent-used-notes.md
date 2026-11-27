# Used segment – 2026-11-27 (agent-used)

Output: `agent-used.json` (7 offers). No bids, no purchases, no logins. Prices in SEK as shown. Shipping and köpskydd fees go in `shipping_sek`.
Known offers in `offers-latest.json` and the IDs seen on 2026-11-26 were not re-verified. All pages were opened on 2026-11-27 around 06:30-06:50 UTC.

## Blocket
- Search via `verify.js` (PW, 17 pages sorted by `sort=PUBLISHED_DESC`): thinkpad 32gb, zenbook 32gb, elitebook 32gb, latitude 32gb, x1 carbon 32gb, 32gb 1tb laptop, t14s 32gb, bärbar dator 32gb, asus 32gb laptop, ultra 7 32gb, ryzen 32gb laptop, lenovo 32gb.
- Item IDs were taken from the `--links` output, matched to titles by order, and each included ID was confirmed by an FC scrape (`maxAge: 0`) of the listing page.
- Few genuinely new 32 GB 14" listings in the last 24 h. Newest hits: Envy x360 (15 h), unused ThinkPad T14 Gen 6 (17 h). Others were edited 23-24 Nov and are new to the register.

## Tradera (FC only)
- FC search `laptop 32gb` sorted by `AddedOn`. The `thinkpad 32gb` search exceeded the output limit and was not read. Most new hits were RAM modules, MacBooks, gaming or 15.6"+ workstations. New relevant items: 763434185, 763369171, plus the older 762258362.

## Facebook Marketplace – skipped (login required).

## Offers in JSON
| Offer | Price | Notes |
|---|---|---|
| blocket:28564992 HP Envy x360 14", U7 155U/32/1TB OLED | 12 500 + 69 + 390 köpskydd | YES. Private. Keyboard/OS not stated. Tradera cross-post tradera:763439362 (not opened). |
| blocket:28563003 ThinkPad T14 Gen 6, Core Ultra 7, unused | 13 000 + 398 köpskydd (free shipping) | SECONDARY. **RAM and SSD not stated.** Priority model: ask first. |
| blocket:28526905 EliteBook 840 G8 i5-1145G7/32/1TB | 6 500 + 290 köpskydd (free shipping) | YES. Older gen. Edited 24 Nov. Keyboard unknown. |
| blocket:28490841 HP Spectre x360 14 U7 155H/32/1TB | 9 000 + 69 + 337 köpskydd | YES. Edited 23 Nov. Battery 89%. Keyboard unknown. Buy button unclear. |
| tradera:763434185 Yoga Slim 7 Aura U7 258V/32/512 | **bid 5 000**, buy-now 12 000, **ends 30 Nov 17:50** | SECONDARY (512 GB). Ship from 59. Probably the same unit as known blocket:28545359 (14 000 kr). |
| tradera:763369171 ThinkPad X1 Yoga Gen 9 U7 155U/32/1TB, **Nordic** | 14 285 + 115 (about 14 400) | YES. Fixed price, ends 25 Jan 2027. Warranty claim to 2028. |
| tradera:762258362 EliteBook 640 G9 i5-1235U/32/512 | 4 500 + 59 | SECONDARY (512 GB, 640 series). |

## Seen but not included
- Blocket 28558695 Zenbook 14 OLED UX3407RA (11 990, EL Green, opened): **Snapdragon X Elite (ARM)**, Windows 11 Home ARM. NO. Same for 28558430 and 27015747 (QA models).
- Blocket 28514396 EliteBook 840 G8 i5/32/500 GB (3 500) and 28514245 EliteBook 845 G8 R5 Pro/32/500 GB (4 000), both Malmö, private: older gen and 500 GB, not opened. Possible budget picks.
- Blocket 28509781 IdeaPad Slim 5 OLED 14" and 28535586 Zenbook Duo: already known.
- Blocket 28382498 / tradera:763345099 Acer Swift (16", disqualified 26 Nov). 28508802 Zenbook S 16 (16"). 27611328 ThinkPad 14" Ryzen AI PRO 32/1TB (18 500, over budget). tradera:762582398 Latitude 14 Plus U7 268V/32/512 (17 000, over budget).
- TeknikFronten/TeknikFix/Teknikfronten items: 15.6-17" workstations (Precision, ZBook, P-series) or 16 GB/256 GB. EliteBook 845 G9 16/256, EliteBook 840 G9 16/256: 16 GB. blocket:28559772 EliteBook 840 G5 24 GB: too old.
- Other new Tradera hits: MacBook (ARM), RAM modules, gaming laptops, ThinkPad W520, Precision/ZBook workstations. Not relevant.

## Scam / risk flags
- No obvious scam patterns. Private sellers on Blocket: use only Köp nu with "Frakt med köpskydd" (24 h inspection). Never pay by Swish up front.
- tradera:763369171: title says 'NY' while the condition field says 'Mycket gott skick'. Battery and 2-year Premier warranty claims are unverified. Ask for the invoice and Lenovo serial.
- blocket:28563003: the title is generic and the ad has no RAM/SSD, so the 32 GB requirement is unconfirmed. The seller's "new price 21 000" is unverified.
- Seller names on Tradera: company status is not shown on the pages read, so none are confirmed as companies.

## Could not verify
- Keyboard layout: all except X1 Yoga (Nordic).
- RAM soldering for Envy x360, Spectre x360, T14 Gen 6; module config for EliteBook 840 G8.
- Number of bids on 763434185. Seller type of 763434185, 763369171, 762258362.
- Tradera `thinkpad 32gb` search (output too large).
