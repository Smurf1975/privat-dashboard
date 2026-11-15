import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Namnrymdsimport: dagens bundler ger ingen default-export för web-push (boot error 2026-11-15).
import * as webpushMod from 'npm:web-push@3.6.7';
// deno-lint-ignore no-explicit-any
const webpush: any = (webpushMod as any).default ?? webpushMod;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const INBOUND_EMAIL_SECRET = Deno.env.get('INBOUND_EMAIL_SECRET') ?? '';
// Reservnyckel: tillåter även fettdatabasens inbound-secret, så webhooken kan återställas
// utan att behöva ändra INBOUND_EMAIL_SECRET (vars värde inte går att läsa ur Supabase).
const FETT_INBOUND_SECRET = Deno.env.get('FETT_INBOUND_SECRET') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Åtkomst (säkerhetsrevision 2026-11-15) ────────────────────────────────
// Hemligheten tas helst ur HTTP Basic auth (Postmark: https://postmark:<secret>@…/email-inbound),
// så att den inte hamnar i URL:en och därmed i loggar. ?secret= godtas tills Postmark-webhooken
// är omlagd. Jämförelsen sker i konstant tid.
function constantTimeEq(a: string, b: string): boolean {
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function providedSecret(req: Request, url: URL): string {
  const auth = req.headers.get('authorization') ?? '';
  const m = auth.match(/^Basic\s+(.+)$/i);
  if (m) {
    try {
      const decoded = atob(m[1].trim());
      const i = decoded.indexOf(':');
      return i >= 0 ? decoded.slice(i + 1) : decoded;
    } catch { /* faller tillbaka på query */ }
  }
  return url.searchParams.get('secret') ?? '';
}

const FAMILY = [
  { name: 'Mats', emails: ['mats@enmarks.se', 'mats.enmark@gmail.com'] },
  { name: 'Nanny', emails: ['nanny@enmarks.se'] },
  { name: 'Simon', emails: ['simon@enmarks.se'] },
  { name: 'Vanessa', emails: ['vanessa@enmarks.se'] },
];

const DAY_MS = 86400000;

// Reserv när Claude-krediterna är slut: Gemini tolkar samma prompt (samma lösning som anthropic-proxy).
const GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite'];
async function geminiText(system: string, user: string): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;
  for (const model of GEMINI_MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096 },
        }),
      });
      if (!r.ok) { console.error('[gemini]', model, r.status, await r.text()); continue; }
      const d = await r.json();
      const text = (d?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
      if (text) return text;
    } catch (e) { console.error('[gemini]', model, String(e)); }
  }
  return null;
}

// Notisknappen "Lägg i kalendern" pekar på funktionen calendar-add. HMAC per boknings-id
// (samma formel där) gör att länken bara kan lägga just den bokningen i kalendern.
const enc = new TextEncoder();
async function signCalendarToken(id: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(SUPABASE_SERVICE_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('calendar-add:' + id));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Lägg bokningen i en resa som redan finns när datumen överlappar. Modellen ser
// bara mailet och hittar annars på ett nytt resenamn för en resa Mats redan lagt
// upp — så blev "Växjö Camp" och "Växjö augusti 2026" två separata resor.
// Ett dygns marginal: hotell checkar in samma dag resan börjar, hemresan ligger
// gärna dagen efter sista bokningen. Samma regel som appens inklistringsflöde.
async function matchExistingTrip(startISO: string): Promise<string | null> {
  const t = new Date(startISO).getTime();
  if (Number.isNaN(t)) return null;

  const { data, error } = await supabase
    .from('bookings')
    .select('trip_label, start_date_time, booking_data');
  if (error || !data?.length) return null;

  // Varje resas spann = tidigaste start till senaste slut bland dess bokningar.
  const spans = new Map<string, { start: number; end: number }>();
  for (const row of data) {
    const label = row.trip_label;
    if (!label) continue;
    const s = new Date(row.start_date_time).getTime();
    const e = new Date(row.booking_data?.endDateTime || row.start_date_time).getTime();
    if (Number.isNaN(s)) continue;
    const cur = spans.get(label);
    spans.set(label, {
      start: Math.min(cur?.start ?? s, s),
      end: Math.max(cur?.end ?? (Number.isNaN(e) ? s : e), Number.isNaN(e) ? s : e),
    });
  }

  for (const [label, span] of spans) {
    if (t >= span.start - DAY_MS && t <= span.end + DAY_MS) return label;
  }
  return null;
}

// Samma resenamn på två bokningar veckor ifrån varandra slog ihop dem till en resa
// (Helsingborg 21 okt + 27 okt). Finns namnet redan men datumen inte matchar
// resans spann särskiljs det med dagen.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
async function uniqueTripLabel(label: string, startISO: string): Promise<string> {
  const { data } = await supabase.from('bookings').select('trip_label').eq('trip_label', label).limit(1);
  if (!data?.length) return label;
  const day = parseInt(startISO.slice(8, 10));
  const month = MONTHS[parseInt(startISO.slice(5, 7)) - 1];
  return day && month ? `${label} (${day} ${month})` : label;
}

async function pushToMats(title: string, body: string, tag: string, extra: { actions?: unknown[]; data?: unknown } = {}) {
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!vapidPublic || !vapidPrivate) { console.log('[push] VAPID keys missing'); return; }
  try { webpush.setVapidDetails('mailto:mats@enmarks.se', vapidPublic, vapidPrivate); }
  catch (e) { console.error('[push] VAPID init error:', e); return; }

  const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_name', 'Mats');
  console.log(`[push] ${subs?.length ?? 0} subscriptions for Mats`);

  for (const sub of (subs ?? [])) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, tag, ...extra })
      );
    } catch (e: any) {
      console.error('[push] Send error:', e.statusCode);
      if (e.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    }
  }
}

