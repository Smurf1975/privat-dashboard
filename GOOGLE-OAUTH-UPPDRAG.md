# Uppdrag: server-side Google OAuth för Privat Dashboard

*Klistra in allt nedanför linjen i en ny Claude Code-tråd.*

---

## Bakgrund

Dashboarden tappar Google-inloggningen ungefär varje timme. Jag måste klicka
"🔑 Google" på nytt varje gång jag öppnat appen efter en paus. Spotify sitter
kvar, Google gör det inte. Det ska byggas bort.

**Orsaken är utredd och verifierad — utred den inte igen:**

Dashboarden använder Google Identity Services (GIS) `initTokenClient`, alltså
implicit flow. Den ger en `access_token` som lever 1 timme och **ingen
refresh-token**. Ett försök att förnya tyst i bakgrunden med `prompt:''` har
redan gjorts och testats: GIS öppnar **alltid** ett popup-fönster, även när
samtycket finns, och webbläsaren blockerar det utan användarklick. Konsolen gav
`[GSI_LOGGER]: Failed to open popup window ... Maybe blocked by the browser?`
och noll förnyade tokens. Den koden är borttagen igen.

Enda riktiga lösningen är **server-side OAuth med auth-code-flow**, där
refresh-token hålls på serversidan. Det är den som ska byggas nu.

## Nuläge

**App:** Privat Dashboard ("Enmark Command Center")
**Live:** https://privat-dashboard-inky.vercel.app
**Lokal mapp:** `C:\Users\mats\Documents\Claude Co-Work OS\Apps & Dashboards\Privat Dashboard`
**Deploy:** `npx vercel deploy --prod --yes` från projektmappen
**Filer:** `index.html` (hela appen, Claude Design `DCLogic`-klass) + `support.js`
**Supabase:** projekt `ncgxerxkgoxptcwvramn` ("Mats Project"), region eu-west-1

**Google-uppsättning:**
- Google Cloud-projekt: **Smurf1975project**
- Client ID: `528057161454-nqoqqa2juec30ca0kdov8rcoded2fg7p.apps.googleusercontent.com`
- Scopes: `calendar.readonly`, `gmail.readonly`, `youtube.readonly`
- Token cachas i `localStorage` som `lcc_gtoken` / `lcc_gexp`

**Var Google-token används (11 ställen i index.html):**
| Funktion | API |
|---|---|
| `fetchCalendar()` | `calendar/v3/calendars/primary/events` |
| `fetchGmail()` | `gmail/v1/users/me/messages` (lista + metadata per mail) |
| `fetchYouTube()` | `youtube/v3/subscriptions`, `playlists`, `playlistItems` |

Alla tre sätter `googleAuthed:false` och rensar `lcc_gtoken` vid HTTP 401.

## Förebild som redan finns i koden

Spotify löser samma problem korrekt i `index.html` — läs `initSpotify()`,
`exchangeSpotifyCode()` och `refreshSpotifyToken()`. Mönstret är:
kod-utbyte → spara refresh-token → förnya tyst vid start och vid 401.
Google ska få samma beteende, men med hemligheten på servern i stället för i
webbläsaren.

## Vad jag har förberett (verifiera att det stämmer innan du bygger)

1. Client secret skapad för OAuth-klienten i Google Cloud-projektet Smurf1975project
2. `https://privat-dashboard-inky.vercel.app` tillagd som **Authorized redirect URI**
3. Secreten inlagd i Supabase som `GOOGLE_CLIENT_SECRET`

**Du ska aldrig se eller efterfråga secreten.** Läs den bara via
`Deno.env.get('GOOGLE_CLIENT_SECRET')` inne i edge-funktionen. Den får aldrig
hamna i klientkod, i git eller i ett svar till mig.

## Uppgiften

Bygg en edge function `google-proxy` som håller refresh-token server-side, och
koppla om dashboarden till den.

**Krav:**

1. **Auth-code-flow.** Klienten skickar användaren till Googles
   samtyckessida med `access_type=offline` och `prompt=consent` — annars får du
   ingen refresh-token. Koden växlas mot tokens i edge-funktionen, aldrig i
   webbläsaren.

2. **Refresh-token lagras server-side.** Access-token får gärna returneras till
   klienten (den är kortlivad), men refresh-token lämnar aldrig servern.
   Bestäm var den lagras — Supabase-tabell med RLS är rimligt — och motivera
   valet kort. Det är en enanvändarapp, så överarbeta inte.

3. **Tyst förnyelse.** När access-token gått ut ska proxyn hämta en ny med
   refresh-token utan att jag behöver klicka. Målet: jag loggar in **en gång**
   och slipper sedan Google-knappen.

4. **`verify_jwt: false` måste anges EXPLICIT vid deploy.** Verktyget
   `deploy_edge_function` defaultar till `true`, vilket låser funktionen.
   Det har redan nästan sabbat `anthropic-proxy` en gång. Dashboarden har ingen
   Supabase-inloggning och kan inte skicka någon auth-header.

5. **Rör inte Spotify, Homey, Färdplan eller väder.** Ändringen gäller enbart
   Google-flödet.

6. **Behåll fallback.** Misslyckas förnyelsen ska appen falla tillbaka på dagens
   beteende — visa Google-knappen — inte krascha eller visa tom kalender.

## Så vet vi att det fungerar

Påstå inte att det är löst utan att ha kontrollerat:

- Efter första inloggningen: ladda om sidan → kalender, mail och YouTube fylls
  utan att Google-knappen behöver tryckas
- Simulera utgången access-token (sätt `lcc_gexp` bakåt i tiden) → ny token
  hämtas tyst, inga blockerade popups i konsolen
- Inga `[GSI_LOGGER]`-fel i konsolen
- `google-proxy` svarar med `verify_jwt: false` (kontrollera efter deploy)
- Secreten finns inte i klientkoden: `grep -i "client_secret" index.html` ska ge noll träffar

## Bakgrundsläsning i mitt minne

`fettdatabas-app.md` och `privat-dashboard.md` i minnesmappen innehåller
detaljer om projektet, tidigare fällor och beslut. Läs dem innan du börjar.
