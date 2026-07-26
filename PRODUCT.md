# Product

## Register

product

## Users

Mats (och i förlängningen familjen) — privat bruk i hemmet, på desktop och mobil. Två ytor i samma repo:

- **Command Center** (`index.html`, källa `Command Center.dc.html`): personlig "Life Command Center"-dashboard med flikar för Hem, Smart Home, Bilar, Media, Sport, Resor, Väder, Hälsa och Familj. Används dagligen som överblick: väder, elpris, kalender/mail, Volvo-status, Homey smart home, Liverpool, Spotify/YouTube.
- **Fettdatabas** (`fettdatabas/`): internt FUCHS-arbetsverktyg för smörjfettsdata — produktkatalog, kappaberäkning (ISO 281), fyllnadsmängd och AI-produktrekommendation. Används av Mats i säljarbetet.

Jobbet som ska göras: snabb, pålitlig överblick och beslutsstöd — inte utforskning. Användaren vet vad hen letar efter.

## Product Purpose

Samla allt Mats behöver se dagligen på ett ställe, med riktiga live-integrationer (Homey via säker proxy, Open-Meteo, elprisetjustnu.se, Google Calendar/Gmail, Spotify, TheSportsDB/ESPN, Supabase realtime, HaV Badplatsen, AI-briefing via Haiku). Framgång = dashboarden är snabbare och trevligare än att öppna åtta appar.

## Brand Personality

Premium & polerad. Mer Tesla-app än kontrollrum: luft, mjuka övergångar, påkostad känsla — men alltid i funktionens tjänst. Mörkt tema, data först, effekter bara där de förhöjer (t.ex. frilagd Volvo-hero med spotlight).

## Anti-references

- **Generisk SaaS-dashboard**: identiska kort-grids, hero-siffror med gradient-accenter, mallkänsla. Detta är en personlig, bespoke yta — varje flik får ha sin egen karaktär.
- Undvik även widget-röra utan hierarki; varje vy har en tydlig primär uppgift.

## Design Principles

1. **Data först, dekor sen** — varje yta ska svara på en fråga snabbare än appen den ersätter.
2. **Premium utan pynt** — luft, typografi och mjuk motion ger lyxkänslan; inga gradient-texter, glas-kort eller sidstreck.
3. **Live eller inget** — hellre färre riktiga integrationer än fler demo-paneler; demo-innehåll märks tydligt tills det blir äkta.
4. **Bespoke per flik** — Bilar får vara en hero-sida, Väder en tät datavy; ingen universalmall.
5. **Snabbt på riktigt** — localStorage-cache, inga onödiga omrenderingar (1s-klockan får inte trigga bild-/iframe-reloads).

## Accessibility & Inclusion

Grundnivå: god kontrast (≥4.5:1 för brödtext), läsbar typografi, fungerande responsivitet på mobil. Inget formellt WCAG-krav (privat bruk), men reduced motion respekteras där animationer läggs till.
