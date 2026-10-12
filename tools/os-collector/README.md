# OS-insamlaren

Samlar en ögonblicksbild av AI Native OS (appar, skills, MCP:er, plugins) och skickar den till Edge Function `os-ingest` → tabellen `os_items` (endast Mats kan läsa). Design: `docs/superpowers/specs/2026-10-12-os-flik-design.md`.

- `node collect.mjs --dry` — skriv JSON till stdout, skicka inget.
- `node collect.mjs` — skicka. Hemligheten läses från `~/.os-ingest/secret` (utanför repot).
- `node --test "test/*.test.mjs"` — tester (syntetiska fixtures, inga riktiga värden).

**Vitlista:** varje källa i `sources.mjs` plockar ut fält för fält. MCP-konfigurationens `env`, `headers`, `args` och sökvägar skickas aldrig, bara namn, transport och värdnamn. Ingen filinnehåll eller källkod lämnar datorn.

**Semantik:** en körning ersätter alla poster av de typer den skickar. Det som inte längre finns raderas ur `os_items`.

**Rotation av hemligheten:** skapa ny `os_ingest_secret_current` i Vault, flytta den gamla till `..._previous`, skriv den nya till `~/.os-ingest/secret`.
