# Hälsomodulen — arkitektur och kontrakt (Fas 0)

**Skapad:** 2026-08-11 · **Status:** Fas 0 klar (foundation, ingen live-källa kopplad ännu)
**Bakgrund & beslut:** `Knowledge Base/raw/files/Hälsa/Hälsa-Know/` (Arkitekturanalys + Second Opinion, Ä1–Ä5) · BUILD_CONTRACT: `AI Native OS/04_APPS/Command-Center/BUILD_CONTRACT.md`

## Flöde

```
Samsung Health ┐
EufyLife       ├→ Health Connect (telefonen) → Health Connect Webhook-appen
Sleep as Android ┘                                    │ POST + x-halsa-secret
                                                      ▼
                                   Edge Function halsa-ingest  (kod: supabase/functions/halsa-ingest/)
                                                      │ service role, idempotent upsert
                                                      ▼
                  halsa_metrics · halsa_sleep_sessions · halsa_ingest_log   (RLS: läs = endast Mats; skriv = ingen klient)
                                                      ▼
                          halsa_daily_v · halsa_status_v   (security_invoker-vyer — enda ytan frontend läser)
                                                      ▼
                          index.html Hälsa-fliken (fetchHalsa i befintlig poll-loop, localStorage-cache)
```

Lagren är avsiktligt separerade: **transporten (bryggappen) kan bytas utan att någon rad nedströms ändras.**

**Andra dörren in (2026-09-14): Vågen-kortet i Hälsa-fliken.** EufyLife-export (CSV) eller manuell vikt → `halsa-import.js` bygger samma payload → samma `halsa-ingest`, men autentiserad med Mats inloggade Supabase-session i stället för delad hemlighet. Ingen ny tabell, funktion eller vy.

## Datamodell

### `halsa_metrics`
En rad per mätvärde. `ts` = mätpunkt eller intervallstart (UTC). `end_ts` = intervallslut, `null` för punktvärden (Ä1).
**Dedup-nyckel:** `unique(metric, ts, dedup_end_ts, source)` där `dedup_end_ts` är en lagrad genererad kolumn `coalesce(end_ts, ts)` — vald i stället för expression-index så att PostgREST-upsert (`on_conflict` tar bara kolumnnamn) kan använda nyckeln.
**Upsert-semantik (Ä2):** `ON CONFLICT DO UPDATE` — återlevererade/korrigerade poster uppdaterar värdet; `updated_at` sätts via trigger, `created_at` bevaras.

### Kanoniska metrics och enheter (ingest-kontraktet)

| metric | enhet | typ | källfält (HC Webhook) |
|---|---|---|---|
| `steps` | count | intervall | `steps[].count` |
| `heart_rate` | bpm | punkt | `heart_rate[].avg` (5-min-buckets; `bpm` vid full upplösning) — verifierat 2026-08-12 |
| `resting_heart_rate` | bpm | punkt | `resting_heart_rate[].bpm` |
| `hrv` | ms | punkt | `heart_rate_variability[].rmssd` |
| `weight_kg` | kg | punkt | `weight[].weight_kg` |
| `body_fat_pct` | pct | punkt | `body_fat[].percentage` |
| `lean_body_mass_kg` | kg | punkt | `lean_body_mass[].mass_kg` |
| `height_m` | m | punkt | `height[].height_m` |
| `active_calories` / `total_calories` | kcal | intervall | `*_calories[].energy_kcal` |
| `distance_m` | m | intervall | `distance[].distance_meters` |
| `spo2_pct` | pct | punkt | `oxygen_saturation[].percentage` |
| `vo2_max` | ml/kg/min | punkt | `vo2_max[].vo2_max` |
| `exercise_minutes` | min | intervall | beräknas ur `exercise_sessions[].start/end_time` |

⚠ *ponytail:* källfältnamnen är antagna från HC Webhooks dokumentation och har fallback-kandidater i koden; de **verifieras mot verklig payload i Fas 1**. Okända fält/typer räknas som `skipped` — aldrig krasch, aldrig gissning.

### `halsa_sleep_sessions`
En rad per sömnsession: `start_ts`, `end_ts`, `quality` (null tills källa ger score), `phases` (jsonb, HC-stages). Dedup: `unique(start_ts, source)`; upsert uppdaterar slut/faser (användarredigerade sessioner). Känd begränsning: redigeras *starttiden* i källappen blir det en ny rad — Ä4-regeln i vyn neutraliserar dubbletten.

### `halsa_ingest_log`
Kvitto per synk: räknare (received/upserted/skipped/errors), `latest_record_ts`, `error_summary`. **Aldrig rå-payload eller hälsovärden i loggen.** Driver stale-indikatorn.

