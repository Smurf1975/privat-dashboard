# Fettdatabas — FUCHS smörjfett-jämförelse

Intern webbapp för FUCHS-tekniker: jämför smörjfetter och hitta FUCHS-motsvarighet till konkurrentprodukter med AI. Bygger på Supabase-projektet **Mats Project** (`ncgxerxkgoxptcwvramn`).

## Innehåll
```
app/
  index.html      # skal
  styles.css      # design (FUCHS-blå + röd accent)
  app.js          # hela SPA:n (auth, sök, katalog, jämförelse, granskning, admin)
  config.js       # Supabase-URL + publishable key (säkert att exponera, RLS skyddar)
```
Backend (redan deployat i Supabase):
- **fett-sok** — AI-matchning konkurrent → FUCHS (hård filtrering + Claude-rankning)
- **fett-email-inbound** — Postmark-webhook → AI-tolkning → granskningskö
- **fett-import** — godkänn mail i kön → skapar produkt i `fett`

## Så funkar sökningen
1. Tekniker skriver konkurrentprodukt (namn får vara ofullständigt/felstavat) + väljer ev. filter.
2. `fett-sok` letar först upp produkten i databasen (fuzzy). Hittas den inte låter AI:n gissa dess egenskaper utifrån namnet.
3. FUCHS-kandidater filtreras hårt (NLGI, NSF, PTFE-fri m.m.), förrankas heuristiskt, och Claude rankar topp 5 med likhet% + motivering.
4. "Jämför" öppnar en sida-vid-sida-vy med Δ-skillnader.

> Obs: `embedding`-kolumnen (pgvector) finns kvar för framtida semantisk sök men **används inte** i nuläget — AI-rankningen räcker och kräver ingen extra nyckel.

---

## Kvar att göra innan lansering (Mats)

### 1. Aktivera inloggning
Supabase → **Authentication → Providers → Email**: se till att "Email" är på (magic link/OTP är på som standard).
Supabase → **Authentication → URL Configuration → Redirect URLs**: lägg till adressen där appen ligger (t.ex. `https://fett.enmarks.se` eller GitHub Pages-URL). Måste matcha `REDIRECT_URL` i `config.js`.

### 2. Lägg till kollegorna
Logga in själv först (du är redan admin i `app_anvandare`). Gå till **Användare → Lägg till** och lägg in de 5–7 teknikernas FUCHS-mailadresser med roll:
- **lasare** — sök & jämför
- **redaktor** — får även godkänna mail i granskningskön
- **admin** — får hantera användare

### 3. Mail-inflöde via Postmark (valfritt, för granskningskön)
1. Sätt ett hemligt värde i Supabase → **Edge Functions → Secrets**: `FETT_INBOUND_SECRET` = valfri lång slumpsträng.
2. I Postmark: skapa en **Inbound**-stream och peka webhooken till:
   `https://ncgxerxkgoxptcwvramn.supabase.co/functions/v1/fett-email-inbound?secret=DITT_HEMLIGA_VÄRDE`
3. Vidarebefordra ett produktdatablad till din Postmark inbound-adress → det dyker upp i **Granskningskö** för godkännande.

### 4. Hosta appen
Statiska filer — lägg `app/`-mappen på valfri statisk host (Netlify, Vercel, Cloudflare Pages, GitHub Pages eller samma ställe som Privat Dashboard). Ingen byggprocess behövs.

---

## Kostnad
- Supabase: ryms i gratisnivån.
- AI: Claude Haiku per sökning (~ören), Sonnet per mail-tolkning. Postmark inbound 100/mån gratis.

## Redan konfigurerat i Supabase (kräver inget av dig)
`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` injiceras automatiskt i edge-funktionerna.
