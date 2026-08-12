# Hälsomodulen — arkitektur och kontrakt (Fas 0)

**Skapad:** 2026-08-11 · **Status:** Fas 0 klar (foundation, ingen live-källa kopplad ännu)
**Bakgrund & beslut:** `Knowledge Base/Sources/Hälsa/Hälsa-Know/` (Arkitekturanalys + Second Opinion, Ä1–Ä5) · BUILD_CONTRACT: `AI Native OS/04_APPS/Command-Center/BUILD_CONTRACT.md`

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

## Datamodell

### `halsa_metrics`
En rad per mätvärde. `ts` = mätpunkt eller intervallstart (UTC). `end_ts` = intervallslut, `null` för punktvärden (Ä1).
**Dedup-nyckel:** `unique(metric, ts, dedup_end_ts, source)` där `dedup_end_ts` är en lagrad genererad kolumn `coalesce(end_ts, ts)` — vald i stället för expression-index så att PostgREST-upsert (`on_conflict` tar bara kolumnnamn) kan använda nyckeln.
**Upsert-semantik (Ä2):** `ON CONFLICT DO UPDATE` — återlevererade/korrigerade poster uppdaterar värdet; `updated_at` sätts via trigger, `created_at` bevaras.

### Kanoniska metrics och enheter (ingest-kontraktet)

| metric | enhet | typ | källfält (HC Webhook) |
|---|---|---|---|
| `steps` | count | intervall | `steps[].count` |
| `heart_rate` | bpm | punkt | `heart_rate[].bpm` |
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
`hc_webhook` · `samsung_export` · `manual`. Betyder HUR posten kom in — **aldrig** vilken app som mätte. Käll-app finns inte i bryggans payload och får inte antas i vyer eller analys. Om framtida payload innehåller app-metadata läggs det som eget fält (`origin_app`), semantiken på `source` ändras inte.

## Vyer

**`halsa_daily_v`** — dagsaggregat. Regler:
- **Dagsgräns:** svensk kalenderdag via `ts at time zone 'Europe/Stockholm'` — DST-säkert, ingen hårdkodad offset. Ansvaret för UTC→lokal dag ligger HÄR (frontend jämför bara datumsträngar).
- Intervallvärden räknas på dagen de **startar**.
- **Sömn ("natt"):** en session tillhör dagen man **vaknar** (`end_ts`:s lokala datum). En session 23:20–07:10 hamnar alltså odelad på uppvakningsdagen.
- **Ä4 sömnprioritet:** exakt EN primär session per uppvakningsdag — den **längsta**. Motiv: payloaden saknar käll-app, så "föredra app X" är omöjligt utan påhittad precision; längsta sessionen är huvudsömnen medan tupplurar och dubbelregistreringar bortfaller. Ingen summering av parallella sessioner = ingen dubbelräkning. Omprövas i Fas 3 mot verklig data.
- Vikt/kroppsfett per dag = sista värdet den dagen (tillstånd, inte flöde).

**`halsa_status_v`** — en rad: `last_sync_at` (senaste lyckade ingest), `latest_record_ts`, senaste vikt/kroppsfett/vilopuls oavsett dag (vikten kan vara dagar gammal och ska ändå visas).

Båda är vanliga vyer med `security_invoker = true` → RLS på undertabellerna gäller den som frågar. Ingen materialized view, ingen RPC — datavolymen (~10³–10⁴ rader/år) motiverar det inte.

## Säkerhet

- **RLS läs:** `(auth.jwt()->>'email') = 'mats@enmarks.se'` på alla tre tabellerna (voxmats-mönstret). Familjesessioner och anon ser 0 rader — verifierat med rolltester.
- **RLS skriv:** inga skrivpolicies → endast service role (ingest-funktionen) kan skriva. Klient-INSERT nekas — verifierat.
- **Ingest-auth:** HTTPS + delad hemlighet i headern `x-halsa-secret`, jämförd i konstant tid mot **två** Vault-nycklar: `halsa_ingest_secret_current` + `halsa_ingest_secret_previous` → rotation utan avbrott. Nycklarna genererades inne i Postgres (`gen_random_bytes`) och har aldrig lämnat databasen; de hämtas av funktionen via RPC `halsa_get_ingest_secrets()` som endast `service_role` får exekvera (verifierat: authenticated nekas).
- **Nyckelrotation** (System change — kräver Mats godkännande): 1) skapa ny nyckel som `..._current`, flytta gamla till `..._previous` (`vault.update_secret`), 2) uppdatera bryggappens header, 3) när bryggan bekräftat fungera: byt ut `..._previous`. Ingest fortsätter fungera hela vägen.
- **Rate limiting:** beslut = ingen utöver secret-auth. Hotmodell: privat oannonserad endpoint, en användare; skadan vid läcka begränsas av idempotent upsert (ingen läsväg, ingen delete). Supabase plattformsskydd ligger utanpå. Omprövas om loggen visar missbruk.
- verify_jwt=false på funktionen (bryggan har ingen Supabase-JWT) — auth sker i funktionskoden, samma mönster som övriga öppna proxies.

## Frontend

`fetchHalsa()` läser de två vyerna — aldrig råtabeller — i befintlig `fetchAll`-poll (5 min) och triggas vid inloggning (`onSession`). Cache: `halsaDaily`/`halsaStatus` i `lcc_cache` (additiva nycklar — gammal cache krockar inte; ingen versionsbump behövdes).

**States:** `loading` (första hämtning) · `empty` ("Ingen hälsodata ännu" — ärligt, ingen demo) · `data` · `data + fel` (cachade värden visas med "kunde inte uppdatera") · `errorOnly` (t.ex. "Ej inloggad") · **stale-badge** "⚠ Äldre än 24 h" när `last_sync_at` passerat tröskeln.
**Stale-tröskel (Ä3):** `STALE_TIMMAR = 24` — konstant i `renderVals` i `index.html`. Vald med marginal för dygnssynk; justeras när bryggans verkliga frekvens är känd (Fas 1).

## Kända begränsningar (Fas 0)

1. Payloadens fältnamn overifierade mot verklig HC Webhook-data (ponytail ovan) — Fas 1-uppgift.
2. Raderingar i Health Connect propageras inte (bryggan skickar inga deletes) — manuell SQL-städning vid behov.
3. Bryggans lookback är 48 h — luckor däröver kräver recovery (se `HEALTH-RECOVERY.md`).
4. Empty-staten med aktiv session är verifierad i kod men inte i browser (kräver inloggad session — verifieras av Mats vid deploy).
5. `quality` i sömn är null tills en källa faktiskt levererar score.

## Nästa fas

**Fas 1 — Samsung Health:** installera HC Webhook-appen, konfigurera URL + header (nyckel hämtas ur Vault), verifiera payloadmappningen mot riktig data, historikimport från Samsung-export (profilering först), visualiseringar/trender i fliken.
