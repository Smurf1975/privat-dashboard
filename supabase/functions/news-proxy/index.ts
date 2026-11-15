// news-proxy – RSS-aggregat för Media-fliken i Enmark Command Center.
//
// Varför proxy: nästan inga RSS-källor skickar CORS-headers, så webbläsaren
// kan inte hämta dem direkt.
//
// CACHEN LIGGER I DATABASEN, INTE I MINNET. Verifierat 2026-08-08: varje anrop
// landar i en ny isolat, så en modulvariabel träffar aldrig. Tabellen
// news_cache delas mellan isolat. Rör inte tillbaka till in-memory-cache.
//
// Öppen utan inloggning, som weather- och bathing-proxy: publika nyheter.
// ?debug=1 visar per-flöde-status.
// ?force=1 hämtar om, men bara när cachen är äldre än FORCE_MIN_AGE_MS
// (säkerhetsrevision 2026-11-15: öppen force gav vem som helst 19 utgående
// hämtningar per anrop).
//
// DÖDA SVENSKA KÄLLOR (testade 2026-08-09, leta inte igen):
// m3.idg.se + pcforalla.idg.se (flyttade till .se-domäner), Ny Teknik (RSS
// nedlagd), Ljud & Bild (tomt flöde), 99mac (403), etn.se (tomt).
// Feber Pryl utelämnad med flit — delmängd av Febers huvudflöde = dubbletter.

type Feed = { src: string; cat: string; url: string };
type Item = { src: string; cat: string; title: string; url: string; ts: number };

