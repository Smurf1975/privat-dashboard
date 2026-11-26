# Used segment – 2026-11-26 (agent-used)

Output: `agent-used.json` (5 new offers). No bids, no purchases, no logins. Prices in SEK as shown. Shipping and köpskydd fees go in `shipping_sek`.
Known offers in `offers-latest.json` and the IDs seen on 2026-11-25 were not re-verified.
All listing pages below were opened today, 2026-11-26 around 06:40–06:50 UTC.

## Blocket – OK (search via PW, listings via FC)
- **Search:** `verify.js` on 21 search pages sorted by `sort=PUBLISHED_DESC`. Queries: thinkpad 32gb, zenbook 32gb, elitebook 32gb, latitude 32gb, x1 carbon 32gb, t14s 32gb, 32gb 1tb laptop, asus 32gb laptop, dell 32gb 14, hp 32gb laptop, lenovo 32gb, 32gb ram 14, 32 gb ram laptop, yoga 32gb, xps 32gb, thinkpad 32 gb, probook 32gb, swift 32gb, ryzen 32gb laptop, ultra 7 32gb, bärbar dator 32gb.
- Title/ID mapping: today the link order matched the title order (checked against a Firecrawl scrape of the zenbook search). Every included ID was confirmed by opening the listing with FC (`maxAge: 0`).
- "Newest first" also includes **bumped** company ads (EL Green, Teknikfronten, TeknikFix) with old IDs. "Senast ändrad" on the listing page gives the real edit date.
- Few genuinely new 32 GB 14" listings in the last 24 h. Most fresh hits were 16 GB, 15.6–17" workstations, or ads already known.

## Tradera – FC only (PW not retried; times out per known behaviour)
- FC search: `32gb laptop`, `thinkpad 32gb`, `asus 32gb`, `elitebook 32gb` (`sortBy=AddedOn`). FC item pages loaded fine (HTTP 200).
- Few new laptop items since yesterday. The new IDs 7633xxxxx were mostly RAM modules, a ThinkPad W520, and a cross-post of the 16" Acer Swift Edge.

## Facebook Marketplace – NOT ACCESSIBLE
- It requires login (it redirected to /login on 2026-11-25). Not retried. No login attempt.

## New offers (in JSON)
| Offer | Price | Notes |
|---|---|---|
| tradera:762036910 Dell Latitude 7420 14" 4K, i7-1185G7/32/1TB, **Swedish kb**, W11 Pro | **current bid 2 385** (no buy-now) + 75 frakt, **ends 29 Nov 20:30** | YES. Top seller with 761 reviews, Tradera köparskydd. The final price will rise. 11th gen. |
| blocket:28205689 ASUS Zenbook S 14 UX5406SA-PURE6W, U7 258V/32/1TB, 3K OLED 120Hz | 13 490 | Company seller EL Green (verified company), refurbished "som ny", 6-month warranty. **Keyboard layout not stated** (the same seller's other ads say "nordisk"). Ask first. No Köp nu; shipping not stated. |
| blocket:25897775 Lenovo Yoga Slim 7i Aura 15.3", U7 258V/32/1TB | 14 000 + 69 + 413 köpskydd | 15.3" (OK ≤15.6). Köp nu. Battery 97%. Keyboard layout unknown. Ad from October, but not in offers-latest. |
| blocket:28545359 Lenovo Yoga Slim 7 Aura 14", U7 258V/32/**512**, 2.8K OLED | 14 000 + 413 köpskydd (free shipping) | New 25 Nov. Has the receipt with warranty remaining. 512 GB and near the budget cap. SECONDARY. |
| blocket:28524025 HP ZBook Firefly 14 G8, i7-1165G7/32/512 + T500 | 4 500 + 69 + 240 köpskydd | Budget pick, Köp nu, battery about 90%. Keyboard layout unknown. Older gen. |

## Seen but not included (reason)
- blocket:28382498 / tradera:763345099 Acer Swift Edge, Ryzen 7 PRO 6850U/32/1TB, 10 900: **16"** per the description (the title does not say). Disqualified.
- blocket:28205980 Zenbook 14 UX3405CA-PURE2 (10 490) and blocket:27542600 UM3406KA (8 490): only 16 GB of soldered RAM (both Nordic, EL Green). NO.
- blocket:27015747 Zenbook A14 UX3407QA: Snapdragon/ARM. NO.
- blocket:26250067 Zenbook Duo UX8406CA, 16 490: over budget.
- blocket:28540779 Yoga 7 Pro OLED, 5 000: 16 GB. blocket:28544335 EliteBook 840 G8, 2 400: 8 GB. blocket:28543178 Zenbook 14 OLED: 16 GB.
- tradera:762008955 HP EliteBook 8 G1i 14", Ultra 5 235U/32/**256 GB**, bid 5 450, **ends today 26 Nov 22:38**: the storage is too small, so it was not opened. Possible only if a cheap SSD swap is acceptable.
- tradera:759753589 HP EliteBook 845 G9 14", R5 6600U/32/1TB, Swedish keyboard, 11 389 Köp nu (TeknikFrontenAB, company seller, 3-month warranty): **flag: the description contradicts itself.** It says 13.3", "256 GB SSD" in the body, and a price of 10 689 in the text. Weak value against known P14s G3 offers. Ask before buying.
- tradera:759753016 EliteBook 840 G9 i5-1235U/32/1TB, 10 889 (TeknikFronten, "Märken lock"): the FC scrape did not return the description. Not verified.
- Many TeknikFronten/TeknikFix 15.6–17" workstations and 16" P16/Precision 76xx: too large or heavy, mostly older H-series chips.
- tradera:762205964 / blocket X1 Carbon G13 Aura 32/1TB, 17 091–18 990: over budget.
- Old/low-gen 32 GB units (ThinkPad L480, T480, T470, W520, P52): too old.

## Scam / risk flags
- No obvious scam patterns today.
- EliteBook 845 G9 (tradera:759753589) has an inconsistent copy-paste description. Treat its specs as uncertain.
- Acer Swift Edge appears on both Blocket and Tradera. This is a normal cross-post, but the title hides the 16" screen size.
- Private Blocket sellers: use only Köp nu / Frakt med köpskydd (24 h inspection). Never pay by Swish before inspection.
- EL Green ads have no Köp nu. The deal would go directly with the company (6-month warranty). Distance-selling rules apply if ordered remotely. Check this.

## Could not be verified
- Keyboard layout for Zenbook S 14 (28205689), both Yoga Aura listings, and ZBook Firefly 14 G8.
- RAM soldering/max for Latitude 7420 and ZBook Firefly G8 (no Dell manual or HP QuickSpecs check). For Lunar Lake (258V) units, RAM is on-package by design.
- Final auction price for Latitude 7420. Number of bids is not shown in the FC text.
- Identity and account age of private Blocket sellers (login required).
- EL Green shipping cost and whether they sell remotely.