const PARSE_SYSTEM_PROMPT = (today: string) => `Du är expert på att extrahera reseinformation från bokningsbekräftelser. Returnera ALLTID ett giltigt JSON-objekt utan markdown eller förklarande text.

DAGENS DATUM: ${today}

RETURNERA detta JSON-schema:
{
  "category": "flight" | "hotel" | "train" | "ferry" | "car" | "other",
  "title": "informativ titel (se regler nedan)",
  "provider": "leverantörens namn/varumärke (t.ex. 'Home Hotels', 'SAS', 'Strawberry', 'Booking.com')",
  "startDateTime": "ISO 8601 med tidzon",
  "endDateTime": "ISO 8601 med tidzon eller null",
  "location": "adress eller platsnamn",
  "confirmationCode": "bokningsnummer eller null",
  "travelers": ["namn om de nämns explicit, annars tom lista"],
  "price": numeriskt värde eller null,
  "currency": "SEK" | "EUR" | "USD" | null,
  "details": "kort sammanfattning av viktig info (rum, gäster, måltider etc)",
  "tripLabelSuggestion": "destination + månad + år på svenska"
}

Om INGEN bokningsinformation finns: { "error": "Ingen bokningsinformation hittad" }

Regler:
- Hotell titel: "[Hotellnamn], [Stad]"
- Flyg titel: "[Bolag] [Flygnr] [Avgångsplats] → [Ankomst]"
- Tåg/färja titel: "[Operatoör] [Från] → [Till]"
- Hotell datum: startDateTime = check-in 15:00, endDateTime = check-out 11:00
- Hotell provider: kedjenamnet (Clarion/Comfort = Strawberry, Home Hotel = Home Hotels)
- Hotell location: hotellets adress om känd, annars staden
- Saknas årtal: använd närmast kommande datum från dagens datum
- Tidzon: +02:00 sommartid (april-oktober), +01:00 vintertid`;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const secret = providedSecret(req, url);
  const secretOk = !!secret && (
    (!!INBOUND_EMAIL_SECRET && constantTimeEq(secret, INBOUND_EMAIL_SECRET)) ||
    (!!FETT_INBOUND_SECRET && constantTimeEq(secret, FETT_INBOUND_SECRET))
  );
  console.log('[email-inbound] method:', req.method, '| secret OK:', secretOk);

  if (!secretOk) {
    return new Response('Unauthorized', { status: 401 });
  }

  let rawBody = '';
  try { rawBody = await req.text(); }
  catch (e) { return new Response('Error reading body', { status: 400 }); }

  let postmarkData: any = {};
  try { postmarkData = JSON.parse(rawBody); }
  catch (e) { return new Response('Invalid JSON', { status: 400 }); }

  console.log('[email-inbound] Subject:', postmarkData.Subject);
  console.log('[email-inbound] From:', postmarkData.From);
  console.log('[email-inbound] TextBody length:', postmarkData.TextBody?.length ?? 'null');
  console.log('[email-inbound] HtmlBody length:', postmarkData.HtmlBody?.length ?? 'null');

  let emailText = postmarkData.TextBody ?? '';
  if (!emailText && postmarkData.HtmlBody) {
    emailText = postmarkData.HtmlBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('[email-inbound] Used HtmlBody stripped, length:', emailText.length);
  }
  if (!emailText) {
    await pushToMats('❌ Färdplan — Tomt mail', 'Mailet hade ingen text att tolka', 'email-empty');
    return new Response(JSON.stringify({ error: 'No text' }), { status: 200 });
  }

  const today = new Date().toISOString().slice(0, 10);
  let parsedBooking: any = null;
  try {
    const system = PARSE_SYSTEM_PROMPT(today);
    const userText = 'Extrahera reseinformation ur följande bokningstext:\n\n' + emailText.substring(0, 8000);
    let content = '';
    try {
      console.log('[email-inbound] Calling Anthropic...');
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system,
          messages: [{ role: 'user', content: userText }],
        }),
      });

      console.log('[email-inbound] Anthropic status:', anthropicRes.status);
      const anthropicJson = await anthropicRes.json();
      if (!anthropicRes.ok) throw new Error(`Anthropic ${anthropicRes.status}: ${JSON.stringify(anthropicJson)}`);
      content = anthropicJson.content?.[0]?.text ?? '';
    } catch (e) {
      console.error('[email-inbound] Anthropic failed, trying Gemini:', String(e).substring(0, 300));
      content = (await geminiText(system, userText)) ?? '';
      if (!content) throw e;
      console.log('[email-inbound] Parsed by Gemini');
    }
    console.log('[email-inbound] Parse content:', content.substring(0, 300));

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response: ' + content);
    parsedBooking = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[email-inbound] Parse error:', e);
    await pushToMats('❌ Färdplan — Parse misslyckades', String(e).substring(0, 100), 'email-parse-error');
    return new Response(JSON.stringify({ error: 'Parse failed', detail: String(e) }), { status: 200 });
  }

  if (parsedBooking.error) {
    console.log('[email-inbound] No booking found:', parsedBooking.error);
    await pushToMats('⚠️ Färdplan — Ingen bokning', parsedBooking.error, 'email-no-booking');
    return new Response(JSON.stringify({ info: parsedBooking.error }), { status: 200 });
  }

  // Match sender to family
  const fromEmail = (postmarkData.From ?? '').toLowerCase();
  const fromName = postmarkData.FromFull?.Name ?? fromEmail;
  // Modellen returnerar namn som de står i mailet ("Mats Enmark"). Appen känner bara
  // familjens förnamn — okända namn gav en extra grå avatar bredvid riktiga Mats.
  let travelers: string[] = Array.from(new Set(
    (parsedBooking.travelers ?? [])
      .map((n: unknown) => FAMILY.find(m => m.name.toLowerCase() === String(n).trim().split(/\s+/)[0].toLowerCase())?.name)
      .filter(Boolean),
  )) as string[];
  if (!travelers.length) {
    const match = FAMILY.find(m => m.emails.some(e => fromEmail.includes(e.toLowerCase())));
    travelers = match ? [match.name] : [];
    console.log('[email-inbound] Travelers from sender:', travelers);
  }

  const startDateTime = parsedBooking.startDateTime ?? new Date().toISOString();

  // En befintlig resa väger tyngre än modellens gissning på nytt namn.
  const matchedTrip = await matchExistingTrip(startDateTime);
  const tripLabel = matchedTrip ?? await uniqueTripLabel(parsedBooking.tripLabelSuggestion ?? 'Importerad bokning', startDateTime);
  console.log('[email-inbound] tripLabel:', tripLabel, matchedTrip ? '(matchade befintlig resa)' : '(ny resa)');

  const bookingId = 'email_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const booking = {
    id: bookingId,
    category: parsedBooking.category ?? 'other',
    title: parsedBooking.title ?? postmarkData.Subject ?? 'Bokning från mail',
    provider: parsedBooking.provider ?? '',
    startDateTime,
    endDateTime: parsedBooking.endDateTime ?? null,
    location: parsedBooking.location ?? '',
    confirmationCode: parsedBooking.confirmationCode ?? null,
    travelers,
    price: parsedBooking.price ?? null,
    currency: parsedBooking.currency ?? null,
    details: parsedBooking.details ?? '',
    tripLabel,
    addedVia: 'email',
    travelersConfirmed: false,
    fromEmail,
    fromName,
    addedAt: new Date().toISOString(),
  };

  console.log('[email-inbound] Inserting:', booking.title, '| travelers:', travelers);

  const { error: insertErr } = await supabase.from('bookings').insert({
    id: booking.id,
    trip_label: booking.tripLabel,
    start_date_time: booking.startDateTime,
    booking_data: booking,
  });

  if (insertErr) {
    console.error('[email-inbound] DB error:', insertErr.message);
    await pushToMats('❌ Färdplan — Sparning misslyckades', insertErr.message, 'email-db-error');
    return new Response(JSON.stringify({ error: insertErr.message }), { status: 200 });
  }

  console.log('[email-inbound] OK:', booking.id);
  const calendarUrl = `${SUPABASE_URL}/functions/v1/calendar-add?id=${encodeURIComponent(booking.id)}&t=${await signCalendarToken(booking.id)}`;
  await pushToMats(
    '✈️ Bokning sparad i Färdplan',
    `"${booking.title}" är inlagd under ${booking.tripLabel}`,
    'email-success-' + booking.id,
    { actions: [{ action: 'calendar', title: 'Lägg i kalendern' }], data: { calendarUrl } },
  );

  return new Response(JSON.stringify({ ok: true, id: booking.id, tripLabel, matchedExisting: Boolean(matchedTrip) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
