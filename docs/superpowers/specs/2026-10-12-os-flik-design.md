# OS-fliken — design

**Datum:** 2026-10-12 · **Status:** utkast, godkänt att börja bygga ("utan att låsa in oss")

## Syfte

Visualisera AI Native OS i dashboarden: vilka appar som finns och hur de är byggda, vilka verktyg (skills, MCP, plugins) som finns, och hur granskningskörningar faktiskt gick — vem gjorde vad, vad väntade på vad, och varför en app har sin status.

## Beslut

| Fråga | Beslut |
|---|---|
| Hur levande | Uppspelning av riktiga, avslutade körningar (quality-runs). Ingen påhittad live-animation. |
| Synlighet | Gömt bakom Mats Supabase-inloggning. Repot är publikt → ingen systemdata i repot. |
| Navigering | En ny flik **OS** med underflikarna Översikt · Appar · Verktyg · Körningar. |
| Översikt svarar på | "Vad behöver mig just nu?" — varje rad med sitt skäl. |
| Appdjup | Registret + automatisk skanning av varje repo; avvikelser register↔kod flaggas. |
| Transport | Lokalt insamlingsskript → Edge Function `os-ingest` (hemlig nyckel i Vault) → `os_items`. |
| Insamlingsfrekvens | Dold schemalagd uppgift varje timme (`conhost --headless`). |

## Datamodell (Supabase "Mats Project")

- `os_items(kind, id, data jsonb, collected_at)`, `unique(kind, id)`. `kind` ∈ `app | skill | mcp | plugin | run`.
- `os_collect_log` — en rad per insamling: tid, antal per typ, fel. Driver "insamlingen har stannat".
- RLS: läs endast `mats@enmarks.se`; inga skrivpolicies (endast `os-ingest` via service role).
- Ögonblickssemantik: en insamling ersätter alla rader av de typer den skickar (upsert + radera saknade, endast i `os_items`).

## Insamlaren (lokalt, Node utan beroenden)

| Typ | Källa |
|---|---|
| app | `AI Native OS/10_REGISTRY/Projects Registry.md` + repo-skanning (manifest-filer, git, CI via `gh`, live-URL-ping, databasanrop i koden) |
| skill | `~/.claude/skills`, plugin-skills, projekt-skills (namn + första meningen ur beskrivningen) |
| mcp | Claude-konfigurationen + `07_MCP/MCP Inventory.md` |
| plugin | `~/.claude/plugins/installed_plugins.json` |
| run | `Apps & Dashboards/*/quality-runs/*/` (`run.json`, `verdict.json`, `gates.json`, `findings-*.json`) |

**Vitlista, inte svartlista.** Aldrig: MCP-`env`/headers/args, evidensfilers innehåll, källkod, nycklar. Bara namn, typer, värdnamn, statusar, rubriker, filnamn.

## Vyerna

1. **Översikt** — "Väntar på dig"-lista (regler i klienten: NOT READY med blockerare, fynd som väntar på beslut, registerstatus "väntar på Mats", live-URL nere, CI rött, insamling > 2 h gammal), sedan en rad per app med färgprick, sist insamlingstid. Tom lista = "Inget väntar på dig".
2. **Appar** — lista → detaljvy (syfte, stack, databas, hosting, senaste ändring, upp/nere, verktyg, senaste granskning, avvikelser). Överst en enkel karta: appar ↔ databaser de delar.
3. **Verktyg** — skills (egna skilda från plugin-skills), MCP, plugins; en mening per post, vilka appar som använder den, sökruta.
4. **Körningar** — senaste körningen: agenter i verklig ordning med status (klar/jobbar/väntar/stoppad), kanter med vad som lämnades vidare, tidslinje, grindrad där den röda grinden markerar var det stannade, klick på agent → fynd, klick på fynd → evidensfilnamn. Uppspelningsknapp. Äldre körningar i lista.

## Visuell riktning

Dashboardens befintliga mörka palett och typografi. Inga emoji-avatarer, ingen neonglöd, inga glaskort eller gradienttexter. Agenter = monogram/linjeikon + statusord, inte färg ensam. Rörelse bara där något faktiskt händer (uppspelning, värdebyte); `prefers-reduced-motion` respekteras. Skelett vid laddning, aldrig demodata.

## Byggordning

1. Insamlaren för `app`/`skill`/`mcp`/`plugin` + `os_items`/`os_collect_log` + `os-ingest` (kräver Mats godkännande: Architecture change + System change för autentisering/Vault).
2. OS-fliken: Översikt, Appar, Verktyg.
3. `run`-insamling + Körningar.
4. Schemalagd uppgift (redovisas innan den skapas).

## Fällor att respektera

- `deploy_edge_function`: ange alltid `verify_jwt:false`; kontrollera nyckeln i koden.
- Modulvariabler i edge-funktioner delas inte — ingen minnescache.
- SVG i runtimen: aldrig `sc-for` inuti `<svg>`; bind geometri via attribut. `fill="var(--x)"` fungerar inte som attribut.
- Sökrutan i Verktyg: statisk DOM med id (som Vågen-kortet), annars tappas inmatning vid omrendering.
- Verifiera deploy med cache-bust-URL.
