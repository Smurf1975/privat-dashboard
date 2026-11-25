# Used segment – 2026-11-25 (agent-used)

Output: `agent-used.json` (14 offers). Raw browser dumps: `raw-used-1..5.json`.
No bids, no purchases, no logins. Prices in SEK as shown; shipping separate.

## Blocket (blocket.se) – OK (search via PW, listings via FC)
- **Method:** `verify.js` (Playwright) on search pages worked (titles, prices, seller names, item links).
  On **item pages** Playwright got HTTP 200 + JSON-LD (price, InStock), but `body.innerText` was empty (page not rendered in headless Chromium; no CAPTCHA or block text). That is not a block, so item pages were read with **Firecrawl scrape** (FC), which returned the full listing text.
- **Searches:** `thinkpad 32gb`, `zenbook 32gb`, `elitebook 32gb`, `latitude 32gb`, `asus 32gb laptop`, `x1 carbon 32gb`, `t14 32gb`.
- **Caveat:** on the search page, the order of links does not always match the order of titles (sponsored items). Every offer ID was checked by opening the listing.
- **Buyer protection:** Blocket "Köp nu" + "Frakt med köpskydd" (24 h inspection after delivery) is shown on 28535586, 28350716 and 28261640. Some private ads only show "Be om Frakt med köpskydd" (28509781, 28228758). Company ads (TeknikFix, Strängnäs Datorer) say "fråga säljaren" for shipping, with no Köp nu.
- **Not verifiable on Blocket pages:** the private seller's name, account age and verification status (not shown in the scraped text). Company sellers show "Verifierat företag".

## Tradera (tradera.com) – PW TIMEOUT, FC OK
- `verify.js` timed out (60 s goto timeout) on the search page and the home page again today (2 attempts, raw-used-1/4). The page did not load; it was not a CAPTCHA.
- Firecrawl scrape loaded the search pages and item pages normally (HTTP 200), so all Tradera data comes from FC.
- **Searches:** `thinkpad 32gb`, `32gb 1tb laptop`.
- Tradera item pages show the seller's rating and review count, company/private only for companies ("Företag"), auction vs Köp nu, end time and shipping. "Traderas köparskydd" applies to private sellers. For company sellers it is "valfritt" (opt-in).
- Number of bids was not shown in the scraped text. For auctions the current/starting bid and end time were recorded.

## Facebook Marketplace – NOT ACCESSIBLE
- `verify.js` on `facebook.com/marketplace/stockholm/search?query=thinkpad 32gb` redirected to `/login/`. This was recorded as not accessible. No login attempt.

## Best finds (summary)
| Offer | Price | Why |
|---|---|---|
| tradera:762426734 ThinkPad P14s G3 AMD R7 PRO 6850U/32/1TB/W11P 14" | 7 500 Köp nu (bid 7 000), +75 frakt, ends 5 Dec | Best value 14"/32/1TB. Keyboard layout not stated. |
| blocket:28509781 IdeaPad Slim 5 14" OLED Ryzen AI 7 350/32/1TB, **svensk layout** | 9 000 | Nearly new, receipt, newest CPU at this price. No Köp nu yet (ask for Frakt med köpskydd). |
| blocket:28535586 ASUS Zenbook Duo UX8406MA U7 155H/32/1TB, **Nordic** | 11 995 + 69 + 383 köpskydd | ASUS, brand new review unit, but **no receipt or warranty**. |
| blocket:23712500 / tradera:757181336 X1 Carbon G11 i7-1355U/32/512, **Nordic**, W11P | 11 241 / 12 490 | Company seller TeknikFix, 2-year warranty. Only 512 GB. |
| tradera:759089674 ThinkPad T14 G2 i5-1135G7/32/512, **Swedish**, W11P + TB3 dock | 6 995, free shipping | Company seller MHzData, 12-month warranty. |
| tradera:761965639 T14s G4 i5-1335U/32/512/4G, **Nordic** | starting bid 3 453 + 195, ends 29 Nov 12:48 | Company seller (Fairown, Estonia), 6-month warranty, 14-day right of withdrawal. Final price unknown. |
| tradera:763328570 Yoga Pro 7i 14 U7 255H/32/1TB OLED | 10 000 + 69 | Fastest CPU. Keyboard layout not stated. |
| tradera:690659560 EliteBook 840 G8 i5-1135G7/32/1TB, W11P | 6 249, free shipping | Company seller, 12-month warranty. Keyboard layout not stated. |
| tradera:760861038 XPS 13 9320 i7-1360P/32/1TB | 5 975 + 69 | Cheap. Keyboard layout and OS not stated; check the battery photo. |
| blocket:28261640 Latitude 7520 15.6" i7-1185G7/32/512, **Swedish** | 4 000 + Köp nu | Budget pick, 15.6", worn "A" key legend. |
| blocket:28350716 X1 Carbon G9 i7-1165G7/32/1TB/4G | 6 600 + Köp nu | Win10 Pro. Keyboard layout not stated. |
| blocket:28228758 Zenbook S 14 U7/32/1TB unopened | 13 900, pickup in Malmö | Specs only in a photo. Ask for the receipt. |

