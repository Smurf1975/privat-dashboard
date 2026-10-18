// onyx-proxy – Onyx Innebandy från svenskalag.se till dashboardens Sport-flik.
//
// svenskalag.se har inget API men renderar allt server-side. robots.txt
// (kontrollerad 2026-08-09) spärrar /dokument/, /faktura/, /rss/ m.fl. —
// lagsidorna och /matcher är tillåtna. Bara publika sidor hämtas, aldrig
// inloggat, och inga spelarnamn plockas ut (laguppställningarna är barn).
//
// CACHEN LIGGER I DATABASEN. Edge-funktioners modulvariabler delas inte
// mellan anrop — verifierat 2026-08-08 med news-proxy. Rör inte det.
//
// TABELLER: primärt officiella stats.innebandy.se (se openApi nedan). Reserv
// för serier som bara finns på svenskalag (t.ex. DM): lagsidans "Visa tabell" listar föregående säsongs serier och är
// därför fel i början av en ny säsong. Serierna som laget spelar NU är
// filterlänkarna (id="link-<seasonId>") på /matcher; tabellen för varje
// seasonId hämtas från /seasons/standings (verifierat 2026-10-17).

// also = serier som laget spelar enligt förbundet men som saknas i svenskalag-filtret.
type Team = { key: string; name: string; slug: string; full: boolean; also?: string[] };

// full=false → F15 spelar sammandrag; tabellen blir tom och döljs av dashboarden.
const TEAMS: Team[] = [
  { key: 'p13',   name: 'P12/13',   slug: 'onyxinnebandy-p12-13',      full: true  },
  { key: 'p14',   name: 'P14',      slug: 'onyxinnebandy-p14',         full: true  },
  { key: 'f15',   name: 'F15',      slug: 'onyxinnebandy-f15nykoping', full: false },
  { key: 'herra', name: 'Herrar A', slug: 'onyxinnebandy-herr',        full: true  },
  { key: 'dama',  name: 'Damer A',  slug: 'onyxinnebandy-damera',      full: true  },
  { key: 'hjas',  name: 'HJAS',     slug: 'onyxinnebandy-jas',         full: true  },
  { key: 'djas',  name: 'DJAS',     slug: 'onyxinnebandy-jas-2',       full: true  },
];

const BASE = 'https://www.svenskalag.se';
const UA = 'Mozilla/5.0 (compatible; EnmarkCommandCenter/1.0; +https://privat-dashboard-inky.vercel.app)';

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const REST = `${SB_URL}/rest/v1/onyx_cache`;
const dbHeaders = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' };
const TTL_MS = 60 * 60 * 1000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

const ENT: Record<string, string> = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ' };
const txt = (s: string) => s
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&([a-z]+);/gi, (m, e) => ENT[e] ?? m)
  .replace(/\s+/g, ' ')
  .trim();

const isOnyx = (s: string) => /onyx/i.test(s);

// seasonId → serienamn, från filterlänkarna högst upp på /matcher.
function parseSeries(html: string) {
  const series: Record<string, string> = {};
  for (const m of html.matchAll(/<a[^>]*id="link-(\d+)"[^>]*class="sfilter[^"]*"[^>]*>([^]*?)<\/a>/gi)) {
    series[m[1]] = txt(m[2]);
  }
  return series;
}

