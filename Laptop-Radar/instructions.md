# Laptop Radar – daglig körinstruktion (runbook)

Denna fil styr varje daglig körning. Den schemalagda uppgiften säger bara "kör Laptop-Radar/instructions.md".
Arbetsyta: `privat-dashboard/Laptop-Radar/` på git-grenen `ccr-26489512-5t7dlt` (repo Smurf1975/privat-dashboard).
Containern är tillfällig – **allt som ska sparas måste committas och pushas** (steg 9).

## 0. Förberedelse
1. `cd /home/user/privat-dashboard` (finns inte repot: klona det / `add_repo` Smurf1975/privat-dashboard).
2. `git fetch origin ccr-26489512-5t7dlt && git checkout ccr-26489512-5t7dlt && git merge --ff-only FETCH_HEAD`
3. `D=$(TZ=Europe/Stockholm date +%F)`; `mkdir -p Laptop-Radar/research/$D`
4. Kontrollera `node -e "require('playwright')"`. Fungerar inte Playwright: logga FEL, fortsätt med Firecrawl scrape / Tavily extract som reserv (markera `source`).

## 1. Läs (i denna ordning)
instructions.md · search-profile.md · verification-rules.md · history.md · current-ranking.md · watchlist.md · sources.md · senaste raden i run-log.md.

## 2. Kontrollera kända erbjudanden igen (pris/lager)
- `python3 scripts/recheck.py $D` → `research/$D/recheck-urls.txt`
- `cd scripts && node verify.js --out ../research/$D/raw-recheck.json --file ../research/$D/recheck-urls.txt`
- Läs resultatet. Skriv `research/$D/agent-recheck.json` (schema i verification-rules.md) med dagens pris, lager, köpbarhet, kampanj. Sida borta/404 → `stock: "GONE"`. BLOCKED/ERROR → `verification: "BLOCKED"`/`"ERROR"` (historiken ändras då inte).

## 3. Upptäckt av nya kandidater
Starta upp till 3 bakgrundsagenter (general-purpose), en per segment:
1. `new-se` – nya + outlet/demo/B-vara: Elgiganten, POWER, NetOnNet, Webhallen, Dustin, Komplett (+ logga Inet/Proshop-status).
2. `mfr` – Lenovo/HP/Dell SE + ASUS SE + ASUS EU-butiker (fi, dk, de, nl, fr; verifiera leverans till SE).
3. `refurb` – Inrego, Refurbed, Reuseit, Looptop, Nuovo, Backmarket, Begagnad.se, NetOnNet/Dustin refurb.
Blocket/Tradera ingår INTE (uteslutet från 2026-11-28).
Alla agenter: ta även med laptops med **16 GB som går att bygga ut till 32 GB** enligt search-profile.md ("16 GB uppgraderbar"): verifiera platser/max i databladet, öppna en svensk butikssida för rätt RAM-modul samma dag och ange `pris + RAM = total`.
Varje agent: läs search-profile/verification-rules/sources + `price-history/candidates.json` (för att inte lägga tid på redan kända kandidater annat än nya erbjudanden), verifiera med `scripts/verify.js`, skriv **endast** `research/$D/agent-<segment>.json` + `agent-<segment>-notes.md`. Agenter får **inte** committa, schemalägga eller ändra andra filer.
Fokus dag för dag: nya kandidater, nya kampanjer, bättre alternativ. Inte att lista samma saker igen.

## 4. Konsolidera
- `python3 scripts/merge.py $D` → `research/$D/offers.json` (dubbletter bort). Åtgärda varningar.
- Kontrollera stickprov: varje VERIFIED ska ha öppnad produktsida i `raw-*.json`.
- `python3 scripts/record.py $D` → uppdaterar `price-history/` och skriver `research/$D/changes.md`.

## 5. Bedöm förändringarna
Skilj på äkta prissänkning, tillfällig kampanj, uppblåst "ord. pris", lagerrensning och ointressant prisändring. Jämför mot `best_price_sek` i candidates.json och mot prishistorik (PriceRunner/Prisjakt där åtkomligt – endast som referens).

