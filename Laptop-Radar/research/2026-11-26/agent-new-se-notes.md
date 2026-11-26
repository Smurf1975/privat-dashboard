# Agent new-SE – noter 2026-11-26 (Black Week, dagen före Black Friday)

Rådata: `raw-newse-1.json` … `raw-newse-7.json` (verify.js/Playwright). Elgigantens spec-flik + tillverkardatablad via Tavily extract (TV). Upptäckt även via Firecrawl search (endast för att hitta URL:er – inget verifierat från sökträffar).

## Sammanfattning – 6 nya erbjudanden (ej i offers-latest.json)
| Erbjudande | Pris | Lager | Status |
|---|---|---|---|
| Samsung Galaxy Book6 14 U7-355/32/1TB IPS – **Elgiganten Outlet** (nyskick, originalförp.) | 11 992 (ny 14 990) | I lager online | YES (tangentbord UNKNOWN) |
| Samsung Galaxy Book6 14 U7-355/32/1TB IPS – Elgiganten ny | 14 990 | 100+ online | YES (på budgettaket) |
| ASUS ExpertBook P3 PM3406CKA R7-350/32/512, Win 11 Pro | 13 495 (BF −1 500) | 50+ online | SECONDARY (512 GB; SO-DIMM → 64 GB, ledig M.2) |
| Lenovo IdeaPad Slim 5 14IMH10 OLED U5-135H/32/512 | 12 990 (BF −5 005) | 100+ online | SECONDARY (512 GB; SO-DIMM, max 32) |
| ASUS Vivobook S14 D3407GA-SF034W – NetOnNet | 10 990 | BackOrder, ej köpbar | SECONDARY (bevaka – billigare än POWER 11 990) |
| ASUS Vivobook S14 S5406SA-PP140W 3K 120 Hz – NetOnNet | 14 999 | BackOrder, ej köpbar | SECONDARY |

## Per källa
| Källa | Metod | Status | Kommentar |
|---|---|---|---|
| Elgiganten | PW: BF-laptopsida, /datorer-kontor/datorer/laptop, windows-laptop sid 1–3 (`/page-N`), brand/asus, brand/lenovo/lenovo-barbar-dator sid 1–2, thinkpad-for-ditt-foretag, brand/hp; produktsidor. TV: spec-flik | OK | `/brand/asus/asus-barbar-dator` = 404. Spec-flik (tangentbord/RAM-platser/OS) renderas inte i PW → TV. Zenbook 14 U9-285H/32/1TB (880044) och Vivobook S14 M5406 R7/32/1TB (768805) = Discontinued/utgått. OmniBook X Flip 14 U7-355/32/512 (1048140) = 22 995 (för dyr). Zenbook S14 UX5406 32/512 16 990 (över budget). |
| Elgiganten Outlet | PW produkt-outlet-sida (länk från produktsidan, `/product/outlet/...`) | OK | Galaxy Book6 14 outlet 11 992 hittad via 'Outlet-pris från' på ny-produktsidan. Även Yoga Slim 7x X2 Elite 32/512 outlet från 20 796 (ARM, för dyr). |
| POWER | PW sök: zenbook 14, vivobook s 14, 32gb 14, thinkpad 32gb (0 träffar), elitebook, galaxy book, expertbook (0 träffar); produktsidor | OK | Prisraden i söklistan hör till *föregående* produkt – priser från söklistan är opålitliga; produktsidor ger JSON-LD. EliteBook 8 G1i/X G1i/6 G1A och Zenbook Duo/Zenbook 14 UX3405CA: alla 20 999–39 999 kr → NO. Kampanjperiod 9/11–30/11 (vissa 23/11–6/12). |
| NetOnNet | PW: laptop-12-14-tum sid 1–3 (`?p=N`), sök '32GB RAM 14', 'zenbook', 'thinkpad', Black Friday-laptopkategori; produktsidor | OK | Söket hittar bara 1 träff för '32GB RAM 14' – kategorisidorna (?p=2) visade två nya ASUS 32 GB, båda BackOrder. Acer Aspire Go 14 C7-150U/32/1TB (1058702) OutOfStock utan pris. |
| Webhallen (+Fyndvaror) | PW sök: '32GB 14', 'thinkpad 32GB', 'elitebook', 'omnibook 32GB', 'galaxy book 32GB', 'swift 32GB', 'expertbook', 'latitude' | OK | Inget nytt ≤15 000 kr: kända 401389 (14 499), 399099 (14 499), 399098 (11 499), 390999 (14 990), 396705 fynd (14 190) syns till samma pris i listan. Zenbook 14 UM3406GA-QL729W 32/1TB 15 990 (just över tak). 'Black Weeks!' mest på gaming/Zenbook Duo. thinkpad/elitebook/latitude/galaxy book = 0 träffar. |
| Komplett | PW sök + kategori | ERROR 502 | Två försök i dag (sök, kategori) – fortsatt 502. |
| Dustin | PW sök | BLOCKED (403 'Vänta...') | Ej kringgått. |
| Inet | PW kategori | BLOCKED (403 'Vänta...') | Ej kringgått. |
| Proshop | PW kategori | BLOCKED (Cloudflare 'Attention Required') | Ej kringgått. |

