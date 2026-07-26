# Förbättringsförslag – Privat Dashboard (Life Command Center)

> Lista från kodgenomgång 2026-07-12. **Inget av detta är gjort** – bara förslag att ta ställning till.
> (Ligger okommittad lokalt så den inte publiceras på GitHub Pages av misstag.)

## Säkerhet (rekommenderas, men kräver beslut/avvägning)

1. **Tokens i localStorage** – Google- och Spotify-tokens (inkl. Spotify refresh token) ligger i
   `localStorage`. Fungerar, men en enda XSS-lucka skulle exponera dem. Alternativ: håll tokens
   endast i minnet (kostar omlogin per flik/omladdning) eller flytta OAuth-flödena bakom en egen
   Supabase-funktion. För en privat dashboard är nuvarande läge acceptabelt – men värt att känna till.
2. **Rate-limit på homey-proxy / anthropic-proxy** – anon-nyckeln är publik by design, så vem som
   helst som hittar URL:en kan trigga Homey-flöden (städning, scener, lampor) och generera
   Haiku-anrop på din bekostnad. Förslag: enkel rate-limit eller en delad hemlig header i
   edge-funktionerna, alternativt en enkel PIN i dashboarden.
3. **CSS-injection via externa bild-URL:er** – YouTube/Spotify-thumbnails interpoleras in i
   `style="...url('{{ v.img }}')"`. Källorna är betrodda API:er så risken är låg, men en
   hjälpfunktion som validerar att URL:en börjar med `https://` vore ett billigt bälte-och-hängslen.
4. **`Content-Security-Policy` via meta-tagg** – en CSP som bara tillåter kända domäner
   (Supabase, Google, Spotify, Open-Meteo, OSM, jsdelivr m.fl.) skulle kraftigt begränsa vad en
   eventuell injektion kan göra.

## Optimering / robusthet

5. **sc-for river och bygger om DOM varje render** – runtime:n (`support.js`) återskapar alla
   loop-noder vid varje render istället för att återanvända. Med minutvis rendering (fixat nu) är
   det okej, men en key-baserad diff skulle göra UI:t helt flimmerfritt vid datauppdateringar.
6. **`componentWillUnmount` städar inte allt** – `_morning`-timeouten och `storage`-lyssnaren
   tas aldrig bort. Spelar ingen roll i praktiken (sidan laddas om), men lätt att fixa.
7. **localStorage-cachen saknar versionsnummer** – om state-formatet ändras kan gammal cache ge
   konstiga värden tills nästa fetch. Ett `lcc_cache_v2`-namn eller versionsfält löser det.
8. **Elpris: visa kvartspriser** – nu aggregeras 96 kvartsvärden till timmedel. Alternativ:
   visa alla 96 staplar och markera aktuell kvart – ger mer exakt "just nu"-pris.

## Funktionsidéer

9. **Uppgifter & Nyheter är fortfarande demo** – Uppgifter kan kopplas till Google Tasks
   (API:et ingår i samma Google-inloggning, bara ett scope till). Nyheter kan hämtas via RSS
   (Omni/SVT/TechCrunch) genom en liten edge-funktion.
10. **Hälsa-fliken är demo** – väntar på Eufy-våg/Samsung Health-integration (sedan tidigare beslut).
11. **Elpris imorgon** – API:et publicerar morgondagens priser ca kl 13. En andra graf eller
    "imorgon billigast kl X" i AI-briefingen.
12. **Felbanner vid trasig integration** – idag syns fel bara som badge (✕ FEL). En liten rad med
    senaste felmeddelande skulle göra felsökning snabbare.
13. **PWA/manifest** – lägg till `manifest.json` + ikon så dashboarden kan installeras som app
    på mobil/surfplatta och köras i helskärm.

## Design-hookens anmärkningar (medvetna val – inget gjort)

- `overused-font` (Plus Jakarta Sans) och `single-font` – befintligt medvetet designval.
- `layout-transition` (width-transition på batteribarerna) – engångstransition vid datauppdatering,
  inte kontinuerlig animation; ofarlig i praktiken.