### `source` = transport (Ä5)
`hc_webhook` · `samsung_export` · `manual`. Betyder HUR posten kom in — **aldrig** vilken app som mätte. `manual` täcker både EufyLife-filimport och formuläret i Vågen-kortet (transporten är i båda fallen "Mats via dashboarden"); `raw.origin` = `eufy_export` | `manual_form` skiljer dem när det behövs. Käll-app finns inte i bryggans payload och får inte antas i vyer eller analys. Om framtida payload innehåller app-metadata läggs det som eget fält (`origin_app`), semantiken på `source` ändras inte.

## Vyer

**`halsa_daily_v`** — dagsaggregat. Regler:
- **Dagsgräns:** svensk kalenderdag via `ts at time zone 'Europe/Stockholm'` — DST-säkert, ingen hårdkodad offset. Ansvaret för UTC→lokal dag ligger HÄR (frontend jämför bara datumsträngar).
- Intervallvärden räknas på dagen de **startar**.
- **Sömn ("natt"):** en session tillhör dagen man **vaknar** (`end_ts`:s lokala datum). En session 23:20–07:10 hamnar alltså odelad på uppvakningsdagen.
- **Ä4 sömnprioritet:** exakt EN primär session per uppvakningsdag — den **längsta**. Motiv: payloaden saknar käll-app, så "föredra app X" är omöjligt utan påhittad precision; längsta sessionen är huvudsömnen medan tupplurar och dubbelregistreringar bortfaller. Ingen summering av parallella sessioner = ingen dubbelräkning. Omprövas i Fas 3 mot verklig data.
- Vikt/kroppsfett per dag = sista värdet den dagen (tillstånd, inte flöde).

**`halsa_status_v`** — en rad: `last_sync_at` (senaste lyckade ingest), `latest_record_ts`, senaste vikt/kroppsfett/vilopuls oavsett dag (vikten kan vara dagar gammal och ska ändå visas).

**`halsa_natt_v`** (Fas 2) — en rad per natt: start/slut, timmar, fasfördelning (`djup_h`/`rem_h`/`latt_h`/`vaken_h`), härledd `vilopuls`, och `hypnogram` — en kompakt array `[offset_min, längd_min, stage]` per segment, mätt från sömnstart. Den formen är ~10× mindre än rå `phases`-jsonb och ritas direkt av klienten.

**`halsa_puls_15m_v`** (Fas 2) — puls per 15-minutersfönster och dag: `lo`/`snitt`/`hi`. `lo` och `hi` läses ur `raw`-fältets min/max per Samsung-bucket, så bandet visar sant lägsta–högsta, inte bara spridningen mellan snittvärden.

### Härledd vilopuls
Samsung delar **inte** `RestingHeartRate` via Health Connect — `resting_heart_rate` var därför alltid null. `halsa_natt_v` härleder den i stället som **10:e percentilen av pulsen under sömnfönstret**, samma proxy klockor använder. Percentil i stället för rent min-värde gör den robust mot enstaka artefakter. `halsa_daily_v.resting_heart_rate` hämtas numera härifrån.

### Health Connect sleep stage-koder
`1` = vaken · `2` = sover (ospecificerat) · `3` = ur sängen · `4` = lätt · `5` = djup · `6` = REM · `7` = vaken i sängen. Vyn slår ihop 2/4/0 → lätt och 1/3/7 → vaken.

Båda är vanliga vyer med `security_invoker = true` → RLS på undertabellerna gäller den som frågar. Ingen materialized view, ingen RPC — datavolymen (~10³–10⁴ rader/år) motiverar det inte.

## Säkerhet

