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
| Dustin | dustin.se (bärbara datorer) | PW | OK 2026-11-25 |
| Komplett | komplett.se | PW | FEL 502 2026-11-25 – testa igen |
| Inet | inet.se | PW | BLOCKED (bot-verifiering) 2026-11-25 |
| Proshop | proshop.se | PW | BLOCKED (Cloudflare) 2026-11-25 |
| Lenovo SE | lenovo.com/se/sv | PW | OK 2026-11-25 |
| HP SE | hp.com/se-sv/shop | PW | ej testad |
| Dell SE | dell.com/sv-se | PW | ej testad |
| ASUS Store SE | shop.asus.com/se | PW | BLOCKED (403) 2026-11-25 |

## B. Öppnat/demo/B-vara/outlet
Elgiganten Outlet, NetOnNet Outlet/Fyndhörna, Webhallen Fyndvaror, POWER Outlet, Dustin Outlet, Komplett Fyndhörna, Lenovo Outlet SE.

## C. Refurbished
Inrego (inrego.se), Refurbed (refurbed.se), Reuseit (reuseit.se), Looptop, Nuovo, Begagnad.se/Reuse, Backmarket.se, Foxway/Webhallen refurb, NetOnNet Refurbished.

## D. Begagnat
Tradera (timeout 2026-11-25), Blocket (OK), Facebook Marketplace (kräver inloggning → ej åtkomligt). Prioritera företagssäljare, köpskydd. Undvik misstänkta annonser.

## E. ASUS officiella EU-butiker
shop.asus.com/{se,fi,dk,de,nl,fr}. Verifiera leverans till Sverige, layout, moms, frakt, garanti, retur. Anta aldrig leverans till SE.

## Upptäckt (ej verifiering)
WebSearch, Tavily search, Firecrawl search, Prisjakt/PriceRunner (Prisjakt sök = Cloudflare 2026-11-25), pricespy-historik där åtkomligt.
