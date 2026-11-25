# Automation

| | |
|---|---|
| Mekanism | Claude Code (cloud) schemalagd uppgift ("scheduled task") som väcker den ursprungliga Claude Code-sessionen *Daily laptop deal radar* |
| Schema | Varje dag 07:43 Europe/Stockholm (`CRON_TZ=Europe/Stockholm 43 7 * * *`) – start före 08:00 så rapporten är klar runt 08 |
| Prompt | `automation/daily-prompt.md` (samma text lagrad i uppgiften) |
| Antal scheman | Exakt ett. Agenter får aldrig skapa egna. |
| Lagring | Git-grenen `ccr-26489512-5t7dlt` i Smurf1975/privat-dashboard. Containern är tillfällig; varje körning hämtar grenen först och pushar sist. |
| Avisering | Körningens slutmeddelande syns i sessionen i Claude-appen + `PushNotification` vid fynd/fel. |

## Varför denna mekanism
- Windows Task Scheduler/cron finns inte (molncontainer, ingen ansluten dator).
- `CronCreate` är bara sessionslokal (försvinner när sessionen tar slut, max 30 dagar) → ej använd.
- En uppgift som startar ny session per körning skulle hamna på en ny git-gren varje dag → historiken splittras. Därför väcks samma session.

## Hantera
- Lista/ändra/pausa: be Claude i sessionen ("pausa Laptop Radar"), eller claude.ai/code → Scheduled tasks.
- Arkiveras sessionen slutar uppgiften fungera → skapa en ny från `automation/daily-prompt.md`.
- Trigger-ID sparas i `automation/trigger.json`.
