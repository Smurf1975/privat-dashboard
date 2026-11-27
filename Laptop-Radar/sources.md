# Källregister

Status uppdateras varje körning. Metod: **PW** = Playwright/Chromium (`scripts/verify.js`), **WS** = webbsök (upptäckt), **FC** = Firecrawl scrape (renderad sida, endast där sidan inte blockerar), **TV** = Tavily extract.
BLOCKED = CAPTCHA/Cloudflare/403. Respekteras – kringgås aldrig. Prisjämförare = endast upptäckt.

## A. Nya – Sverige
| Källa | URL / ingång | Metod | Status (senast testad) |
|---|---|---|---|
| Elgiganten | elgiganten.se/datorer-kontor/datorer/laptop | PW | OK 2026-11-25 |
| POWER | power.se (laptops) | PW | OK 2026-11-25 |
| NetOnNet | netonnet.se/art/dator-surfplatta/laptop/laptop-12-14-tum | PW | OK 2026-11-25 (JSON-LD m. SKU/MPN/EAN) |
| Webhallen | webhallen.com/se (bärbara datorer) | PW | OK 2026-11-25 |
| Dustin | dustin.se (inkl. outlet/Pre-owned) | PW | BLOCKED (403 bot-check) 2026-11-25 (OK tidigare samma dag) |
| Komplett | komplett.se | PW | FEL 502 2026-11-25 och 2026-11-26 |
| Inet | inet.se | PW | BLOCKED (bot-verifiering) 2026-11-25 |
| Proshop | proshop.se | PW | BLOCKED (Cloudflare) 2026-11-25 |
| Lenovo SE | lenovo.com/se/sv (+ PSREF för RAM) | PW | OK 2026-11-25. Ingen SE-outlet (404). |
| HP SE | hp.com/se-sv/shop | FC | OK via Firecrawl; PW kraschar (klientfel) 2026-11-25 |
| Dell SE | dell.com/sv-se | PW | OK butik; support-/manualsidor 403 2026-11-25. Latitude ersatt av Dell Pro. |
| ASUS Store SE | shop.asus.com/se | PW | BLOCKED (403) 2026-11-25 |

## B. Öppnat/demo/B-vara/outlet
Elgiganten Outlet, NetOnNet Outlet/Fyndhörna, Webhallen Fyndvaror, POWER Outlet, Dustin Outlet, Komplett Fyndhörna, Lenovo Outlet SE.

## C. Refurbished
| Källa | Ingång | Metod | Status |
|---|---|---|---|
| Looptop | looptop.se/collections/begagnade-laptops/products.json (Shopify-flöde: layout + lager per variant) | PW | OK 2026-11-25 – bästa startpunkt |
| Reuseit | reuseit.se/sv/product/... | FC | OK via Firecrawl; PW visar 404 (renderingsfel, ej blockering) |
| Inrego | shop.inrego.se (inte inrego.se) | PW | OK 2026-11-25 |
| Refurbed | refurbed.se | PW | OK 2026-11-25 |
| Back Market | backmarket.se | PW | BLOCKED 2026-11-25 |
| Begagnad.se | begagnad.se | PW | FEL 520 2026-11-25 – testa igen |
| Nuovo | nuovo.se | – | Domänen till salu. Testa nuvoo.com istället. |
| Nuvoo | nuvoo.com/sv-se (Shopify) | PW | OK 2026-11-26 – ny källa, layout anges ofta ej |
| NetOnNet/Webhallen refurb | | PW | OK, inga 32 GB 2026-11-25 |

Övriga: Inrego (inrego.se), Refurbed (refurbed.se), Reuseit (reuseit.se), Looptop, Nuovo, Begagnad.se/Reuse, Backmarket.se, Foxway/Webhallen refurb, NetOnNet Refurbished.

## D. Begagnat – UTESLUTET från 2026-11-28
Blocket och Tradera tas inte med (användarens beslut 2026-11-27). Facebook Marketplace ej åtkomligt. Historiska data finns kvar i price-history/ men omkontrolleras inte.

## E. ASUS officiella EU-butiker
shop.asus.com/{se,fi,dk,de,nl,fr} + estore.asus.com: alla 403 BLOCKED 2026-11-25. asus.com/se (info-sidor, specar) OK. Verifiera leverans till Sverige, layout, moms, frakt, garanti, retur. Anta aldrig leverans till SE.

## Upptäckt (ej verifiering)
WebSearch, Tavily search, Firecrawl search, Prisjakt/PriceRunner (Prisjakt sök = Cloudflare 2026-11-25), pricespy-historik där åtkomligt.