// ── Matcher ─────────────────────────────────────────────────────
function parseMatches(html: string, series: Record<string, string>) {
  const out: any[] = [];
  for (const m of html.matchAll(/<tr class="season month-item-(\d{5,6})"[^>]*seasonId="(\d+)"[^>]*>([^]*?)<\/tr>/gi)) {
    const ym = m[1];                       // t.ex. 20259 = 2025-09, 202510 = 2025-10
    const year = +ym.slice(0, 4);
    const month = +ym.slice(4);
    const row = m[3];

    const day = +(row.match(/<nobr>\s*\S+\s+(\d{1,2})\s*<\/nobr>/i)?.[1] ?? 0);
    if (!day || !month) continue;
    const time = row.match(/<span class="text-muted">\s*(\d{1,2}:\d{2})/i)?.[1] ?? '';

    const teamsRaw = txt(row.match(/<div class="schedule-teams">([^]*?)<\/div>/i)?.[1] ?? '');
    const linkText = txt(row.match(/<a[^>]*class="ListLink"[^>]*>([^]*?)<\/a>/i)?.[1] ?? '');
    if (!linkText) continue;
    const [home, away] = linkText.split(/\s+-\s+/);
    if (!home || !away) continue;

    // Arenan är det som står efter lagnamnen i samma block.
    const arena = teamsRaw.replace(linkText, '').trim();

    const resRaw = txt(row.match(/<div class="schedule-result">([^]*?)<\/div>/i)?.[1] ?? '');
    const score = resRaw.match(/^(\d+)\s*-\s*(\d+)$/);

    out.push({
      ts: Date.UTC(year, month - 1, day, ...(time ? time.split(':').map(Number) as [number, number] : [0, 0])) - 2 * 3600e3,
      date: `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}`,
      time, home, away, arena,
      serie: series[m[2]] ?? '',
      hs: score ? +score[1] : null,
      as: score ? +score[2] : null,
    });
  }
  return out;
}

// ── Serietabeller ───────────────────────────────────────────────
// Kolumner: Lag, M, V, O, F, GM, IM, +/-, P
function parseStandings(html: string) {
  const rows: any[] = [];
  for (const tr of html.matchAll(/<tr[^>]*>([^]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<td[^>]*>([^]*?)<\/td>/gi)].map(c => txt(c[1]));
    if (cells.length < 9) continue;
    const pos = +(cells[0].match(/^(\d+)\./)?.[1] ?? 0);
    const team = cells[0].replace(/^\d+\.\s*/, '');
    if (!pos || !team) continue;
    rows.push({ pos, team, m: +cells[1], p: +cells[8], onyx: isOnyx(team) });
  }
  return rows;
}

// ── Officiella tabeller: stats.innebandy.se (Svensk Innebandy) ───
// Sajten är en SPA som hämtar JSON från api.innebandy.se med en anonym token
// (auth/startkit — samma som alla besökare får). Tabellerna där ligger före
// svenskalag.se, som uppdateras manuellt. Fungerar inget här faller vi tillbaka
// på svenskalag-tabellen för serien.
const API = 'https://api.innebandy.se/v2/api';
const FEDERATIONS = [9, 8, 1, 16];   // Södermanland, Stockholm, Svenska IBF, Östergötland
const normSerie = (s: string) => s.toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').trim();

