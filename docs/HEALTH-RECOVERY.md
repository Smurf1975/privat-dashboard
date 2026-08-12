# Hälsomodulen — Recovery-runbook (Ä3)

**Gäller:** synkstopp mellan telefonen och `halsa-ingest`. Upptäcks via stale-badgen i Hälsa-fliken ("⚠ Äldre än 24 h") eller tom `halsa_ingest_log`.

## Diagnos (i ordning)

1. **Har ingest tagit emot något?**
   `select * from halsa_ingest_log order by started_at desc limit 5;`
   - Rader med `status='ok'` nyligen → ingest OK; problemet är datat/vyn, inte synken.
   - `status='error'` → läs `error_summary`.
   - Inga rader alls → bryggan når inte fram (fortsätt nedan).
2. **Telefonen:** är HC Webhook-appen igång? Batterioptimering undantagen? Webhook-URL + `x-halsa-secret`-headern kvar? Appens "Webhook Log" visar statuskod per försök (401 = fel nyckel, timeout = nät).
3. **Endpoint:** `POST` utan nyckel ska ge 401, `GET` 405 — svarar den alls? Kolla Edge Function-loggarna i Supabase-dashboarden.
4. **Permissions:** Health Connect → Appbehörigheter → HC Webhook — Android drar ibland tillbaka behörigheter efter uppdateringar; ge dem igen.

## Scenario A — lucka KORTARE än 48 h

Ingen åtgärd krävs. Bryggan läser ett rullande 48-timmarsfönster; nästa lyckade synk (schemalagd eller manuell "Sync now" i appen) tar igen datat. Idempotensen gör omleveransen ofarlig.

## Scenario B — lucka LÄNGRE än 48 h

Bryggans automatiska fönster räcker inte. Två verifierade vägar:

**B1 — manuell range-synk från appen (förstahandsval).** HC Webhook stödjer explicit range-synk som kringgår watermark (lokal server: `GET /?days=N`; i appen: manuell synk med angivet intervall). Data äldre än så kan dock ha gallrats ur Health Connect (HC sparar normalt ~30 dagar per app-läsfönster) — det som finns kvar kommer in, resten är borta för bryggvägen.

**B2 — backfill via Samsung Health-export.** För större/äldre luckor: Samsung Health → Inställningar → "Ladda ner personliga data" → zip. Importeras med historikimportverktyget (byggs i Fas 1) med `source='samsung_export'`. Idempotensnyckeln gör att överlapp med redan synkad `hc_webhook`-data inte dubblerar i lagringen; `halsa_daily_v` visar korrekt eftersom aggregaten grupperar per metric/dag oavsett source. **OBS:** stegdata i exporten har historiskt bara ~35 dagar — förvänta inte fullständig backfill där.

Gissa aldrig en tredje väg: finns datat varken i Health Connect eller i exporten är det borta — acceptera luckan hellre än att fabricera.

## Verifiering efter recovery

```sql
select day, steps, sleep_hours, weight from halsa_daily_v order by day desc limit 10;
select * from halsa_ingest_log order by started_at desc limit 3;
```
Stale-badgen släcks automatiskt när `last_sync_at` är < 24 h gammal.

## Nyckelrotation (vid misstänkt läckt nyckel)

System change — kräver Mats godkännande. Steg i `HEALTH-ARCHITECTURE.md` §Säkerhet. Under rotationen fortsätter gamla nyckeln fungera (previous-slotten) tills bytet bekräftats.