## 6. Uppdatera filer
- `current-ranking.md` – topplista enligt vikter i search-profile.md (en rad per kandidat, bästa erbjudandet + övriga butiker).
- `watchlist.md` – lägg till/ta bort, uppdatera nuvarande/bästa pris och senast verifierad.
- `history.md` – lägg till dagens avsnitt (kort: nya kandidater, prisändringar, försvunna, blockerade källor).
- `sources.md` – uppdatera statuskolumnen.
- `daily-report.md` – skriv om helt (format nedan).

## 7. Daglig rapport (`daily-report.md`)
Inga meningsfulla förändringar → exakt:
> No new qualifying deals or meaningful changes today.

plus en rad om ev. blockerade källor.
Annars, per fynd: modell · SKU/MPN · pris · butik · lager · nyckelspecar (CPU/RAM/SSD/skärm/tangentbord/OS) · skick · garanti · retur · länk · verifieringsstatus · varför intressant.
Avsnitt: Nya kandidater · Prissänkningar · Lager/kampanj · Försvunna · Blockerat/ej verifierat · Körstatus.

## 7b. LÄNKKONTROLL – obligatorisk före publicering
Krav från användaren: **varje produkt i rapport och ranking ska ha en direktlänk till produktsidan som öppnats och bekräftats samma dag.**
1. Varje rad/fynd i daily-report.md och current-ranking.md har en fullständig direkt-URL (aldrig bara domän eller annons-ID).
2. Kör `python3 scripts/check_links.py $D` (öppnar alla länkar i Chromium).
3. Länkar som ger ERROR/tom titel (Reuseit, HP) → kontrollera med Firecrawl scrape (`maxAge: 0`) att sidan är aktiv och stämmer (titel, pris).
4. Länk som är död, såld, avslutad eller visar annan produkt → ta bort fyndet från rapporten (markera GONE i historiken). Ingen overifierad länk får stå kvar.
5. Avsluta daily-report.md med: `Länkkontroll: X/Y länkar öppnade och bekräftade <datum tid> (PW: n, FC: m).`

## 8. Loggning
Lägg till en rad i `run-log.md`: datum/tid, status (OK / DELVIS / FEL), antal kontrollerade erbjudanden, nya kandidater, förändringar, blockerade källor, fel. **Rapportera aldrig OK om researchen misslyckades.**

## 9. Spara
`git add Laptop-Radar && git commit -m "Laptop Radar: daglig körning $D" && git push -u origin ccr-26489512-5t7dlt` (försök igen upp till 4 ggr vid nätverksfel; vid avvisad push: `git fetch` + `git merge --no-edit FETCH_HEAD`, sedan push).

## 10. Avisering
Sista meddelandet i körningen = kort sammanfattning (≤10 rader) av daily-report.md, inleds med `LAPTOP RADAR $D:`. Skicka också `PushNotification` (≤200 tecken) om det finns meningsfulla fynd eller om körningen fick FEL.

## Kända källbeteenden (se sources.md)
- Renderas inte i Playwright (ej blockering): Reuseit (visar 404), HP Store (klientfel) → läs produktsidan med Firecrawl scrape (`maxAge: 0`, format `query`), `source: "FC"`.
- Looptop: använd Shopify-flödet `looptop.se/collections/begagnade-laptops/products.json` för upptäckt, produktsidan för verifiering.
- Blockerade (403/Cloudflare): Inet, Proshop, Dustin, Back Market, alla shop.asus.com/estore.asus.com. Ett försök per körning, sedan BLOCKED. Kringgå aldrig (ingen stealth-proxy).

## Användningsgräns
Om agenter stoppas av konto-/veckogräns (HTTP 429): granska deras delfiler, gör resten själv i reducerad form (omkontroll + butikernas kampanjsidor), markera körningen DELVIS och skriv i rapporten vilka segment som inte genomfördes.

## Felhantering
- En källa fallerar → logga, fortsätt med övriga.
- Playwright kraschar → starta om en gång; annars FC/TV som reserv.
- Agent fallerar → kör segmentet själv i reducerad form eller markera segmentet som ej genomfört.
- Prisutdrag osäkert → `verification: "PARTIALLY VERIFIED"` + notering.
- Ändrad sidlayout → använd sidtext/JSON-LD; notera i sources.md.
- Git-push misslyckas → rapportera tydligt i sista meddelandet (data finns annars bara i containern).