- **RLS läs:** `(auth.jwt()->>'email') = 'mats@enmarks.se'` på alla tre tabellerna (voxmats-mönstret). Familjesessioner och anon ser 0 rader — verifierat med rolltester.
- **RLS skriv:** inga skrivpolicies → endast service role (ingest-funktionen) kan skriva. Klient-INSERT nekas — verifierat.
- **Ingest-auth:** HTTPS + delad hemlighet i headern `x-halsa-secret`, jämförd i konstant tid mot **två** Vault-nycklar: `halsa_ingest_secret_current` + `halsa_ingest_secret_previous` → rotation utan avbrott. Nycklarna genererades inne i Postgres (`gen_random_bytes`) och har aldrig lämnat databasen; de hämtas av funktionen via RPC `halsa_get_ingest_secrets()` som endast `service_role` får exekvera (verifierat: authenticated nekas).
- **Nyckelrotation** (System change — kräver Mats godkännande): 1) skapa ny nyckel som `..._current`, flytta gamla till `..._previous` (`vault.update_secret`), 2) uppdatera bryggappens header, 3) när bryggan bekräftat fungera: byt ut `..._previous`. Ingest fortsätter fungera hela vägen.
- **Rate limiting:** beslut = ingen utöver secret-auth. Hotmodell: privat oannonserad endpoint, en användare; skadan vid läcka begränsas av idempotent upsert (ingen läsväg, ingen delete). Supabase plattformsskydd ligger utanpå. Omprövas om loggen visar missbruk.
- verify_jwt=false på funktionen (bryggan har ingen Supabase-JWT) — auth sker i funktionskoden, samma mönster som övriga öppna proxies.
- **Auth 2 — ägarens session (Vågen-kortet, 2026-09-14):** saknas `x-halsa-secret` läser funktionen `Authorization: Bearer <session-JWT>`, verifierar den via `auth.getUser` och godkänner bara om e-posten är `mats@enmarks.se` (samma identitet som RLS-läsningen). Ingen hemlighet i klienten. **CORS:** funktionen svarar på preflight (`OPTIONS`) och sätter `Access-Control-Allow-Origin` endast för `https://privat-dashboard-inky.vercel.app` och `http://localhost:8117`. Auth-ändring = System change (Change Management) — godkänd av Mats och deployad 2026-09-14 (inklistrad i Supabase-dashboardens kodvy; auto-mode spärrar AI-deploy till produktion). Verifierat efter deploy: preflight 204 med rätt origin, okänd origin får ingen allow-origin, utan auth / falsk JWT / anon-nyckel / fel hemlighet → 401, GET → 405, bryggans hemlighet → 200, bryggan fortsatt `ok` var 15:e min.

## Frontend

`fetchHalsa()` läser fyra vyer — aldrig råtabeller — i befintlig `fetchAll`-poll (5 min) och triggas vid inloggning (`onSession`). Hypnogrammet hämtas bara för senaste natten (`limit 1`); trendernas fasstaplar klarar sig på `halsa_daily_v`, så payloaden hålls liten. Cache: `halsaDaily`/`halsaStatus`/`halsaNatt`/`halsaPuls` i `lcc_cache` (additiva nycklar — gammal cache krockar inte).

### Vågen-kortet (Eufy-import + manuell vikt)
Ligger sist i Hälsa-fliken, utanför data-/empty-/fel-tillstånden, så det nås även när ingen synk skett. Parsern bor i `halsa-import.js` — ren funktionsmodul utan DOM, körbar i Node (`parseEufy(text)`, `manuell(datum, vikt, fett)`). Inputfälten är statisk DOM med id:n (`h-eufy-fil`, `h-m-datum`, `h-m-vikt`, `h-m-fett`); runtimens `sc-if` togglar bara `display`, så värdena överlever omrenderingar. `halsaSkicka(payload)` postar med sessionens access token och anropar sedan `fetchHalsa()` så kroppskortet uppdateras direkt. Idempotent upsert → samma fil kan importeras hur många gånger som helst (verifierat: 332 rader före och efter omsändning).

**EufyLife-exportens format (verifierat 2026-09-14, appens "Export data"):** en CSV per mätslag (`weight_…csv`, `circumference_…csv`), UTF-8 med BOM, kommaseparerad, nyaste först. Kolumner i viktfilen: `Time` (lokal tid `YYYY-MM-DD HH:MM:SS`, ingen zon), `Family Members` (hela familjen i samma fil, namnet har ibland avslutande blanksteg), `WEIGHT (kg)`, `BMI`, `BODY FAT %`, `HEART RATE (bpm)`, `MUSCLE MASS (kg)`, `MUSCLE MASS %`, `BMR`, `WATER`, `BODY FAT MASS (kg)`, `LEAN BODY MASS (kg)`, `BONE MASS (kg)`, `BONE MASS %`, `VISCERAL FAT`, `PROTEIN %`, `SKELETAL MUSCLE MASS (kg)`, `SUBCUTANEOUS FAT %`, `BODY AGE`, `BODY TYPE`, `HEAD SIZE (cm)`. `0.000000` betyder "saknas". Samma vägning förekommer 2–3 gånger. Parsern: filtrerar på `Mats Enmark`, dedupar per tidsstämpel, tolkar tiden i webbläsarens zon, mappar vikt → `weight_kg`, `BODY FAT %` → `body_fat_pct`, `LEAN BODY MASS` → `lean_body_mass_kg`; BMI, muskelmassa, vatten, BMR, benmassa, visceralt fett, protein och skelettmuskel följer med i viktpostens `raw` (inga kanoniska metrics — läggs till om de ska visas). Vågens pulsvärde ignoreras (punktmätning stående på vågen, skulle förorena pulsgrafen).