async function openApi() {
  const kit = await (await fetch(`${API}/auth/startkit`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) })).json();
  const headers = { 'User-Agent': UA, Authorization: `Bearer ${kit.accessToken}` };
  const j = async (path: string) => {
    const r = await fetch(`${API}/public/${path}`, { headers, signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(`API ${r.status}`);
    return r.json();
  };
  const seasons = await j('seasons/');
  const season = (seasons.find((s: any) => s.IsCurrentSeason) ?? seasons[0]).SeasonID;

  const byName = new Map<string, number[]>();
  for (const fed of FEDERATIONS) {
    try {
      for (const c of await j(`seasons/${season}/federations/${fed}/competitions`)) {
        const k = normSerie(c.Name);
        byName.set(k, [...new Set([...(byName.get(k) ?? []), c.CompetitionID])]);
      }
    } catch { /* en förbundslista som fallerar räcker inte för att stoppa resten */ }
  }

  const memo = new Map<number, Promise<any[]>>();
  const rowsOf = (id: number) => {
    if (!memo.has(id)) memo.set(id, j(`competitions/${id}/standings`).then((d: any) =>
      // TeamStatusID 5 (t.ex. Torshälla 0 matcher) visas inte på stats.innebandy.se.
      (d.StandingsRows ?? []).filter((r: any) => r.TeamStatusID !== 5).map((r: any) => {
        const team = String(r.TeamName ?? '').trim();
        return { pos: r.Position, team, m: r.PlayedMatchesHome + r.PlayedMatchesAway, p: r.Points, onyx: isOnyx(team) };
      })).catch(() => []));
    return memo.get(id)!;
  };

  // Samma seriename kan finnas i flera förbund — välj den där Onyx spelar.
  return async (serie: string) => {
    for (const id of byName.get(normSerie(serie)) ?? []) {
      const rows = await rowsOf(id);
      if (rows.some(r => r.onyx)) return rows;
    }
    return null;
  };
}

async function get(url: string) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'sv' },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function refresh() {
  const now = Date.now();
  const diag: any[] = [];
  const official = await openApi().catch((e) => {
    diag.push({ official: false, err: String(e?.message || e).slice(0, 60) });
    return async (_: string) => null as any[] | null;
  });

  const teams = await Promise.all(TEAMS.map(async t => {
    try {
      const matchHtml = await get(`${BASE}/${t.slug}/matcher`);
      const series = parseSeries(matchHtml);

      const all = parseMatches(matchHtml, series).sort((a, b) => a.ts - b.ts);
      const played = all.filter(m => m.hs !== null);
      const upcoming = all.filter(m => m.hs === null && m.ts >= now - 6 * 3600e3);

      // En tabell per aktuell serie (träningsmatcher har ingen tabell).
      // Officiell tabell först; svenskalag-tabellen om serien saknas där.
      const wanted: { id?: string; name: string }[] = [
        ...Object.entries(series).filter(([, n]) => !/träning/i.test(n)).map(([id, name]) => ({ id, name })),
        ...(t.also ?? []).map(name => ({ name })),
      ];
      const seen = new Set<string>();
      const standings = (await Promise.all(
        wanted.filter(w => { const k = normSerie(w.name); return !seen.has(k) && !!seen.add(k); }).map(async w => {
          try {
            const rows = await official(w.name);
            if (rows?.length) return { serie: w.name, src: 'innebandy.se', rows };
          } catch { /* faller tillbaka */ }
          if (!w.id) return null;
          try {
            const h = await get(`${BASE}/${t.slug}/seasons/standings/-1/?seasonid=${w.id}&type=detailed&cssclass=table-head-default&matchgroupid=`);
            const rows = parseStandings(h);
            return rows.length ? { serie: w.name, src: 'svenskalag.se', rows } : null;
          } catch { return null; }
        }),
      )).filter(Boolean);

      diag.push({ team: t.key, ok: true, matcher: all.length, kommande: upcoming.length, tabeller: standings.length });
      return {
        key: t.key, name: t.name, full: t.full,
        url: `${BASE}/${t.slug}`,
        next: upcoming.slice(0, 4),
        results: played.slice(-5).reverse(),
        standings,
      };
    } catch (e) {
      diag.push({ team: t.key, ok: false, err: String((e as Error)?.message || e).slice(0, 60) });
      return { key: t.key, name: t.name, full: t.full, url: `${BASE}/${t.slug}`, next: [], results: [], standings: [] };
    }
  }));

  return { teams, diag };
}

async function readCache() {
  try {
    const r = await fetch(`${REST}?id=eq.all&select=payload,updated_at`, { headers: dbHeaders });
    if (!r.ok) return null;
    const row = (await r.json())?.[0];
    if (!row) return null;
    return { payload: row.payload, age: Date.now() - Date.parse(row.updated_at) };
  } catch { return null; }
}

async function writeCache(payload: unknown) {
  await fetch(REST, {
    method: 'POST',
    headers: { ...dbHeaders, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ id: 'all', payload, updated_at: new Date().toISOString() }]),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  const debug = url.searchParams.get('debug') === '1';
  const force = url.searchParams.get('force') === '1';

  const shape = (p: any) => ({ teams: p.teams, ...(debug ? { diag: p.diag } : {}) });

  try {
    const cached = await readCache();
    if (!force && cached && cached.age < TTL_MS) {
      return new Response(JSON.stringify({ ...shape(cached.payload), cached: true, ageMin: Math.round(cached.age / 60000) }), { headers: cors });
    }
    const payload = await refresh();
    await writeCache(payload);
    return new Response(JSON.stringify({ ...shape(payload), cached: false }), { headers: cors });
  } catch (e) {
    const cached = await readCache();
    if (cached) return new Response(JSON.stringify({ ...shape(cached.payload), stale: true }), { headers: cors });
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e), teams: [] }), { status: 200, headers: cors });
  }
});