// ORDNING SPELAR ROLL: dubbletter kastas mot första träffen, så smala
// kategorier ligger före breda (Verge Smart Home före Verges huvudflöde).
const FEEDS: Feed[] = [
  { src: 'Verge Smart Home', cat: 'home', url: 'https://www.theverge.com/rss/smart-home/index.xml' },
  { src: 'HomeKit News',     cat: 'home', url: 'https://homekitnews.com/feed/' },
  { src: 'Simon Willison',   cat: 'ai',   url: 'https://simonwillison.net/atom/everything/' },
  { src: 'HN · Claude',      cat: 'ai',   url: 'https://hnrss.org/newest?q=Anthropic+OR+Claude&points=50' },
  { src: 'Hacker News',      cat: 'ai',   url: 'https://hnrss.org/frontpage?points=150' },
  { src: 'Ars Technica AI',  cat: 'ai',   url: 'https://arstechnica.com/ai/feed/' },
  { src: 'This Is Anfield',  cat: 'sport',url: 'https://www.thisisanfield.com/feed/' },
  { src: 'Guardian PL',      cat: 'sport',url: 'https://www.theguardian.com/football/premierleague/rss' },
  { src: 'BBC Football',     cat: 'sport',url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
  { src: 'Innebandymagazinet', cat: 'sport', url: 'https://www.innebandymagazinet.se/feed/' },
  { src: 'Innebandy.se',     cat: 'sport',url: 'https://www.innebandy.se/rss' },
  { src: 'The Verge',        cat: 'tech', url: 'https://www.theverge.com/rss/index.xml' },
  { src: 'Ars Technica',     cat: 'tech', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { src: 'Feber',            cat: 'tech', url: 'https://feber.se/rss/' },
  // Svensk IT-press (verifierade 2026-08-09)
  { src: 'SweClockers',      cat: 'tech', url: 'https://www.sweclockers.com/feeds/nyheter' },
  { src: 'Mobil',            cat: 'tech', url: 'https://www.mobil.se/rss' },
  { src: 'Computer Sweden',  cat: 'tech', url: 'https://computersweden.idg.se/rss/nyheter' },
  { src: 'PC för Alla',      cat: 'tech', url: 'https://www.pcforalla.se/feed' },
  { src: 'M3',               cat: 'tech', url: 'https://www.m3.se/feed' },
];

// Per kategori, inte globalt — glesa flöden åker annars ut.
// tech höjd till 45 när fem svenska källor tillkom; övriga 30.
const PER_CAT: Record<string, number> = { tech: 45 };
const PER_CAT_DEFAULT = 30;

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const REST = `${SB_URL}/rest/v1/news_cache`;
const dbHeaders = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' };
const TTL_MS = 20 * 60 * 1000;
const FORCE_MIN_AGE_MS = 2 * 60 * 1000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aring: 'å', Aring: 'Å', auml: 'ä', Auml: 'Ä', ouml: 'ö', Ouml: 'Ö',
  hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', middot: '·',
};

function clean(s: string): string {
  return s
    .replace(/<!\[CDATA\[([^]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, e) => ENTITIES[e] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

const tag = (block: string, name: string) =>
  block.match(new RegExp(`<${name}[^>]*>([^]*?)</${name}>`, 'i'))?.[1] ?? '';

function parseFeed(xml: string, feed: Feed): Item[] {
  const blocks = xml.match(/<(item|entry)[\s>][^]*?<\/\1>/gi) ?? [];
  const out: Item[] = [];
  for (const b of blocks) {
    const title = clean(tag(b, 'title'));
    if (!title) continue;
    let link = clean(tag(b, 'link'));
    if (!link) {
      const alts = [...b.matchAll(/<link\b([^>]*)\/?>/gi)].map(m => m[1]);
      const pick = alts.find(a => !/rel=["']self["']/i.test(a)) ?? alts[0] ?? '';
      link = pick.match(/href=["']([^"']+)["']/i)?.[1] ?? '';
    }
    if (!link) continue;
    const dateRaw = tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published') || tag(b, 'dc:date');
    const ts = dateRaw ? Date.parse(clean(dateRaw)) : NaN;
    out.push({ src: feed.src, cat: feed.cat, title, url: link, ts: isNaN(ts) ? 0 : ts });
  }
  return out;
}

async function readCache(): Promise<{ items: Item[]; diag: unknown; age: number } | null> {
  try {
    const r = await fetch(`${REST}?id=eq.all&select=payload,updated_at`, { headers: dbHeaders });
    if (!r.ok) return null;
    const rows = await r.json();
    const row = rows?.[0];
    if (!row) return null;
    return {
      items: row.payload?.items ?? [],
      diag: row.payload?.diag ?? null,
      age: Date.now() - Date.parse(row.updated_at),
    };
  } catch { return null; }
}

async function writeCache(items: Item[], diag: unknown) {
  await fetch(REST, {
    method: 'POST',
    headers: { ...dbHeaders, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ id: 'all', payload: { items, diag }, updated_at: new Date().toISOString() }]),
  }).catch(() => {});
}

async function refresh(): Promise<{ items: Item[]; diag: unknown }> {
  const diag: { src: string; ok: boolean; n: number; err?: string }[] = [];

  const results = await Promise.all(FEEDS.map(async f => {
    try {
      const r = await fetch(f.url, {
        headers: {
          // Flera sajter (Guardian, Innebandy.se, HomeKit News) svarar bara på
          // en webbläsarlik User-Agent. Verifierat 2026-08-08.
          'User-Agent': 'Mozilla/5.0 (compatible; EnmarkCommandCenter/1.0; +https://privat-dashboard-inky.vercel.app)',
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
          'Accept-Language': 'sv,en;q=0.8',
        },
        signal: AbortSignal.timeout(9000),
      });
      if (!r.ok) { diag.push({ src: f.src, ok: false, n: 0, err: `HTTP ${r.status}` }); return []; }
      const items = parseFeed(await r.text(), f);
      diag.push({ src: f.src, ok: true, n: items.length });
      return items;
    } catch (e) {
      diag.push({ src: f.src, ok: false, n: 0, err: String((e as Error)?.name || e).slice(0, 60) });
      return [];
    }
  }));

  let all = results.flat();

  const seen = new Set<string>();
  all = all.filter(a => {
    const key = a.title.toLowerCase().slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  all.sort((a, b) => b.ts - a.ts);

  const perCat: Record<string, number> = {};
  const items = all.filter(a => (perCat[a.cat] = (perCat[a.cat] ?? 0) + 1) <= (PER_CAT[a.cat] ?? PER_CAT_DEFAULT));

  return { items, diag };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = new URL(req.url);
  const wantCat = url.searchParams.get('cat');
  const debug = url.searchParams.get('debug') === '1';
  const force = url.searchParams.get('force') === '1';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 40), 200);

  const pick = (all: Item[]) => (wantCat ? all.filter(a => a.cat === wantCat) : all).slice(0, limit);

  try {
    const cached = await readCache();
    const honorForce = force && (!cached || cached.age > FORCE_MIN_AGE_MS);
    if (!honorForce && cached && cached.age < TTL_MS) {
      return new Response(JSON.stringify({
        items: pick(cached.items), cached: true, ageMin: Math.round(cached.age / 60000),
        ...(debug ? { diag: cached.diag } : {}),
      }), { headers: cors });
    }

    const { items, diag } = await refresh();
    await writeCache(items, diag);
    return new Response(JSON.stringify({ items: pick(items), cached: false, ...(debug ? { diag } : {}) }), { headers: cors });
  } catch (e) {
    const cached = await readCache();
    if (cached) return new Response(JSON.stringify({ items: pick(cached.items), stale: true }), { headers: cors });
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e), items: [] }), { status: 200, headers: cors });
  }
});
