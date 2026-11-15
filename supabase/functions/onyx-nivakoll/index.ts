// onyx-nivakoll – veckovis kontroll att Onyx Coach-appens matcher ligger på
// rätt nivå (serie) jämfört med svenskalag.se. ÄNDRAR INGENTING i appen.
//
// Körs av pg_cron söndagar 21:00 svensk tid (cron 19:00 + 20:00 UTC; funktionen
// släpper bara igenom anropet där klockan i Stockholm är 21 → rätt både
// sommar- och vintertid). Skickar alltid en push-notis till Mats:
// "✅ Allt stämmer" eller "⚠️ N avvikelser". Hela rapporten sparas i
// onyx_nivakoll_log och visas på ?visa=1 (notisen länkar dit).
//
// Anrop:
//   POST  + header x-nivakoll-cron  → schemalagd körning (kollar klockan)
//   POST  + header x-nivakoll-cron, ?nu=1   → kör direkt (manuellt)
//   POST  + header x-nivakoll-cron, ?dry=1  → kör direkt, ingen push, ingen logg
//   GET   ?visa=1                    → senaste rapporten som HTML
//
// Källor:
//   Appen: Neon (secret NEON_DATABASE_URL), tabellerna matches/teams/seasons/
//          season_levels/match_callups.
//   svenskalag.se: /matcher-sidorna (samma parser som onyx-proxy). P14-sidan är
//          P12/13-lagets F-lag ("Pantamera Röd F Pojkar").

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { neon } from 'npm:@neondatabase/serverless@0.10.4';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const FN_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/onyx-nivakoll?visa=1`;
const VAPID_SUBJECT = 'https://privat-dashboard-inky.vercel.app';

const P1213 = '33333333-2026-4000-8000-000000000001';
const F15 = '33333333-2026-4000-8000-000000000002';
const PAGES = [
  { slug: 'onyxinnebandy-p12-13',      team: P1213, lag: 'P12/13' },
  { slug: 'onyxinnebandy-p14',         team: P1213, lag: 'P12/13' },
  { slug: 'onyxinnebandy-f15nykoping', team: F15,   lag: 'F15' },
];

const BASE = 'https://www.svenskalag.se';
const UA = 'Mozilla/5.0 (compatible; EnmarkCommandCenter/1.0; +https://privat-dashboard-inky.vercel.app)';

// ── svenskalag-parser (samma som onyx-proxy) ───────────────────────
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const txt = (s: string) => s
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&([a-z]+);/gi, (m, e) => ENT[e] ?? m)
  .replace(/\s+/g, ' ')
  .trim();

function parseSeries(html: string) {
  const series: Record<string, string> = {};
  for (const m of html.matchAll(/<a[^>]*id="link-(\d+)"[^>]*class="sfilter[^"]*"[^>]*>([^]*?)<\/a>/gi)) {
    series[m[1]] = txt(m[2]);
  }
  return series;
}

type SLMatch = { date: string; time: string; home: string; away: string; serie: string; hs: number | null; as: number | null };

function parseMatches(html: string, series: Record<string, string>): SLMatch[] {
  const out: SLMatch[] = [];
  for (const m of html.matchAll(/<tr class="season month-item-(\d{5,6})"[^>]*seasonId="(\d+)"[^>]*>([^]*?)<\/tr>/gi)) {
    const ym = m[1];
    const year = +ym.slice(0, 4);
    const month = +ym.slice(4);
    const row = m[3];
    const day = +(row.match(/<nobr>\s*\S+\s+(\d{1,2})\s*<\/nobr>/i)?.[1] ?? 0);
    if (!day || !month) continue;
    const time = row.match(/<span class="text-muted">\s*(\d{1,2}:\d{2})/i)?.[1] ?? '';
    const linkText = txt(row.match(/<a[^>]*class="ListLink"[^>]*>([^]*?)<\/a>/i)?.[1] ?? '');
    const [home, away] = linkText.split(/\s+-\s+/);
    if (!home || !away) continue;
    const resRaw = txt(row.match(/<div class="schedule-result">([^]*?)<\/div>/i)?.[1] ?? '');
    const score = resRaw.match(/^(\d+)\s*-\s*(\d+)$/);
    out.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      time, home, away,
      serie: series[m[2]] ?? '',
      hs: score ? +score[1] : null,
      as: score ? +score[2] : null,
    });
  }
  return out;
}

// "Pantamera Röd F Pojkar" → "röd f", "Pantamera Blå Flickor A" → "blå a".
// Appens nivåer heter "Röd F - Sörmland", "Blå A - Sörmland".
function serieKey(s: string): string | null {
  const t = s.toLowerCase();
  const color = t.match(/(röd|blå|grön|gul|svart)/)?.[1];
  if (!color) return null;
  const rest = t.replace(/pantamera|pojkar|flickor|röd|blå|grön|gul|svart/g, ' ');
  const letter = rest.match(/(?:^|\s)([a-f])(?:\s|$)/)?.[1];
  return letter ? `${color} ${letter}` : null;
}
const levelKey = (name: string | null) => (name ? serieKey(name.split(' - ')[0]) : null);
const levelLabel = (k: string | null) => (k ? k.charAt(0).toUpperCase() + k.slice(1, -1) + k.slice(-1).toUpperCase() : 'ingen nivå');

// Vårt lag på svenskalag heter alltid "Onyx Innebandy …". Andra "Onyx IBS …"
// (Oxelösund, Nyköping Vit) är motståndare i F15-serien.
const isUs = (s: string) => /^onyx innebandy(\s|$)/i.test(s.trim());

const STOP = new Set(['ifk', 'if', 'ibk', 'sibk', 'ibf', 'ibs', 'sk', 'fbc', 'ik', 'u', 'ungdom', 'röd', 'blå', 'onyx', 'innebandy', 'vit', 'svart']);
const words = (s: string) => s.toLowerCase().split(/[^a-zåäö]+/).filter(w => w.length >= 4 && !STOP.has(w));
function sameOpp(a: string, b: string) {
  const wa = words(a), wb = words(b);
  return wa.some(x => wb.some(y => x.slice(0, 5) === y.slice(0, 5)));
}

const toMin = (t: string | null) => {
  const m = t?.match(/(\d{1,2}):(\d{2})/);
  return m ? +m[1] * 60 + +m[2] : null;
};

async function get(url: string) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'sv' },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.text();
}

type AppMatch = {
  id: string; team_id: string; datum: string; starts_at: string | null; note: string | null;
  opponent: string; niva: string | null; our_score: number | null; their_score: number | null; med: number;
};

type Issue = { typ: 'NIVÅ' | 'SAKNAS' | 'EXTRA' | 'DATUM' | 'TID' | 'RESULTAT'; lag: string; text: string; id?: string };

const fmtD = (d: string) => `${+d.slice(8, 10)}/${+d.slice(5, 7)}`;

export async function runCheck(fetchHtml = get, appRows?: AppMatch[]) {
  // 1) svenskalag
  const sl: (SLMatch & { team: string; lag: string; opp: string; key: string; our: number | null; their: number | null })[] = [];
  const seen = new Set<string>();
  for (const p of PAGES) {
    const html = await fetchHtml(`${BASE}/${p.slug}/matcher`);
    const series = parseSeries(html);
    const ms = parseMatches(html, series);
    if (!ms.length) throw new Error(`Inga matcher kunde läsas från ${p.slug} – sidans format kan ha ändrats`);
    for (const m of ms) {
      if (/träning/i.test(m.serie)) continue;
      const key = serieKey(m.serie);
      if (!key) continue; // cup o.d. – inte en nivå i appen
      const homeUs = isUs(m.home), awayUs = isUs(m.away);
      if (homeUs === awayUs) continue;
      const dedupe = `${p.team}|${m.date}|${m.home}|${m.away}|${key}`;
      if (seen.has(dedupe)) continue; // sidorna listar säsongen två gånger
      seen.add(dedupe);
      sl.push({
        ...m, team: p.team, lag: p.lag, key,
        opp: homeUs ? m.away : m.home,
        our: m.hs === null ? null : homeUs ? m.hs : m.as,
        their: m.hs === null ? null : homeUs ? m.as : m.hs,
      });
    }
  }

  // 2) appen (Neon)
  let rows = appRows;
  if (!rows) {
    const url = Deno.env.get('NEON_DATABASE_URL');
    if (!url) throw new Error('Secret NEON_DATABASE_URL saknas');
    const sql = neon(url);
    rows = await sql`
      select m.id, m.team_id, to_char(m.played_on,'YYYY-MM-DD') datum, m.starts_at::text starts_at, m.note, m.opponent,
             l.name niva, m.our_score, m.their_score,
             (select count(*)::int from match_callups c where c.match_id=m.id and c.status='med') med
      from matches m
      join seasons s on s.id=m.season_id and s.is_active
      left join season_levels l on l.id=m.level_id
      where m.match_type='serie' and m.team_id = any(${[P1213, F15]}::uuid[])` as AppMatch[];
  }
  // Seriematcher utan färgnivå (t.ex. cup-nivåer) jämförs inte; matcher helt utan nivå tas med.
  const app = rows.filter(r => r.niva === null || levelKey(r.niva) !== null);

  // 3) para ihop
  const issues: Issue[] = [];
  const usedA = new Set<string>();
  const usedS = new Set<number>();
  const lagOf = (team: string) => (team === F15 ? 'F15' : 'P12/13');

  const check = (s: typeof sl[number], a: AppMatch) => {
    const ak = levelKey(a.niva);
    const lag = lagOf(a.team_id);
    const vad = `${fmtD(s.date)} ${s.opp}`;
    if (ak !== s.key) {
      issues.push({ typ: 'NIVÅ', lag, id: a.id,
        text: `${vad}: appen ${levelLabel(ak)} → svenskalag ${levelLabel(s.key)}${a.med ? ` (${a.med} spelare med – deras nivåräkning påverkas)` : ''}` });
    }
    if (a.datum !== s.date) {
      issues.push({ typ: 'DATUM', lag, id: a.id, text: `${s.opp} (${levelLabel(s.key)}): appen ${fmtD(a.datum)} → svenskalag ${fmtD(s.date)} ${s.time}` });
    } else {
      const at = toMin(a.starts_at) ?? toMin(a.note);
      const st = toMin(s.time);
      if (at !== null && st !== null && Math.abs(at - st) > 10) {
        issues.push({ typ: 'TID', lag, id: a.id, text: `${vad} (${levelLabel(s.key)}): appen ${a.starts_at?.slice(0, 5) ?? a.note} → svenskalag ${s.time}` });
      }
    }
    if (s.our !== null && a.our_score !== null && (s.our !== a.our_score || s.their !== a.their_score)) {
      issues.push({ typ: 'RESULTAT', lag, id: a.id, text: `${vad}: appen ${a.our_score}-${a.their_score} → svenskalag ${s.our}-${s.their}` });
    }
  };

  const pair = (fn: (s: typeof sl[number], a: AppMatch) => boolean) => {
    sl.forEach((s, i) => {
      if (usedS.has(i)) return;
      const a = app.find(a => !usedA.has(a.id) && a.team_id === s.team && fn(s, a));
      if (!a) return;
      usedS.add(i); usedA.add(a.id);
      check(s, a);
    });
  };

  // a) samma dag + motståndare + nivå  b) samma dag + motståndare (→ fel nivå)
  // c) samma motståndare + nivå, annan dag inom 45 dagar (→ flyttad)
  pair((s, a) => a.datum === s.date && sameOpp(s.opp, a.opponent) && levelKey(a.niva) === s.key);
  pair((s, a) => a.datum === s.date && sameOpp(s.opp, a.opponent));
  pair((s, a) => sameOpp(s.opp, a.opponent) && levelKey(a.niva) === s.key &&
    Math.abs(Date.parse(a.datum) - Date.parse(s.date)) <= 45 * 864e5);

  sl.forEach((s, i) => {
    if (!usedS.has(i)) issues.push({ typ: 'SAKNAS', lag: s.lag, text: `${fmtD(s.date)} ${s.time} ${s.opp} (${levelLabel(s.key)}) finns på svenskalag men inte i appen` });
  });
  for (const a of app) {
    if (usedA.has(a.id)) continue;
    issues.push({ typ: 'EXTRA', lag: lagOf(a.team_id), id: a.id,
      text: `${fmtD(a.datum)} ${a.opponent} (${levelLabel(levelKey(a.niva))}) finns bara i appen – struken/flyttad?${a.med ? ` ${a.med} spelare med!` : ''}` });
  }

  const order = ['NIVÅ', 'EXTRA', 'SAKNAS', 'DATUM', 'TID', 'RESULTAT'];
  issues.sort((x, y) => order.indexOf(x.typ) - order.indexOf(y.typ) || x.lag.localeCompare(y.lag));
  return { issues, antalSvenskalag: sl.length, antalApp: app.length };
}

async function sendPush(title: string, body: string) {
  const pub = Deno.env.get('VAPID_PUBLIC_KEY'), priv = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!pub || !priv) throw new Error('VAPID-nycklar saknas');
  webpush.setVapidDetails(VAPID_SUBJECT, pub, priv);
  const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_name', 'Mats');
  if (!subs?.length) return 0;
  const payload = JSON.stringify({ title, body, tag: 'onyx-nivakoll', data: { url: FN_URL } });
  const res = await Promise.allSettled(subs.map((s: any) =>
    webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)));
  for (let i = 0; i < res.length; i++) {
    const r = res[i];
    if (r.status === 'rejected' && (r.reason as any)?.statusCode === 410) {
      await sb.from('push_subscriptions').delete().eq('endpoint', subs[i].endpoint);
    }
  }
  return res.filter(r => r.status === 'fulfilled').length;
}

const RUBRIK: Record<string, string> = {
  NIVÅ: 'Fel nivå', EXTRA: 'Finns bara i appen', SAKNAS: 'Saknas i appen', DATUM: 'Flyttad', TID: 'Annan tid', RESULTAT: 'Annat resultat',
};

export function summary(issues: Issue[]) {
  if (!issues.length) return { title: '✅ Onyx nivåkoll: allt stämmer', body: 'Appens matcher och nivåer stämmer med svenskalag.' };
  const n = `${issues.length} avvikelse${issues.length > 1 ? 'r' : ''}`;
  const title = issues.some(i => i.typ === 'NIVÅ') ? `⚠️ Onyx nivåkoll: FEL NIVÅ – ${n}` : `⚠️ Onyx nivåkoll: ${n}`;
  const body = issues.slice(0, 4).map(i => `${RUBRIK[i.typ]} (${i.lag}): ${i.text}`).join('\n')
    + (issues.length > 4 ? `\n+${issues.length - 4} till – tryck för hela listan` : '');
  return { title, body };
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

async function page() {
  const { data } = await sb.from('onyx_nivakoll_log').select('*').order('ran_at', { ascending: false }).limit(1).maybeSingle();
  const when = data ? new Date(data.ran_at).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' }) : '–';
  const issues: Issue[] = data?.details?.issues ?? [];
  const list = !data ? '<p>Ingen körning ännu.</p>'
    : data.error ? `<p class="bad">Kollen kunde inte köras: ${esc(data.error)}</p>`
    : !issues.length ? '<p class="ok">✅ Allt stämmer.</p>'
    : Object.keys(RUBRIK).map(t => {
        const rows = issues.filter(i => i.typ === t);
        return rows.length ? `<h2>${RUBRIK[t]} (${rows.length})</h2><ul>${rows.map(i =>
          `<li><b>${esc(i.lag)}</b> ${esc(i.text)}${i.id ? `<br><small>match-id ${esc(i.id)}</small>` : ''}</li>`).join('')}</ul>` : '';
      }).join('');
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Onyx nivåkoll</title><style>body{font:15px/1.45 system-ui,sans-serif;margin:16px;max-width:680px;background:#fff;color:#111}
h1{font-size:20px}h2{font-size:16px;margin-top:20px}li{margin:6px 0}small{color:#777}.ok{color:#17803d;font-weight:600}.bad{color:#b42318;font-weight:600}
@media(prefers-color-scheme:dark){body{background:#111;color:#eee}small{color:#999}}</style>
<h1>Onyx nivåkoll</h1><p>Senast kontrollerad: ${esc(when)}${data?.details ? ` · ${data.details.antalApp} seriematcher i appen, ${data.details.antalSvenskalag} på svenskalag` : ''}</p>${list}
<p><small>Jämför Onyx Coach-appen med svenskalag.se. Ändrar ingenting – rätta i appen.</small></p>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  if (req.method === 'GET' && u.searchParams.has('visa')) return page();

  const { data: cfg } = await sb.from('onyx_nivakoll_config').select('value').eq('key', 'cron_key').maybeSingle();
  if (!cfg?.value || req.headers.get('x-nivakoll-cron') !== cfg.value) {
    return new Response('forbidden', { status: 403 });
  }

  const dry = u.searchParams.has('dry');
  const now = u.searchParams.has('nu') || dry;
  const hour = +new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', hour12: false });
  if (!now && hour !== 21) return Response.json({ skipped: true, stockholmHour: hour });

  try {
    const r = await runCheck();
    const s = summary(r.issues);
    if (dry) return Response.json({ ...s, ...r });
    await sb.from('onyx_nivakoll_log').insert({ ok: r.issues.length === 0, antal: r.issues.length, details: r });
    const sent = await sendPush(s.title, s.body);
    return Response.json({ ok: true, avvikelser: r.issues.length, pushSent: sent });
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 300);
    if (dry) return Response.json({ error: msg }, { status: 500 });
    await sb.from('onyx_nivakoll_log').insert({ ok: false, antal: null, error: msg });
    await sendPush('⚠️ Onyx nivåkoll kunde inte köras', msg).catch(() => 0);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
});
