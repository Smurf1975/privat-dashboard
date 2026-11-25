# Agent new-SE – noter 2026-11-25 (Black Week)

Segment: nya datorer + outlet/demo/B-vara hos svenska butiker. Rådata: `raw-newse-1.json` … `raw-newse-11.json` (verify.js/Playwright). Kompletterat med Tavily extract (TV) för Elgigantens spec-flik och tillverkarens datablad.

## Sammanfattning
- Mycket tunt utbud av ≤15,6" + 32 GB + ≤15 000 kr. Nästan allt med 32 GB/1 TB under 15 000 kr är **slut i lager** (webb) i dag.
- Bästa kvalificerande 1 TB: **ASUS Vivobook S14 S5406SA-QD077W** (Core Ultra 7 258V/32/1TB/14" OLED) – Webhallen 14 499 kr (webb slut, 1 st i Solna, köpknapp synlig), NetOnNet 12 990 kr (restnoterad, ej köpbar).
- I lager nu: HP OmniBook X Flip 14 32/512 12 490 kr och Samsung Galaxy Book6 Pro 14 32/512 W11 Pro 14 990 kr (Elgiganten). Båda 512 GB och tangentbordslayout anges inte → SECONDARY.
- RAM-uppgradering är oekonomisk: NetOnNet visar 32 GB DDR5 SO-DIMM-kit för 5 799–8 349 kr (sökning, ej verifierat). Därför blir t.ex. ThinkPad L14 G5 16 GB (9 495 kr) → NO.

## Per källa

| Källa | Metod | Status | Sökt | Kommentar |
|---|---|---|---|---|
| Elgiganten | PW (kategori, Black Friday-laptopsida, brand/lenovo, brand/asus, windows-laptop s.1–2, produktsidor) + TV (spec-flik) | OK | `/search?q=laptop 32gb` renderade inga produkter (tom lista) – använde kategorisidor i stället | Spec-fliken (tangentbord, laddare) renderas inte i PW-texten; hämtad med Tavily extract. Fyra 32GB/1TB-ASUS/HP-sidor från websökning är `Discontinued` (utgått). Outlet-sidan visade inga laptops med 32 GB. |
| Elgiganten Outlet | PW `/outlet` | OK | första sidan | Bara små tillbehör/telefoner + en IdeaPad 3i 8 GB; inga relevanta laptops. |
| POWER | PW (sök: laptop 32gb, zenbook, vivobook, thinkpad; produktsidor) | OK | Kategori-URL `/barbara-datorer/pl-1341/` redirectar till startsidan | Bra spec i listor. ThinkPads med 32 GB alla 18–58 tkr (för dyrt). Vivobook S14 D3407GA 32/1TB 11 990 kr slut; outlet 1 st från 11 391 kr (i varuhus, skick ej angivet). POWER anger 'Laddare ingår inte' för D3407GA. |
| POWER Outlet | PW `/outlet/` + produktsidornas outlet-rad | OK | outlet-förstasida | Outlet-länkar (`/o-…`) exponeras inte för laptops via produktsidan; skick/varuhus ej verifierbart. |
| NetOnNet | PW (sök 'laptop 32gb', '32 GB RAM', kategori 12–14" och 15–16") | OK | | Endast S5406SA hittad med 32 GB i budget (BackOrder). JSON-LD med SKU/MPN/EAN fungerar. |
| NetOnNet Outlet / Fyndvaror | PW `/art/outlet`, `/art/outlet/dator-surfplatta`, `/art/fyndvaror/dator-surfplatta/fyndvaror-laptop` | OK | | Inga 32 GB-laptops. |
| Webhallen | PW (sök: 'laptop 32gb', '32GB 14', '32GB 15.6', 'thinkpad', 'vivobook 32GB', 'lenovo 32GB', 'HP 32GB', 'zenbook 14 32GB'; produktsidor) | OK | | Bäst sökfiltrering. JSON-LD availability kan säga InStock trots 'Webblager: Ej i lager' – lagerstatusblocket användes. 'Lägg i varukorg' visas även när slut (restorder) → buyable=true men stock OUT_OF_STOCK. |
| Webhallen Fyndvaror | PW (sök 'fyndvara laptop 32GB') | OK | | 32 GB-fyndvaror nästan bara gaming/16"/>20 tkr. Relevanta: Acer A315-44P klass 3 8 090 kr (i lager), Vivobook S14 D3407KA klass 1 14 190 kr (endast butik). |
| Dustin (+outlet) | PW | **BLOCKED** (403, 'Vänta...' bot-verifiering) | `/search?q=laptop 32gb`, `/outlet` | Ändrat sedan tidigare i dag (sources.md sa OK). Ej kringgått. |
| Komplett | PW | **ERROR 502** | startsida, sök, kategori | Fortsatt 502 (tre försök). |
| Inet | PW (ett försök) | **BLOCKED** (403 'Vänta...') | `/kategori/28/barbar-dator` | Ej kringgått. |
| Proshop | PW (ett försök) | **BLOCKED** (403 Cloudflare 'Attention Required') | `/Baerbar` | Ej kringgått. |

Tillverkarkällor: ASUS Global techspec S5406 (TV) – OK; ASUS techspec D3407 – fel sida (generisk Vivobook-sida), max-RAM ej fastställt; Lenovo PSREF L14 Gen 5 (PDF via TV + modellsida via PW) – OK; HP QuickSpecs och Samsung SE-datablad ej hämtade.

## Ej verifierat / osäkert
- Tangentbordslayout saknas på Elgiganten (HP, Samsung), POWER och NetOnNet. Webhallen S5406SA: endast Q&A-svar ('Å Ä Ö finns med'). HP:s art.nr-suffix #UUW brukar betyda nordisk lokalisering, men det står inte på sidan → UNKNOWN.
- Elgigantens spec-fält 'Laddningsenhet medföljer: Nej' för både HP och Samsung – kan vara felaktigt standardvärde; verifiera före köp.
- HP OmniBook X Flip: titel säger OLED, spec-fält säger 'Skärmteknik LCD, 300 nit' – motstridigt.
- Acer A315-44P fyndvara: titel 'R5-7520U' vs spec 'Ryzen 7 5700U'.
- POWER outlet-exemplar: skick, varuhus, tillbehör okända.
- RAM-modulpriser från NetOnNet-sökresultat (upptäckt, ej produktsidor).

## Black Week-kampanjer observerade
- Elgiganten: 'Äntligen Black Friday!' – butiker öppnar 08.00 fredag; laptop-deals 'gäller t.o.m. måndag 30 nov'; '1000:- tillbaka för varje 5000:-' (enl. websök, ej verifierat på sidan); 50 dagars öppet köp för klubbmedlemmar; prismatch.
- POWER: Black Friday-kampanj 9–30 nov, deals släpps löpande; 60 dagars öppet köp.
- NetOnNet: 'Äntligen Black Week'; 90 dagars öppet köp för medlemmar.
- Webhallen: 'Black Weeks!' med överstrukna priser (mest gaming-laptops); fri frakt över 800 kr.
