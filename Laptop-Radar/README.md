# Laptop Radar

Daglig, automatisk bevakning av laptops (nytt, outlet, refurb, begagnat, ASUS EU) mot sökprofilen i `search-profile.md`.
Riktig webbläsarverifiering (Playwright/Chromium) av butikens produktsida – inte söksnuttar.

**Sökväg:** `/home/user/privat-dashboard/Laptop-Radar` i repo `Smurf1975/privat-dashboard`, gren `ccr-26489512-5t7dlt` (permanent lagring = git).
**Schema:** dagligen 07:43 Europe/Stockholm, se `automation/README.md`.

| Fil | Innehåll |
|---|---|
| instructions.md | Runbook för varje daglig körning |
| search-profile.md | Krav, kvalificering, rankingvikter |
| sources.md | Källregister + åtkomststatus |
| verification-rules.md | Statusnivåer + datamodell (offers.json) |
| current-ranking.md | Aktuell topplista |
| watchlist.md | Bevakade modeller (målpris, bästa pris) |
| history.md | Logg över fynd per dag |
| daily-report.md | Senaste dagsrapport (bara förändringar) |
| run-log.md | Körstatus per körning |
| price-history/ | observations.csv (alla observationer), candidates.json (en post per laptop), offers-latest.json |
| research/<datum>/ | Rådata (raw-*.json), agentfynd, offers.json, changes.md |
| scripts/ | verify.js (webbläsare), merge.py, record.py (historik/diff), recheck.py |
| automation/ | Schemaläggning, prompt, trigger-ID |

Manuell körning: be Claude i sessionen "kör Laptop Radar nu".