## Seen but not included (reason)
- blocket:26933977 ThinkPad T14 Gen 4 32/512, 8 500 kr: pickup only, Swish/cash, no buyer protection, keyboard layout not stated. **Flag:** the same title ("Superkraftig Lenovo ThinkPad T14 Gen 4 …") ended on Tradera at 4 500 kr (tradera:755829371, Avslutad), so the item appears to have been relisted at a higher price.
- blocket:21313543 ThinkPad X13 2-in-1 Gen 5 U7 165U/32/512, 12 500 kr, 13": layout not stated, private seller. A possible alternative.
- blocket:25379480 (5 490) / 25534590 (4 199) Dell Latitude 7320 13.3" i7-1185G7/32/512, Swedish keyboard, company seller Strängnäs Datorer: ads from August, current stock unknown. Only 25379480 was opened.
- blocket:28526905 EliteBook 840 G8 i5/32/1TB, 6 500 Köp nu: private seller, layout not stated. Similar to the MHzData unit, which has a warranty.
- blocket:28514396 (EliteBook 840 G8, 3 500) and 28514245 / 28395007 (EliteBook 845 G8, 4 000): **flag: very thin descriptions** ("Perfect Dator"), no layout, OS or battery info, two near-identical ads (Malmö/Järfälla). The prices are not implausible for 11th-gen/Zen3 machines. Köp nu with köpskydd is available, so the risk is limited, but they are not recommended without more information.
- blocket:26951509 Zenbook Duo 14 UX482EG i7-1165G7/32/1TB, 14 999 kr + 428 köpskydd: above 15 000 kr in total and an old generation. NO.
- blocket:28524760 X1 Carbon Gen 12: only 16 GB of soldered RAM. NO.
- blocket:24407940 X1 Carbon Gen 12 32/512, 15 995 kr: over budget.
- Many 15.6" mobile workstations (P15 G1/G2, P1 Gen3, ZBook Fury/Studio, Precision 75xx/55xx from Teknikfronten/TeknikFix), 9 000–14 900 kr: they meet the hard requirements but are heavy, have a dGPU and are mostly 10th/11th-gen H-series. Not in the JSON. They can be added if a 15.6" workstation is acceptable.
- 16"+ models (P16, P16s, T16, Zenbook S 16, ROG Strix G16/G18): disqualified by screen size.

## Scam / risk flags
- No listings with obvious scam patterns were found (no foreign payment requests, no listings without photos, no unrealistic prices on complete units).
- Tradera "Fairown" is an Estonian company. Payment goes through Tradera with köparskydd, but returns would be cross-border.
- Zenbook Duo 28535586: a review unit with no receipt or warranty (disclosed by the seller).
- Blocket T14 Gen 4 26933977: relisted after a Tradera sale ended. Cash/Swish face to face only.
- In general: for private Blocket sellers, use only Köp nu / Frakt med köpskydd. Never pay by Swish before inspection.

## Could not be verified
- Keyboard layout for P14s G3, IdeaPad (Tradera), Yoga Pro 7i, XPS 9320, EliteBook 840 G8 (MHzData), X1C G9 and Zenbook S 14. These are marked SECONDARY.
- RAM soldering and maximum RAM were not checked against PSREF, HP QuickSpecs or Dell manuals in this run. LPDDR machines are marked soldered (true by design). The others are UNKNOWN.
- Blocket private seller identity and account age. Number of bids on Tradera auctions.
- Final auction prices (P14s G3, IdeaPad Tradera, T14s G4).
- `checked_at` is approximate (20:30–20:55 UTC, 2026-11-25).