### Grafer i DCLogic-runtimen
Runtimens `sc-for` bygger noder via `template.innerHTML`, vilket parsar barnen i **HTML**-namnrymden — `<rect>`/`<path>` blir då HTMLUnknownElement och renderas aldrig. Därför får diagrammen **aldrig** byggas med `sc-for` inuti `<svg>`. I stället är varje SVG-element författat direkt i markupen och får sin geometri via en `d`-attributbindning till en path-sträng som `renderVals` räknar fram. Fem diagram, tretton paths, noll DOM-churn per omrendering.

Alla diagram använder `preserveAspectRatio="none"` med fast CSS-höjd, så x- och y-skalan sätts oberoende. Linjer bär `vector-effect="non-scaling-stroke"` så att streckbredden inte deformeras av den icke-uniforma skalningen; ytor är fyllda utan stroke. Pulskurvan bryts vid luckor över 45 minuter i stället för att dra en påhittad linje över dem.

**Känd kosmetisk bieffekt:** vid sidladdning loggar webbläsaren ett `<path> attribute d`-fel per bunden path, eftersom den literala `{{ … }}`-texten står i attributet tills första renderingen ersätter den. Rent kosmetiskt och engångs — alternativen (CSS `d: path()`) riskerar tomma diagram i webbläsare utan stöd, vilket är ett sämre felläge.

### Responsivitet
Hälsa-fliken använder CSS-klasser med media queries (`.h-g21`, `.h-g11`, `.h-hypno`, `.h-rad`, `.h-axel` i `<style>`) i stället för appens JS-breakpoint `state.cols`. Skälet: `cols` sätts från `window.innerWidth`, som i vissa inbäddade vyer rapporterar en annan bredd än den faktiska layoutbredden — då blev pulsgrafen 158 px bred mitt i en enkolumnslayout. CSS läser rätt bredd alltid.

**States:** `loading` (första hämtning) · `empty` ("Ingen hälsodata ännu" — ärligt, ingen demo) · `data` · `data + fel` (cachade värden visas med "kunde inte uppdatera") · `errorOnly` (t.ex. "Ej inloggad") · **stale-badge** "⚠ Äldre än 24 h" när `last_sync_at` passerat tröskeln.
**Stale-tröskel (Ä3):** `STALE_TIMMAR = 24` — konstant i `renderVals` i `index.html`. Vald med marginal för dygnssynk; justeras när bryggans verkliga frekvens är känd (Fas 1).

## Kända begränsningar (Fas 0)

1. Payloadens fältnamn verifierade mot verklig data 2026-08-12 för steps/heart_rate/exercise/total_calories (221 poster, 0 skipped). Sömn, vikt, HRV m.fl. återstår att se i verklig payload. Bonus: posterna bär `metadata.data_origin` (käll-app!) — sparas i `raw`; kan bli eget `origin_app`-fält om behov uppstår (ändrar inte `source`-semantiken, Ä5).
2. Raderingar i Health Connect propageras inte (bryggan skickar inga deletes) — manuell SQL-städning vid behov.
2b. **Vikt via Health Connect fungerar inte** (EufyLife skriver ingen vikt dit) — löst 2026-09-14 med Vågen-kortet i stället: 112 vägningar 2025-04-02 → 2026-08-17 importerade ur EufyLife-exporten (`source=manual`, `raw.origin=eufy_export`). Nya vägningar kräver ny export eller manuell inmatning; ingen live-koppling. Kroppskortets "Eufy-vågen når inte hit"-text visas bara när ingen vikt finns alls.
2d. **Manuell import räknas som synk:** `halsa_status_v.last_sync_at` tar max över alla `ok`-rader i `halsa_ingest_log` oavsett `source`, så en import släcker stale-badgen tillfälligt. Vyn är oförändrad (schemaändring utanför scope); åtgärda med `where source='hc_webhook'` om det stör.
2e. **Avvikare i exporten:** 2025-04-16 17:18 har 30,45 kg på Mats profil (troligen ett barn vägt på fel profil). Ligger kvar i tabellen — radering är Mats beslut.
2c. **Kalorier och distans gäller bara träningspass**, inte hela dygnet — Samsung skickar `TotalCaloriesBurned`/`Distance` enbart för `ExerciseSession`. De redovisas därför som passets värden i rörelsekortet och används aldrig som dygnstotaler.
3. Bryggans lookback är 48 h — luckor däröver kräver recovery (se `HEALTH-RECOVERY.md`).
4. Empty-staten med aktiv session är verifierad i kod men inte i browser (kräver inloggad session — verifieras av Mats vid deploy).
5. `quality` i sömn är null tills en källa faktiskt levererar score.

## Nästa fas

**Fas 1 — Samsung Health:** installera HC Webhook-appen, konfigurera URL + header (nyckel hämtas ur Vault), verifiera payloadmappningen mot riktig data, historikimport från Samsung-export (profilering först), visualiseringar/trender i fliken.