Tillverkarkällor: ASUS Global techspec PM3406CKA (TV) – OK (2x DDR5 SO-DIMM, max 64 GB; M.2 2280 + 2230). ASUS SE-techspec-URL gav bara filtersida. Lenovo PSREF IdeaPad Slim 5 14IMH10 PDF (TV) – OK (2x DDR5 SODIMM, max 32 GB, två M.2). PSREF produktsida i PW gav ingen text. Samsung-datablad för NP740VJG ej hämtat → RAM-typ/lödd UNKNOWN.

## Kända erbjudanden som syntes i dag (ej omverifierade, bara observerat i listor)
- Elgiganten OmniBook X Flip 14 U7-258V/32/512 (1048139): 12 490 – oförändrat. Galaxy Book6 Pro 14 (1014157): 14 990 – oförändrat.
- NetOnNet S5406SA (1065346): 12 990, fortfarande ej i lager.
- Webhallen-priserna ovan oförändrade.
- POWER D3407GA outlet: söklistan visar ett outlet-block med 8 490 kr nära D3407GA, men pris/produkt-kopplingen i POWER:s lista är förskjuten → EJ verifierat; recheck-processen bör läsa produktsidan.

## Ej verifierat / osäkert
- Tangentbordslayout anges inte för något av de nya erbjudandena (Elgiganten spec-flik saknar layoutfält; NetOnNet likaså).
- Elgiganten 'Laddare ingår ej' på alla tre – kan vara standardvärde (Galaxy Book6 listar USB-C-kabel i förpackningen). Verifiera före köp.
- Galaxy Book6 14: RAM-typ/lödd/max okänt; skärmupplösning 'Full HD (1080p)' enl. spec-flik (troligen 1920x1200, ej bekräftat).
- IdeaPad Slim 5 OLED-upplösning ej läst.
- S5406SA-PP140W: NetOnNet anger både 'DDR5' och 'LPDDR5X on package'; OS ej läst.

## Black Week-kampanjer
- Elgiganten: 'Äntligen Black Friday! På fredag öppnar butikerna 08.00'; BF-priser 'gäller t.o.m. måndag 30 nov'; 1 år M365 på vissa; 'Programvara på köpet' (Adobe); 50 dagars öppet köp för klubbmedlemmar; prismatch.
- POWER: kampanjperiod 9/11–30/11 (vissa 23/11–6/12); 60 dagars öppet köp; 'Upp till 60% på vitvaror'.
- NetOnNet: 'Äntligen Black Week'.
- Webhallen: 'Black Weeks!' (överstrukna priser, mest gaming); fri frakt över 800 kr.
