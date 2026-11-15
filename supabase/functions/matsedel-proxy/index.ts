// matsedel-proxy – skolmatsedel för Kunskapsskolan Nyköping.
//
// Skolan publicerar INGEN matsedels-API. De lägger upp en PDF per vecka på
// sidan "Praktisk information", exporterad från ett Excel-ark, med en
// slumpmässig URL varje gång. Därför: skrapa sidan, plocka den PDF vars
// filnamn har högst veckonummer, läs ut texten och tolka den.
//
// Det är med nödvändighet bräckligt — ändrar skolan mall eller sidstruktur
// slutar det fungera. Klienten måste tåla tomt svar.
// ponytail: PDF-tolkning med regex. Bättre källa finns inte; byter skolan till
// Mashie/Matilda/Skolmaten.se — kasta det här och använd deras API i stället.
//
// ?force=1 hämtar om, men bara när cachen är äldre än FORCE_MIN_AGE_MS
// (säkerhetsrevision 2026-11-15).

import { extractText, getDocumentProxy } from 'https://esm.sh/unpdf@0.12.1';

const PAGE = 'https://www.kunskapsskolan.se/skolor/nykoping/om-skolan/praktisk-information';
const DAYS = ['MÅNDAG', 'TISDAG', 'ONSDAG', 'TORSDAG', 'FREDAG'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

// ISO-veckonummer — samma räkning som skolan använder i filnamnen.
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - start.getTime()) / 86400000 + 1) / 7);
}

function parseMenu(raw: string) {
  // PDF-texten kommer utan pålitliga radbrytningar — normalisera till ett svep.
  // Sidfoten ("Det som kommer från hjärtat...") kapas först, annars hänger den
  // med in i fredagens vegetariska rätt.
  const text = raw
    .replace(/\s+/g, ' ')
    .replace(/\s*Det som kommer från hjärtat[^]*$/i, '')
    .replace(/\s*Smaklig Måltid!?[^]*$/i, '')
    .trim();

  const weekMatch = text.match(/VECKA\s*(\d+)/i);
  const week = weekMatch ? Number(weekMatch[1]) : null;

  const days: { day: string; lunch: string; veg: string }[] = [];
  for (let i = 0; i < DAYS.length; i++) {
    const from = text.toUpperCase().indexOf(DAYS[i]);
    if (from < 0) continue;
    // Klipp vid nästa dag som faktiskt finns, annars resten av dokumentet.
    let to = text.length;
    for (let j = i + 1; j < DAYS.length; j++) {
      const nxt = text.toUpperCase().indexOf(DAYS[j], from + 1);
      if (nxt > from) { to = nxt; break; }
    }
    const block = text.slice(from + DAYS[i].length, to);
    const veg = block.match(/Vegetarisk\s*:?\s*([^]*?)(?=\s*(?:Lunch|$))/i)?.[1]?.trim() ?? '';
    const lunch = block.match(/Lunch\s*:?\s*([^]*?)(?=\s*Vegetarisk|$)/i)?.[1]?.trim() ?? '';
    if (!lunch && !veg) continue;
    days.push({ day: DAYS[i][0] + DAYS[i].slice(1).toLowerCase(), lunch, veg });
  }
  return { week, days };
}

let cache: { at: number; body: string } | null = null;
const TTL = 6 * 60 * 60 * 1000;   // matsedeln byts en gång i veckan
const FORCE_MIN_AGE_MS = 2 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const force = new URL(req.url).searchParams.get('force') === '1';

  try {
    const honorForce = force && (!cache || Date.now() - cache.at > FORCE_MIN_AGE_MS);
    if (!honorForce && cache && Date.now() - cache.at < TTL) {
      return new Response(cache.body, { headers: { ...cors, 'X-Cache': 'hit' } });
    }

    const html = await (await fetch(PAGE, {
      headers: { 'User-Agent': 'EnmarkCommandCenter/1.0 (privat dashboard)' },
    })).text();

    // Alla PDF-länkar vars filnamn innehåller "veckomeny", med veckonummer.
    const found: { url: string; week: number }[] = [];
    for (const m of html.matchAll(/href="((?:https:\/\/www\.kunskapsskolan\.se)?\/download\/[^"]+?\.pdf)"/gi)) {
      const href = m[1].startsWith('http') ? m[1] : `https://www.kunskapsskolan.se${m[1]}`;
      const name = decodeURIComponent(href);
      if (!/veckomeny/i.test(name)) continue;
      const w = name.match(/vecka\s*(\d+)/i);
      found.push({ url: href, week: w ? Number(w[1]) : 0 });
    }
    if (!found.length) throw new Error('hittade ingen veckomeny-pdf på sidan');

    // Ta i första hand innevarande vecka, annars den senaste som finns.
    const nowWeek = isoWeek(new Date());
    const pick = found.find(f => f.week === nowWeek)
      ?? found.sort((a, b) => b.week - a.week)[0];

    const bytes = new Uint8Array(await (await fetch(pick.url)).arrayBuffer());
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });

    const { week, days } = parseMenu(String(text));

    const body = JSON.stringify({
      school: 'Kunskapsskolan Nyköping',
      week: week ?? pick.week,
      currentWeek: nowWeek,
      // Skolan släpar ofta efter, och under lov ligger sista terminsveckan kvar.
      // Klienten måste kunna säga "gammal meny" i stället för att ljuga.
      stale: (week ?? pick.week) !== nowWeek,
      days,
      sourceUrl: pick.url,
    });

    cache = { at: Date.now(), body };
    return new Response(body, { headers: { ...cors, 'X-Cache': 'miss' } });
  } catch (e) {
    if (cache) return new Response(cache.body, { headers: { ...cors, 'X-Cache': 'stale' } });
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e), days: [] }), {
      status: 200, headers: cors,   // 200 med tom lista — kortet ska degradera, inte krascha
    });
  }
});
