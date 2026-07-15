// Fettdatabas — smörjfett-jämförelse
// Frontend-SPA. Auth via magic link, data via Supabase RLS, AI-matchning via edge function fett-sok.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// OBS: "Välj fett" laddas lazy nedan (se renderMain). Slå på med VALJFETT_ENABLED
// när valj-fett-calc.js är färdig — annars är fliken vilande.

const CFG = window.FETT_CONFIG;
const sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
const FN_URL = `${CFG.SUPABASE_URL}/functions/v1`;

// ---------- state ----------
const state = {
  session: null,
  me: null,          // rad ur app_anvandare { epost, namn, roll }
  view: 'sok',
  // sök
  query: '',
  filters: { basolja: [], fortjockare: [], fasta: [], ptfeFri: false, nlgi: [], nsf: [], tillampning: [] },
  searching: false,
  searchMode: null,    // 'translate' (konkurrent→FUCHS via AI) | 'browse' (bara filter, ingen AI)
  searchResult: null, // { competitor, results, note }
  browseResult: null,  // FUCHS-rader vid filterbläddring utan konkurrentnamn
  // jämförelse
  compare: null,      // { competitor, fuchs }
  // katalog
  katalog: [], katalogFilter: { typ: 'alla', q: '' },
  // granskning
  mail: [],
  // admin
  users: [],
};

// ---------- filter-definitioner (label -> matchvärden i DB, inkl. stavvarianter) ----------
// Varje val fångar alla varianter som finns i databasen (datan är delvis ostädad).
const F = {
  basolja: [
    ['Mineralisk', ['Mineralisk Grupp I', 'Mineralisk Grupp II', 'Mineralisk Grupp I/II', 'Mineralisk', 'Mineralolja', 'Medicinsk vit mineralolja']],
    ['PAO', ['PAO']],
    ['Ester', ['Ester', 'Syntetisk ester']],
    ['Polyglykol (PAG)', ['Polyglykol', 'PAG', 'PG/PAG']],
    ['White oil', ['White oil']],
    ['Silikon', ['Silikon', 'Silikone', 'Siliconolja', 'Fluorosilikon']],
    ['PFPE', ['PFPE', 'Fluorerad olja (PFPE)']],
    ['Vegetabilisk/nedbrytbar', ['Vegetabilisk', 'Biologiskt nedbrytbar basolja']],
    ['Syntetisk (övrig)', ['Syntetisk', 'Fullsyntetisk', 'Semi-syntetisk', 'Delsyntetisk', 'PIB']],
    ['Övrigt', ['Övrigt']],
  ],
  fortjockare: [
    ['Litium', ['Litium']],
    ['Litiumkomplex', ['Litiumkomplex']],
    ['Litium/Kalcium', ['Litium/Kalcium', 'Litium-Kalcium']],
    ['Kalcium', ['Kalcium', 'Kalciumtvål']],
    ['Kalciumkomplex', ['Kalciumkomplex']],
    ['Kalciumsulfonat', ['Kalciumsulfonat']],
    ['Aluminiumkomplex', ['Aluminiumkomplex', 'Aluminium']],
    ['Polyurea', ['Polyurea']],
    ['Natrium', ['Natrium']],
    ['Natriumkomplex', ['Natriumkomplex']],
    ['Barium', ['Barium', 'Bariumkomplex']],
    ['Bentonit', ['Bentonit']],
    ['PTFE', ['PTFE', 'PTFE-förtjockare', 'PTFE-telomer']],
    ['Silika (SiO₂)', ['Silikagel (SiO2)', 'Silikat', 'Silicon']],
    ['Oorganisk', ['Oorganisk', 'Inorganisk']],
    ['Koppar', ['Koppartvål']],
    ['Övrigt', ['Övrigt', 'Komplex', 'Varierar', 'Metalltvål', 'Organisk', 'Aluminiumkomplex + Polyurea', 'Fluorerad förtjockare']],
  ],
  fasta: [
    ['Vita fasta', ['Vita fasta smörjämnen', 'Vita fasta smörjmedel']],
    ['PTFE', ['PTFE']],
    ['MoS₂', ['MoS2']],
    ['Grafit', ['Grafit']],
    ['BN (bornitrid)', ['BN (bornitrid)', 'BN']],
    ['Koppar', ['Koppar']],
    ['Titandioxid (TiO₂)', ['Titandioxid']],
    ['Aluminiumpulver', ['Aluminiumpulver']],
    ['Inga', ['Inga']],
  ],
  nlgi: ['000', '00', '0', '1', '1.5', '2', '2.5', '3', '4', '5', '6'],
  // H1 breddas till att även matcha 3H-produkter (3H innebär i praktiken alltid H1-registrering).
  // 3H hålls strikt — inte alla H1-produkter är 3H.
  nsf: [
    ['H1', ['H1', '3H']],
    ['H2', ['H2']],
    ['3H', ['3H']],
  ],
  tillampning: [
    ['Rullager', ['Rullager', 'Rullager vid höga temperaturer']],
    ['Glidlager', ['Glidlager', 'Ledlager', 'Bussningar', 'Glidytor', 'Glidbanor', 'Mekaniska glidbanor']],
    ['Kullager', ['Kullager']],
    ['Spindellager', ['Spindellager', 'Spindlar', 'Höghastighetslager', 'Höghastighetsapplikationer']],
    ['Elmotorlager', ['Elektromotorer', 'Elmotorer', 'Elektriska motorer', 'Elmotorslager', 'Fläktlager']],
    ['Kugghjul/växlar (stängda)', ['Kugghjul', 'Kuggväxlar', 'Kuggmekanismer', 'Reduktionsenheter', 'Transmissioner', 'Snäckväxlar']],
    ['Öppna kugg/kuggväxlar', ['Öppna kugghjul', 'Öppna kuggväxlar']],
    ['Kedjor', ['Kedjor', 'Kedjesmörjning', 'Sågkedjor', 'Harvesterkedjor', 'Lödmaskinkedjor']],
    ['Räls/spår', ['Räls', 'Spårsmörjning', 'Spårväxelsmörjning', 'Hjulflänsar', 'Järnväg', 'Järnvägsfordon', 'Tunnelbana', 'Vagnaxlar']],
    ['Skruv/gängförband', ['Skruvar och infästningar', 'Skruvar', 'Gängförband', 'Skruvanslutningar', 'Bultar', 'Fittings']],
    ['Ventiler', ['Ventiler', 'Gasventiler', 'Ångventiler']],
    ['Tätningar/O-ringar', ['Tätningar', 'O-ringar']],
    ['Högtryck / EP', ['Högtryck EP', 'Höglastlager', 'Höglastapplikationer', 'Hög last', 'Extremtrycksapplikationer', 'Hydraulhammare']],
    ['Hög temperatur', ['Hög temperatur', 'Högtempapplikationer', 'Extremtemperatur', 'Härdugnar', 'Ugnar', 'Roterugnar', 'Torkugnar']],
    ['Låg temperatur', ['Låg temperatur', 'Lågtemperatur', 'Lågtemperaturapplikationer']],
    ['Vattenexponering', ['Vattenexponering', 'Vattenutsatta miljöer', 'Vattenpumpar', 'Marin', 'Offshore']],
    ['Livsmedelsindustri', ['Livsmedelsindustri', 'Livsmedel', 'Livsmedelsmaskineri', 'Dryckesproduktion', 'Slakteri', 'Livsmedels-/farmaindustri']],
    ['Elektriska kontakter', ['Elektriska kontakter', 'Kontaktdon', 'Högspänningskontakter', 'Ställverkskontakter', 'Guld-kontakter']],
    ['Plast/gummi', ['Plast och gummi', 'Plast', 'Gummi', 'Plast- och gummismörjning']],
    ['Vakuum', ['Vakuum', 'Högvakuum', 'Vakuumutrustning']],
    ['Centralsmörjning', ['Centralsmörjning', 'Automatsmörjare', 'Centralsystem', 'Smörjsystem', 'Matarsystem']],
    ['Tung industri', ['Kranar', 'Tung industri', 'Gruvindustri', 'Gruvdrift', 'Stålverk', 'Stålindustri', 'Cementindustri', 'Pappersmaskiner', 'Pappersindustri']],
  ],
};
// Expandera valda etiketter till DB-varianter innan sökning
function expandFilter(kind, labels) {
  const defs = F[kind];
  if (!Array.isArray(labels) || !labels.length) return [];
  const out = [];
  for (const lab of labels) {
    const def = Array.isArray(defs) ? defs.find(d => (Array.isArray(d) ? d[0] : d) === lab) : null;
    if (Array.isArray(def)) out.push(...def[1]); else out.push(lab);
  }
  return [...new Set(out)];
}
const overlaps = (a, b) => Array.isArray(a) && a.some(x => b.includes(x));

// Bläddra FUCHS-sortimentet enbart via filter, utan konkurrentprodukt/AI (snabbt, ingen kostnad).
async function browseFuchs(expanded) {
  let qb = sb.from('fett')
    .select('id,produktnamn,producent,nlgi_klass,temperaturomrade_min,temperaturomrade_max,basolja,fortjockare,fasta_smorjamnen,nsf_klass_food_grade,tillampningsomrade')
    .eq('tillverkartyp', 'FUCHS').neq('status', 'Utgången').order('produktnamn').limit(300);
  if (expanded.nlgi.length) qb = qb.in('nlgi_klass', expanded.nlgi);
  if (expanded.nsf.length) qb = qb.in('nsf_klass_food_grade', expanded.nsf);
  const { data, error } = await qb;
  if (error) throw new Error(error.message);
  let rows = data || [];
  if (expanded.basolja.length) rows = rows.filter(r => overlaps(r.basolja, expanded.basolja));
  if (expanded.fortjockare.length) rows = rows.filter(r => overlaps(r.fortjockare, expanded.fortjockare));
  if (expanded.fasta.length) rows = rows.filter(r => overlaps(r.fasta_smorjamnen, expanded.fasta));
  if (expanded.ptfeFri) rows = rows.filter(r => !(Array.isArray(r.fasta_smorjamnen) && r.fasta_smorjamnen.includes('PTFE')));
  if (expanded.tillampning.length) rows = rows.filter(r => overlaps(r.tillampningsomrade, expanded.tillampning));
  return rows;
}

// Slå på när valj-fett-calc.js är klar → då aktiveras "Välj fett"-fliken igen
const VALJFETT_ENABLED = true;

const NAV = [
  ['sok', 'Sök & översätt'], ['valjfett', 'Välj fett'], ['katalog', 'Produktkatalog'],
  ['granskning', 'Granskningskö'], ['anvandare', 'Användare'],
];

// ---------- utils ----------
const $ = (s, r = document) => r.querySelector(s);
const app = () => $('#app');
const esc = (v) => v == null ? '' : String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const arr = (a) => Array.isArray(a) ? a.filter(Boolean).join(', ') : (a || '');
const tempStr = (r) => (r.temperaturomrade_min != null || r.temperaturomrade_max != null)
  ? `${r.temperaturomrade_min ?? '?'}…${r.temperaturomrade_max ?? '?'}°C` : '—';

// Empty-state ikoner (delade, samma linjevikt som sökfältets förstoringsglas)
const ICO_SEARCH = `<svg class="empty-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="6.5"/><line x1="15" y1="15" x2="21" y2="21"/></svg>`;
const ICO_INBOX = `<svg class="empty-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3.5 12h5l1.8 2.8h3.4L15.5 12h5"/><path d="M5.2 12 3.5 5h17l-1.7 7"/><path d="M3.5 12v6.2c0 .7.5 1.3 1.2 1.3h14.6c.7 0 1.2-.6 1.2-1.3V12"/></svg>`;

// Skeleton-rader för Sök & översätt (fyller samma gridkolumner som riktiga träffar → ingen layoutförskjutning)
function skeletonSokRows(n, browse) {
  const bar = (w, h = 12) => `<span class="sk" style="width:${w};height:${h}px"></span>`;
  const lead = browse ? '' : `<div class="tsim">${bar('30px', 15)}</div>`;
  return Array.from({ length: n }).map(() => `<div class="tr sk-tr${browse ? ' browse' : ''}">
    ${lead}
    <div>${bar('62%', 14)}<div style="margin-top:7px">${bar('34%', 10)}</div></div>
    <div class="cell num">${bar('16px')}</div>
    <div class="cell num">${bar('58px')}</div>
    <div class="cell">${bar('64px')}</div>
    <div class="cell">${bar('64px')}</div>
    <div>${bar('28px')}</div>
    <div>${bar('58px', 28)}</div>
  </div>`).join('');
}
// Skeleton-tabell för Produktkatalog — bygger på samma kolumner som är valda, så headern står kvar under laddning
function drawKatalogSkeleton() {
  const el = $('#ktable'); if (!el) return;
  const kol = katalogValdaKolumner();
  const widths = ['70%', '45%', '85%', '55%', '30%', '60%', '40%'];
  el.innerHTML = `<table class="grid"><thead><tr>${kol.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>
    ${Array.from({ length: 7 }).map((_, ri) => `<tr>${kol.map((c, ci) => `<td><span class="sk" style="width:${widths[(ri + ci) % widths.length]};height:12px"></span></td>`).join('')}</tr>`).join('')}
  </tbody></table>`;
}
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
const isEditor = () => state.me && ['admin', 'redaktor'].includes(state.me.roll);
const isAdmin = () => state.me && state.me.roll === 'admin';

// Länk(ar) till användarens webbmail utifrån maildomän — för att snabbt öppna inkorgen
function webmailLinks(email) {
  const d = (email.split('@')[1] || '').toLowerCase();
  if (/gmail|googlemail/.test(d)) return [{ label: 'Öppna Gmail', url: 'https://mail.google.com/mail/u/0/', primary: true }];
  if (/outlook|hotmail|live|msn/.test(d)) return [{ label: 'Öppna Outlook', url: 'https://outlook.live.com/mail/', primary: true }];
  if (/yahoo/.test(d)) return [{ label: 'Öppna Yahoo Mail', url: 'https://mail.yahoo.com/', primary: true }];
  // Okänd företagsdomän: erbjud de två vanligaste (Google Workspace / Microsoft 365)
  return [
    { label: 'Öppna Gmail', url: 'https://mail.google.com/mail/u/0/', primary: true },
    { label: 'Öppna Outlook', url: 'https://outlook.office.com/mail/', primary: false },
  ];
}

// ---------- auth bootstrap ----------
function consumeAuthErrorFromUrl() {
  const hash = window.location.hash;
  if (!hash.includes('error=')) return null;
  const params = new URLSearchParams(hash.slice(1));
  const desc = params.get('error_description');
  const code = params.get('error_code');
  history.replaceState(null, '', window.location.pathname + window.location.search);
  if (code === 'otp_expired') return 'Länken har redan använts eller gått ut. Be om en ny länk nedan — och öppna det senaste mailet, inte ett äldre.';
  return desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : 'Inloggningen misslyckades. Be om en ny länk.';
}

async function boot() {
  const authError = consumeAuthErrorFromUrl();
  const { data } = await sb.auth.getSession();
  state.session = data.session;
  if (state.session) await loadMe();
  sb.auth.onAuthStateChange(async (_e, session) => {
    const wasIn = !!state.session; state.session = session;
    if (session && !state.me) { await loadMe(); render(); }
    if (!session && wasIn) { state.me = null; render(); }
  });
  render(authError);
}

async function loadMe() {
  const email = state.session.user.email;
  const { data, error } = await sb.from('app_anvandare').select('*').ilike('epost', email).maybeSingle();
  state.meError = error ? error.message : null;
  if (error) console.warn('loadMe', error.message);
  state.me = data || null; // null => inloggad men inte på allowlist
}

// ---------- render root ----------
function render(authError) {
  if (!state.session) return renderLogin(authError);
  if (!state.me) return renderNoAccess();
  renderShell();
}

// ---------- login ----------
function renderLogin(authError) {
  app().innerHTML = `
  <div class="login"><div class="login-card">
    <div class="login-lockup"><img src="logo-lockup.png" alt="Fettdatabas"><div class="login-eyebrow">Teknik</div></div>
    <p class="login-sub">Logga in med din jobbmail. Du får en inloggningslänk skickad — inget lösenord behövs.</p>
    ${authError ? `<div class="login-msg err">${esc(authError)}</div>` : ''}
    <form id="loginForm">
      <label for="email">E-postadress</label>
      <input id="email" type="email" placeholder="namn@företaget.se" autocomplete="email" required>
      <button class="login-btn" id="loginBtn" type="submit">Skicka inloggningslänk</button>
    </form>
    <div id="loginMsg"></div>
  </div></div>`;
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#email').value.trim();
    const btn = $('#loginBtn'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Skickar…';
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: CFG.REDIRECT_URL } });
    if (error) {
      $('#loginMsg').className = 'login-msg err'; $('#loginMsg').textContent = 'Kunde inte skicka: ' + error.message;
      btn.disabled = false; btn.textContent = 'Skicka inloggningslänk';
    } else {
      const btns = webmailLinks(email).map(w =>
        `<a class="login-btn" style="display:block;text-align:center;text-decoration:none;margin-top:10px;${w.primary ? '' : 'background:#eef5fc;color:var(--blue);border:1px solid #b4d3ef'}" href="${w.url}" target="_blank" rel="noopener">${w.label} ↗</a>`
      ).join('');
      $('#loginMsg').className = 'login-msg ok';
      $('#loginMsg').innerHTML = `Länk skickad till <b>${esc(email)}</b>. Öppna det <b>senaste</b> mailet och klicka länken — då loggas du in direkt.${btns}`;
      btn.textContent = 'Länk skickad ✓';
    }
  });
}

function renderNoAccess() {
  const msg = state.meError
    ? `Kunde inte verifiera behörigheten just nu (${esc(state.meError)}). Försök ladda om sidan.`
    : `Kontot <b>${esc(state.session.user.email)}</b> finns inte på behörighetslistan. Be Mats lägga till dig innan du kan använda databasen.`;
  app().innerHTML = `
  <div class="login"><div class="login-card">
    <div class="login-lockup"><img src="logo-lockup.png" alt="Fettdatabas"><div class="login-eyebrow">Teknik</div></div>
    <div class="login-msg err" style="margin-top:20px">${msg}</div>
    ${state.meError ? '<button class="login-btn" id="reload" style="margin-top:16px">Ladda om</button>' : ''}
    <button class="login-btn ${state.meError ? '' : ''}" id="lo" style="margin-top:10px;background:#8494a2">Logga ut</button>
  </div></div>`;
  if (state.meError) $('#reload').addEventListener('click', () => location.reload());
  $('#lo').addEventListener('click', () => sb.auth.signOut());
}

// ---------- shell ----------
function renderShell() {
  const nav = NAV.filter(([id]) => (id !== 'anvandare' || isAdmin()) && (id !== 'valjfett' || VALJFETT_ENABLED))
    .map(([id, label]) => `<a data-nav="${id}" class="${state.view === id ? 'on' : ''}">
      <svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2.5"/></svg>${label}</a>`).join('');
  app().innerHTML = `
  <div class="page"><div class="shell">
    <div class="side">
      <div class="sbrand"><div class="slogo"><img src="logo-ikon.png" alt=""></div><div><div class="sbn">Fettdatabas</div><div class="sbs">Teknik</div></div></div>
      <nav class="nav">${nav}</nav>
      <div class="sfoot">
        <div class="suser"><b>${esc(state.me.namn || state.me.epost)}</b><br><span class="srole">${esc(state.me.roll)}</span></div>
        <button class="slogout" id="logout">Logga ut</button>
      </div>
    </div>
    <div class="main" id="main"></div>
  </div></div>`;
  app().querySelectorAll('[data-nav]').forEach(a => a.addEventListener('click', () => { state.view = a.dataset.nav; renderShell(); }));
  $('#logout').addEventListener('click', () => sb.auth.signOut());
  renderMain();
}

const ctx = () => ({ sb, FN_URL, session: () => state.session, toast, esc, openProduct });

function renderMain() {
  const m = $('#main');
  if (state.view === 'sok') return renderSok(m);
  if (state.view === 'valjfett') {
    if (!VALJFETT_ENABLED) { state.view = 'sok'; return renderSok(m); }
    m.innerHTML = `<div class="empty"><span class="spinner"></span> Laddar…</div>`;
    import('./valj-fett-vy.js')
      .then(mod => mod.renderValjFett(m, ctx()))
      .catch(() => { m.innerHTML = '<div class="empty">Välj fett kunde inte laddas (valj-fett-calc.js saknas).</div>'; });
    return;
  }
  if (state.view === 'katalog') return renderKatalog(m);
  if (state.view === 'jamforelse') return renderJamforelse(m);
  if (state.view === 'granskning') return renderGranskning(m);
  if (state.view === 'anvandare') return renderAnvandare(m);
}

// ---------- 1. Sök & översätt ----------
function chipRow(kind, opts, selected) {
  return opts.map(o => {
    const [label, val] = Array.isArray(o) ? [o[0], o[0]] : [o, o];
    const on = selected.includes(label) ? 'on' : '';
    return `<span class="chip ${on}" data-filter="${kind}" data-val="${esc(label)}">${esc(label)}</span>`;
  }).join('');
}
function ckRow(kind, opts, selected) {
  return opts.map(o => {
    const label = Array.isArray(o) ? o[0] : o;
    const on = selected.includes(label) ? 'on' : '';
    return `<div class="ck" data-filter="${kind}" data-val="${esc(label)}"><span class="box ${on}"></span>${esc(label)}</div>`;
  }).join('');
}

function renderSok(m) {
  const f = state.filters;
  m.innerHTML = `
    <div class="tbar">
      <div><div class="ttl">Sök & översätt</div><div class="tsub">Hitta bästa motsvarighet till en konkurrentprodukt</div></div>
      <div class="tsearch"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="4.5"/><line x1="10.4" y1="10.4" x2="14" y2="14"/></svg>
        <input id="q" placeholder="t.ex. Klüber Isoflex NBU 15" value="${esc(state.query)}"></div>
      <button class="tgo" id="go"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" style="vertical-align:-2px;margin-right:6px"><circle cx="7" cy="7" r="4.5"/><line x1="10.4" y1="10.4" x2="14" y2="14"/></svg>Sök</button>
    </div>
    <div class="body2">
      <div class="filt">
        <div class="filt-intro">Filtrera FUCHS-sortimentet — välj egenskaper och tryck <b>Sök på filter</b> längst ner.</div>
        <div class="fg"><div class="fh">Basolja</div>${ckRow('basolja', F.basolja, f.basolja)}</div>
        <div class="fg"><div class="fh">Förtjockare</div><div class="chips">${chipRow('fortjockare', F.fortjockare, f.fortjockare)}</div></div>
        <div class="fg"><div class="fh">Fasta smörjämnen</div>
          <div class="ck" data-filter="ptfeFri" data-val="__toggle"><span class="box ${f.ptfeFri ? 'on' : ''}"></span>Endast PTFE-fri</div>
          ${ckRow('fasta', F.fasta, f.fasta)}</div>
        <div class="fg"><div class="fh">NLGI-klass</div><div class="chips">${chipRow('nlgi', F.nlgi, f.nlgi)}</div></div>
        <div class="fg"><div class="fh">Tillämpning</div><div class="chips">${chipRow('tillampning', F.tillampning, f.tillampning)}</div></div>
        <div class="fg"><div class="fh">NSF-klass</div><div class="chips">${chipRow('nsf', F.nsf, f.nsf)}</div></div>
        <div class="filt-actions">
          <button class="tgo" id="goBottom" style="width:100%;justify-content:center;display:flex;align-items:center"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" style="vertical-align:-2px;margin-right:6px"><circle cx="7" cy="7" r="4.5"/><line x1="10.4" y1="10.4" x2="14" y2="14"/></svg>Sök på filter</button>
          <button class="filt-clear" id="clearFilters" type="button">Rensa filter</button>
        </div>
      </div>
      <div class="res" id="res">${renderSokResult()}</div>
    </div>`;

  $('#q').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  $('#go').addEventListener('click', doSearch);
  $('#goBottom').addEventListener('click', doBrowse);
  $('#clearFilters').addEventListener('click', () => {
    state.filters = { basolja: [], fortjockare: [], fasta: [], ptfeFri: false, nlgi: [], nsf: [], tillampning: [] };
    renderSok(m);
  });
  m.querySelectorAll('[data-filter]').forEach(el => el.addEventListener('click', () => {
    const k = el.dataset.filter, v = el.dataset.val;
    if (k === 'ptfeFri') state.filters.ptfeFri = !state.filters.ptfeFri;
    else { const a = state.filters[k]; const i = a.indexOf(v); i < 0 ? a.push(v) : a.splice(i, 1); }
    renderSok(m);
  }));
}

function renderSokResult() {
  if (state.searching && state.searchMode === 'browse') return `
    <div class="thd browse"><span>FUCHS-produkt</span><span class="num">NLGI</span><span class="num">Temp.område</span><span>Basolja</span><span>Förtjockare</span><span>NSF</span><span></span></div>
    ${skeletonSokRows(3, true)}`;
  if (state.searching) return `
    <div class="ai-note ai-note-loading"><span class="ai-chip">AI</span>Analyserar och rankar produkter…</div>
    <div class="thd"><span>Likhet</span><span>Föreslagen produkt</span><span class="num">NLGI</span><span class="num">Temp.område</span><span>Basolja</span><span>Förtjockare</span><span>NSF</span><span></span></div>
    ${skeletonSokRows(3)}`;
  if (state.searchMode === 'browse') {
    const rows = state.browseResult;
    if (!rows) return `<div class="empty">${ICO_SEARCH}Skriv in en konkurrentprodukt, eller välj filter till vänster och tryck <b>Sök</b> för att bläddra FUCHS-sortimentet direkt.</div>`;
    const aktiva = aktivaFilterChips();
    if (!rows.length) return `${aktiva}<div class="empty">${ICO_SEARCH}Inga FUCHS-produkter matchade <b>alla</b> valda filter samtidigt. Ta bort något ovan — filter i olika grupper kombineras (t.ex. basolja <b>och</b> förtjockare).</div>`;
    const rowsHtml = rows.map(x => {
      const nsf = (x.nsf_klass_food_grade && x.nsf_klass_food_grade !== 'Ej livsmedelsgodkänd')
        ? `<span class="nsf">${esc(x.nsf_klass_food_grade)}</span>` : `<div class="cell dim">—</div>`;
      return `<div class="tr browse" data-open="${x.id}">
        <div><div class="tpn">${esc(x.produktnamn)}</div><div class="tps">${esc(x.producent)}</div></div>
        <div class="cell num">${esc(x.nlgi_klass ?? '—')}</div>
        <div class="cell num">${tempStr(x)}</div>
        <div class="cell">${esc(arr(x.basolja) || '—')}</div>
        <div class="cell">${esc(arr(x.fortjockare) || '—')}</div>
        ${nsf}
        <div class="jmp">Visa ›</div>
      </div>`;
    }).join('');
    return `${aktiva}<div class="resh"><span class="t">${rows.length} FUCHS-produkter matchar filtren</span></div>
      <div class="thd browse"><span>FUCHS-produkt</span><span class="num">NLGI</span><span class="num">Temp.område</span><span>Basolja</span><span>Förtjockare</span><span>NSF</span><span></span></div>
      ${rowsHtml}`;
  }
  const r = state.searchResult;
  if (!r) return `<div class="empty">${ICO_SEARCH}<b>Två sätt att söka:</b><br>Skriv en konkurrentprodukt uppe till höger och tryck <b>Sök</b> → AI hittar närmaste FUCHS-motsvarighet.<br>Eller välj filter till vänster och tryck <b>Sök på filter</b> → bläddra FUCHS-sortimentet direkt.</div>`;
  if (!r.results || !r.results.length) return `<div class="empty">${ICO_SEARCH}Inga produkter matchade. Prova att lätta på filtren.</div>`;
  const comp = r.competitor;
  const uncertain = r.uncertain || comp?.matched === false;
  const uncertainMsg = uncertain
    ? `<b>Hittade inte "${esc(state.query)}" i databasen</b> — AI har gissat egenskaper utifrån namnet${comp?.produkttypGissad ? ' (inkl. produkttyp)' : ''}. Dubbelkolla mot verkligt datablad innan du litar på resultatet. `
    : `Tolkade sökningen som <b>${esc(comp?.produktnamn)}</b>${comp?.producent ? ` (${esc(comp.producent)})` : ''}. `;
  const noteCls = uncertain || r.typMismatch ? 'ai-note warn' : 'ai-note';
  const note = (r.note || uncertain) ? `<div class="${noteCls}"><span class="ai-chip">${uncertain || r.typMismatch ? '⚠' : 'AI'}</span>${uncertainMsg}${esc(r.note || '')}</div>` : '';
  const rows = r.results.map((x, i) => {
    const best = i === 0 ? 'best' : '';
    const col = i === 0 ? '' : `style="color:#5a9bd4"`, bar = i === 0 ? '' : `background:#5a9bd4`;
    const tag = i === 0 ? '<span class="topmatch">Bästa träff</span>' : '';
    const nsf = (x.nsf_klass_food_grade && x.nsf_klass_food_grade !== 'Ej livsmedelsgodkänd')
      ? `<span class="nsf">${esc(x.nsf_klass_food_grade)}</span>` : `<div class="cell dim">—</div>`;
    return `<div class="tr ${best}" data-jmp="${x.id}">
      <div class="tsim"><span class="tsn" ${col}>${x.likhet}%</span><div class="tbrz"><i style="width:${x.likhet}%;${bar}"></i></div></div>
      <div><div class="tpn">${esc(x.produktnamn)} ${tag}</div><div class="tps">${esc(x.producent)}${x.motivering ? ' · ' + esc(x.motivering) : ''}</div></div>
      <div class="cell num">${esc(x.nlgi_klass ?? '—')}</div>
      <div class="cell num">${tempStr(x)}</div>
      <div class="cell">${esc(arr(x.basolja) || '—')}</div>
      <div class="cell">${esc(arr(x.fortjockare) || '—')}</div>
      ${nsf}
      <div class="jmp"><span class="arr">›</span> Jämför</div>
    </div>`;
  }).join('');
  const fuchsCount = r.candidateCount ?? '';
  return `${note}
    <div class="resh"><span class="t">${r.results.length} träffar${fuchsCount ? ` · <span>av ${fuchsCount} i sortimentet</span>` : ''}</span><span class="s">Sortering: likhet ↓</span></div>
    <div class="thd"><span>Likhet</span><span>Föreslagen produkt</span><span class="num">NLGI</span><span class="num">Temp.område</span><span>Basolja</span><span>Förtjockare</span><span>NSF</span><span></span></div>
    ${rows}`;
}

function aktivaFilter() {
  const f = state.filters;
  return !!(f.basolja.length || f.fortjockare.length || f.fasta.length || f.ptfeFri
    || f.nlgi.length || f.tillampning.length || f.nsf.length);
}
// Chips som visar alla aktiva filter (grupperade) så användaren ser hela kombinationen.
function aktivaFilterChips() {
  const f = state.filters;
  const grp = [
    ['Basolja', f.basolja], ['Förtjockare', f.fortjockare], ['Fasta', f.fasta],
    ['NLGI', f.nlgi], ['Tillämpning', f.tillampning], ['NSF', f.nsf],
  ].filter(g => g[1].length);
  if (f.ptfeFri) grp.push(['', ['Endast PTFE-fri']]);
  if (!grp.length) return '';
  const chips = grp.map(([namn, vals]) =>
    `<span class="pill" style="background:#e3eefb;color:var(--blue)">${namn ? esc(namn) + ': ' : ''}${vals.map(esc).join(', ')}</span>`).join('');
  return `<div class="aktiva-filter">${chips}<span class="aktiva-hint">Grupper kombineras (och); värden inom en grupp är eller.</span></div>`;
}
function byggExpanderadeFilter() {
  const f = state.filters;
  return {
    basolja: expandFilter('basolja', f.basolja),
    fortjockare: expandFilter('fortjockare', f.fortjockare),
    fasta: expandFilter('fasta', f.fasta),
    tillampning: expandFilter('tillampning', f.tillampning),
    nlgi: f.nlgi || [],
    nsf: expandFilter('nsf', f.nsf),
    ptfeFri: !!f.ptfeFri,
  };
}

// Nedre knappen: bläddra FUCHS-sortimentet enbart på valda filter. Aldrig konkurrentprodukt/AI.
async function doBrowse() {
  if (!aktivaFilter()) { toast('Välj minst ett filter till vänster'); return; }
  state.searchMode = 'browse'; state.searching = true; state.browseResult = null; state.searchResult = null;
  if ($('#res')) $('#res').innerHTML = renderSokResult();
  try {
    state.browseResult = await browseFuchs(byggExpanderadeFilter());
  } catch (e) {
    toast('Fel: ' + e.message); state.browseResult = [];
  } finally {
    state.searching = false;
    if ($('#res')) $('#res').innerHTML = renderSokResult();
    $('#res')?.querySelectorAll('[data-open]').forEach(el =>
      el.addEventListener('click', () => openProduct(el.dataset.open)));
  }
}

// Övre knappen / Enter: översätt en konkurrentprodukt (AI). Om sökrutan är tom men filter
// finns faller den tillbaka till filterbläddring, så knappen aldrig känns "död".
async function doSearch() {
  const q = ($('#q')?.value || '').trim();
  if (!q) { if (aktivaFilter()) return doBrowse(); toast('Skriv in en konkurrentprodukt'); return; }

  state.query = q;
  state.searchMode = 'translate'; state.searching = true; state.searchResult = null; state.browseResult = null;
  $('#res').innerHTML = renderSokResult();
  try {
    const res = await fetch(`${FN_URL}/fett-sok`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.session.access_token}` },
      body: JSON.stringify({ query: q, filters: byggExpanderadeFilter() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Sökningen misslyckades');
    state.searchResult = data;
  } catch (e) {
    state.searchResult = { results: [], note: 'Fel: ' + e.message };
  } finally {
    state.searching = false;
    if ($('#res')) $('#res').innerHTML = renderSokResult();
    $('#res')?.querySelectorAll('[data-jmp]').forEach(el =>
      el.addEventListener('click', () => openCompare(el.dataset.jmp)));
  }
}

// ---------- 2. Jämförelse ----------
async function openCompare(fuchsId) {
  const { data, error } = await sb.from('fett').select('*').eq('id', fuchsId).single();
  if (error) { toast('Kunde inte hämta produkten'); return; }
  state.compare = { competitor: state.searchResult?.competitor || null, fuchs: data,
    totalLikhet: state.searchResult?.results.find(r => String(r.id) === String(fuchsId))?.likhet };
  state.view = 'jamforelse'; renderShell();
}

const CMP_FIELDS = [
  ['Produkttyp', 'produkttyp'], ['NLGI-klass', 'nlgi_klass'],
  ['Viskositet 40°C', r => r.viskositet_40c != null ? r.viskositet_40c + ' mm²/s' : null],
  ['Temperaturområde', r => tempStr(r) === '—' ? null : tempStr(r)],
  ['Basolja', r => arr(r.basolja)], ['Förtjockare', r => arr(r.fortjockare)],
  ['Fasta smörjämnen', r => arr(r.fasta_smorjamnen)], ['EP/AW-tillsatser', 'ep_aw_tillsatser'],
  ['NSF food grade', 'nsf_klass_food_grade'], ['PFAS-status', 'pfas_status'],
  ['Droppunkt', r => r.droppunkt != null ? '>' + r.droppunkt + '°C' : null],
];
function cmpVal(field, r) { if (!r) return null; return typeof field[1] === 'function' ? field[1](r) : r[field[1]]; }
function deltaFor(cv, fv) {
  if (cv == null && fv == null) return '';
  if (String(cv ?? '').trim() === String(fv ?? '').trim()) return '<span class="dl eq">=</span>';
  if (cv == null || cv === '' || cv === '—') return '<span class="dl u">Fördel</span>';
  return '<span class="dl d">Skillnad</span>';
}

function renderJamforelse(m) {
  const c = state.compare; if (!c) { state.view = 'sok'; return renderMain(); }
  const comp = c.competitor, fu = c.fuchs;
  const compName = comp ? (comp.produktnamn || state.query) : state.query;
  const rows = CMP_FIELDS.map((f, i) => {
    const cv = cmpVal(f, comp), fv = cmpVal(f, fu);
    return `<div class="cgr"><div class="cgl">${f[0]}</div>
      <div class="cgv">${esc(cv || '—')}</div>
      <div class="cgv fu">${esc(fv || '—')}</div>
      <div class="cgd">${deltaFor(cv, fv)}</div></div>`;
  }).join('');
  m.innerHTML = `
    <div class="ch">
      <div class="chl">Jämförelse <span>· ${esc(compName)} mot ${esc(fu.produktnamn)}</span></div>
      ${c.totalLikhet ? `<div class="badge">Total likhet <b>${c.totalLikhet}%</b></div>` : ''}
    </div>
    <div style="padding:16px 26px 0"><button class="btn ghost" id="back">‹ Tillbaka till sökningen</button></div>
    <div class="cmp-wrap" style="padding:16px 26px 26px">
      <div class="cgh"><div>Egenskap</div><div class="comp">Konkurrent${comp && !comp.matched ? ' (AI-tolkad)' : ''}</div><div class="fu">Förslag · ${esc(fu.produktnamn)}</div><div class="dl">Δ</div></div>
      ${rows}
    </div>`;
  $('#back').addEventListener('click', () => { state.view = 'sok'; renderShell(); });
}

// ---------- 3. Produktkatalog ----------
const DASH = '<span style="color:#98a5b1">—</span>';
// Alla valbara kolumner. fast:true = kan inte stängas av (produktidentitet).
const KATALOG_KOLUMNER = [
  { key: 'produkt', label: 'Produkt', fast: true, cell: r => `<span style="font-weight:600;color:#17242f">${esc(r.produktnamn)}</span>` },
  { key: 'producent', label: 'Tillverkare', cell: r => esc(r.producent) || DASH },
  { key: 'tillverkartyp', label: 'Typ', cell: r => `<span class="pill ${r.tillverkartyp === 'FUCHS' ? 'fuchs' : 'konk'}">${esc(r.tillverkartyp)}</span>` },
  { key: 'produkttyp', label: 'Produkttyp', cell: r => esc(r.produkttyp) || DASH },
  { key: 'fortjockare', label: 'Förtjockare', cell: r => esc(arr(r.fortjockare)) || DASH },
  { key: 'basolja', label: 'Basolja', cell: r => esc(arr(r.basolja)) || DASH },
  { key: 'nlgi', label: 'NLGI', mono: true, num: true, cell: r => esc(r.nlgi_klass ?? '—') },
  { key: 'visk40', label: 'Visk. 40°C', mono: true, num: true, cell: r => r.viskositet_40c != null ? esc(r.viskositet_40c) : DASH },
  { key: 'visk100', label: 'Visk. 100°C', mono: true, num: true, cell: r => r.viskositet_100c != null ? esc(r.viskositet_100c) : DASH },
  { key: 'temp', label: 'Temp.område', mono: true, num: true, cell: r => tempStr(r) },
  { key: 'droppunkt', label: 'Droppunkt', mono: true, num: true, cell: r => r.droppunkt != null ? '>' + esc(r.droppunkt) + '°C' : DASH },
  { key: 'fasta', label: 'Fasta smörjämnen', cell: r => esc(arr(r.fasta_smorjamnen)) || DASH },
  { key: 'epaw', label: 'EP/AW', cell: r => esc(r.ep_aw_tillsatser) || DASH },
  { key: 'nsf', label: 'NSF', cell: r => (r.nsf_klass_food_grade && r.nsf_klass_food_grade !== 'Ej livsmedelsgodkänd') ? `<span class="pill h1">${esc(r.nsf_klass_food_grade)}</span>` : DASH },
  { key: 'pfas', label: 'PFAS', cell: r => esc(r.pfas_status) || DASH },
  { key: 'tillampning', label: 'Tillämpning', cell: r => esc(arr(r.tillampningsomrade)) || DASH },
  { key: 'artikelnummer', label: 'Art.nr', mono: true, cell: r => esc(r.artikelnummer) || DASH },
  { key: 'farg', label: 'Färg', cell: r => esc(r.farg) || DASH },
  { key: 'status', label: 'Status', cell: r => esc(r.status) || DASH },
];
const KATALOG_DEFAULT = ['produkt', 'producent', 'fortjockare', 'basolja', 'nlgi', 'temp', 'fasta'];
function katalogValdaKolumner() {
  if (!state.katalogKol) {
    let saved; try { saved = JSON.parse(localStorage.getItem('fett_katalog_kol')); } catch { /* ignore */ }
    state.katalogKol = (Array.isArray(saved) && saved.length) ? saved : [...KATALOG_DEFAULT];
  }
  // returnera i KATALOG_KOLUMNER-ordning, alltid med fasta kolumner först
  return KATALOG_KOLUMNER.filter(c => c.fast || state.katalogKol.includes(c.key));
}
function sparaKatalogKol() {
  localStorage.setItem('fett_katalog_kol', JSON.stringify(state.katalogKol));
}

// Kolumner som går att filtrera i rubriken (kategoriska). Returnerar värde(n) per rad.
const KATALOG_FILTERBARA = {
  producent: r => [r.producent],
  tillverkartyp: r => [r.tillverkartyp],
  produkttyp: r => [r.produkttyp],
  fortjockare: r => r.fortjockare || [],
  basolja: r => r.basolja || [],
  nlgi: r => [r.nlgi_klass],
  fasta: r => r.fasta_smorjamnen || [],
  epaw: r => [r.ep_aw_tillsatser],
  nsf: r => [r.nsf_klass_food_grade],
  pfas: r => [r.pfas_status],
  tillampning: r => r.tillampningsomrade || [],
  farg: r => [r.farg],
  status: r => [r.status],
};

function closeKolFilter() { const p = $('#fcolPanel'); if (p) p.remove(); }
document.addEventListener('click', closeKolFilter); // stäng rubrikfilter vid klick utanför

function openKolFilter(colKey, anchorEl) {
  closeKolFilter();
  const col = KATALOG_KOLUMNER.find(c => c.key === colKey);
  const getVals = KATALOG_FILTERBARA[colKey];
  const counts = new Map();
  state.katalog.forEach(r => getVals(r).forEach(v => { if (v != null && v !== '') counts.set(v, (counts.get(v) || 0) + 1); }));
  const values = [...counts.keys()].sort((a, b) => String(a).localeCompare(String(b), 'sv', { numeric: true }));
  const sel = state.katalogKolFilter[colKey] || [];
  const rect = anchorEl.getBoundingClientRect();
  const panel = document.createElement('div');
  panel.className = 'dropdown-panel'; panel.id = 'fcolPanel';
  panel.style.position = 'fixed';
  panel.style.top = (rect.bottom + 4) + 'px';
  panel.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 250)) + 'px';
  panel.innerHTML = `<div style="font:600 10px 'IBM Plex Mono';text-transform:uppercase;letter-spacing:.06em;color:#8494a2;padding:2px 4px 8px">Filtrera: ${esc(col.label)}</div>`
    + (values.length ? values.map(v => `<label class="ck" data-fv="${esc(v)}" style="padding:5px 4px"><span class="box ${sel.includes(v) ? 'on' : ''}"></span>${esc(v)} <span style="color:#8494a2;font-size:11px">(${counts.get(v)})</span></label>`).join('')
      : '<div style="color:#8494a2;font-size:12px;padding:6px 4px">Inga värden</div>')
    + `<div style="border-top:1px solid #e6ebef;margin-top:6px;padding-top:8px;display:flex;justify-content:space-between">
        <button class="btn ghost" id="fcolClear" type="button">Rensa</button>
        <button class="btn pri" id="fcolClose" type="button">Klar</button></div>`;
  document.body.appendChild(panel);
  panel.addEventListener('click', e => e.stopPropagation());
  panel.querySelectorAll('label.ck').forEach(l => l.addEventListener('click', () => {
    const v = l.dataset.fv;
    const cur = state.katalogKolFilter[colKey] ? [...state.katalogKolFilter[colKey]] : [];
    const i = cur.indexOf(v); i < 0 ? cur.push(v) : cur.splice(i, 1);
    if (cur.length) state.katalogKolFilter[colKey] = cur; else delete state.katalogKolFilter[colKey];
    l.querySelector('.box').classList.toggle('on');
    drawKatalog();
  }));
  $('#fcolClear').addEventListener('click', () => { delete state.katalogKolFilter[colKey]; closeKolFilter(); drawKatalog(); });
  $('#fcolClose').addEventListener('click', closeKolFilter);
}

async function renderKatalog(m) {
  m.innerHTML = `<div class="tbar"><div><div class="ttl">Produktkatalog</div><div class="tsub">Alla produkter i databasen</div></div>
    <div class="tsearch"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="4.5"/><line x1="10.4" y1="10.4" x2="14" y2="14"/></svg>
      <input id="kq" placeholder="Sök produkt eller tillverkare…" value="${esc(state.katalogFilter.q)}"></div></div>
    <div class="content">
      <div class="toolbar">
        <select class="selectbox" id="ktyp">
          <option value="alla">Alla tillverkare</option><option value="FUCHS">Endast eget sortiment</option><option value="Konkurrent">Endast konkurrenter</option></select>
        <button class="selectbox" id="kolBtn" type="button">⚙ Kolumner ▾</button>
        <span class="count" id="kcount"></span>
      </div>
      <div id="ktable"></div>
    </div>`;
  $('#ktyp').value = state.katalogFilter.typ;
  $('#kq').addEventListener('input', e => { state.katalogFilter.q = e.target.value; drawKatalog(); });
  $('#ktyp').addEventListener('change', e => { state.katalogFilter.typ = e.target.value; loadKatalog(); });
  $('#kolBtn').addEventListener('click', e => { e.stopPropagation(); openKolPanel(e.currentTarget); });
  drawKatalogSkeleton();
  await loadKatalog();
}

// Kolumnväljaren renderas till document.body med fast position (undviker att klippas
// av .content{overflow:auto} — samma mönster som openKolFilter för rubrikfiltren).
function closeKolPanel() { const p = $('#kolPanel'); if (p) p.remove(); }
document.addEventListener('click', closeKolPanel);

function openKolPanel(anchorEl) {
  closeKolPanel();
  katalogValdaKolumner(); // säkerställ att state.katalogKol finns
  const rect = anchorEl.getBoundingClientRect();
  const panel = document.createElement('div');
  panel.className = 'dropdown-panel'; panel.id = 'kolPanel';
  panel.style.position = 'fixed';
  panel.style.top = (rect.bottom + 4) + 'px';
  panel.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 230)) + 'px';
  panel.innerHTML = KATALOG_KOLUMNER.map(c => {
    const on = c.fast || state.katalogKol.includes(c.key);
    return `<label class="ck" data-kol="${c.key}" style="padding:5px 4px;${c.fast ? 'opacity:.55;cursor:default' : ''}">
      <span class="box ${on ? 'on' : ''}"></span>${esc(c.label)}${c.fast ? ' <span style="font-size:10px;color:#8494a2">(fast)</span>' : ''}
    </label>`;
  }).join('') + `<div style="border-top:1px solid #e6ebef;margin-top:6px;padding-top:8px;display:flex;justify-content:space-between">
      <button class="btn ghost" id="kolReset" type="button">Återställ</button>
      <button class="btn pri" id="kolClose" type="button">Klar</button></div>`;
  document.body.appendChild(panel);
  panel.addEventListener('click', e => e.stopPropagation());
  panel.querySelectorAll('label.ck').forEach(l => {
    const c = KATALOG_KOLUMNER.find(k => k.key === l.dataset.kol);
    if (c.fast) return;
    l.addEventListener('click', () => {
      const idx = state.katalogKol.indexOf(c.key);
      idx < 0 ? state.katalogKol.push(c.key) : state.katalogKol.splice(idx, 1);
      sparaKatalogKol(); openKolPanel(anchorEl); drawKatalog();
    });
  });
  $('#kolReset').addEventListener('click', () => { state.katalogKol = [...KATALOG_DEFAULT]; sparaKatalogKol(); openKolPanel(anchorEl); drawKatalog(); });
  $('#kolClose').addEventListener('click', closeKolPanel);
}
async function loadKatalog() {
  let qb = sb.from('fett').select('id,produktnamn,producent,tillverkartyp,produkttyp,fortjockare,basolja,nlgi_klass,viskositet_40c,viskositet_100c,temperaturomrade_min,temperaturomrade_max,droppunkt,fasta_smorjamnen,ep_aw_tillsatser,nsf_klass_food_grade,pfas_status,tillampningsomrade,artikelnummer,farg,status')
    .order('produktnamn').limit(1000);
  if (state.katalogFilter.typ !== 'alla') qb = qb.eq('tillverkartyp', state.katalogFilter.typ);
  const { data, error } = await qb;
  state.katalog = error ? [] : data;
  drawKatalog();
}
function drawKatalog() {
  if (!state.katalogKolFilter) state.katalogKolFilter = {};
  const q = state.katalogFilter.q.toLowerCase();
  let rows = state.katalog.filter(r => !q || (r.produktnamn + ' ' + r.producent).toLowerCase().includes(q));
  // kolumnfilter (rubrik-dropdowns) — kombineras med AND mellan kolumner
  const aktivaFilter = Object.entries(state.katalogKolFilter);
  for (const [k, vals] of aktivaFilter) {
    const getVals = KATALOG_FILTERBARA[k];
    rows = rows.filter(r => getVals(r).some(v => vals.includes(v)));
  }
  if ($('#kcount')) $('#kcount').textContent = `${rows.length} produkter`;

  const kol = katalogValdaKolumner();
  const filterrad = aktivaFilter.length
    ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        ${aktivaFilter.map(([k, vals]) => { const c = KATALOG_KOLUMNER.find(x => x.key === k); return `<span class="pill" style="background:#e3eefb;color:var(--blue)">${esc(c.label)}: ${vals.map(esc).join(', ')}</span>`; }).join('')}
        <button class="btn ghost" id="rensaFilter" type="button">Rensa alla filter</button></div>`
    : '';
  const th = c => {
    const cls = c.num ? ' class="num"' : '';
    if (!KATALOG_FILTERBARA[c.key]) return `<th${cls}>${esc(c.label)}</th>`;
    const on = state.katalogKolFilter[c.key]?.length ? ' on' : '';
    return `<th${cls}><span class="th-filter" data-fcol="${c.key}">${esc(c.label)} <span class="fnl${on}">▾</span></span></th>`;
  };
  const html = rows.length ? `${filterrad}<table class="grid"><thead><tr>
    ${kol.map(th).join('')}</tr></thead><tbody>
    ${rows.map(r => `<tr class="clickable" data-id="${r.id}">
      ${kol.map(c => { const cls = [c.mono ? 'mono' : '', c.num ? 'num' : ''].filter(Boolean).join(' '); return `<td${cls ? ` class="${cls}"` : ''}>${c.cell(r)}</td>`; }).join('')}
    </tr>`).join('')}</tbody></table>` : `${filterrad}<div class="empty">${ICO_SEARCH}Inga produkter matchar.</div>`;
  if ($('#ktable')) {
    $('#ktable').innerHTML = html;
    $('#ktable').querySelectorAll('[data-id]').forEach(tr => tr.addEventListener('click', () => openProduct(tr.dataset.id)));
    $('#ktable').querySelectorAll('.th-filter').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); openKolFilter(el.dataset.fcol, el); }));
    const rf = $('#rensaFilter'); if (rf) rf.addEventListener('click', () => { state.katalogKolFilter = {}; drawKatalog(); });
  }
}

async function openProduct(id) {
  const { data, error } = await sb.from('fett').select('*').eq('id', id).single();
  if (error) { toast('Kunde inte hämta produkten'); return; }
  const r = data;
  const specs = [
    ['Tillverkare', r.producent], ['Typ', r.tillverkartyp], ['Produkttyp', r.produkttyp],
    ['Produktfamilj', r.produktfamilj], ['NLGI-klass', r.nlgi_klass],
    ['Viskositet 40°C', r.viskositet_40c && r.viskositet_40c + ' mm²/s'],
    ['Viskositet 100°C', r.viskositet_100c && r.viskositet_100c + ' mm²/s'],
    ['Temperaturområde', tempStr(r)], ['Droppunkt', r.droppunkt && '>' + r.droppunkt + '°C'],
    ['Basolja', arr(r.basolja)], ['Förtjockare', arr(r.fortjockare)],
    ['Fasta smörjämnen', arr(r.fasta_smorjamnen)], ['EP/AW-tillsatser', r.ep_aw_tillsatser],
    ['NSF food grade', r.nsf_klass_food_grade], ['ISO 21469', r.iso_21469],
    ['PFAS-status', r.pfas_status], ['REACH', r.reach_status],
    ['Faropiktogram', arr(r.sds_piktogram)], ['H-fraser', arr(r.sds_h_fraser)],
    ['EUH-fraser', arr(r.sds_euh_fraser)], ['SDS revisionsdatum', r.sds_revisionsdatum],
    ['Tillämpning', arr(r.tillampningsomrade)], ['OEM-godkännanden', r.oem_godkannanden],
    ['Artikelnummer', r.artikelnummer], ['Status', r.status],
  ].filter(x => x[1]);
  const links = [];
  if (r.sds_url) links.push(`<a class="btn ghost" href="${esc(r.sds_url)}" target="_blank" rel="noopener">SDS ↗</a>`);
  if (r.tds_url) links.push(`<a class="btn ghost" href="${esc(r.tds_url)}" target="_blank" rel="noopener">TDS ↗</a>`);
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="drawer">
    <div class="drawer-h"><div><h2>${esc(r.produktnamn)}</h2><div class="sub">${esc(r.producent)} · ${esc(r.tillverkartyp)}</div></div>
      <button class="xbtn" id="dx">×</button></div>
    <div class="drawer-b">
      ${links.length ? `<div style="display:flex;gap:8px;margin-bottom:16px">${links.join('')}</div>` : ''}
      <dl class="spec">${specs.map(s => `<dt>${esc(s[0])}</dt><dd>${esc(s[1])}</dd>`).join('')}</dl>
      ${r.kommentarer ? `<div style="margin-top:16px"><div class="fh">Kommentar</div><div style="font:500 13px/1.6 'Barlow';color:#3a4a57">${esc(r.kommentarer)}</div></div>` : ''}
    </div></div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  $('#dx', ov).addEventListener('click', close);
}

// ---------- 4. Granskningskö ----------
async function renderGranskning(m) {
  const inbox = (CFG.INBOUND_EMAIL || '').trim();
  const inboxBox = inbox
    ? `<div class="ai-note" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
         <span>📎 Skicka eller vidarebefordra nya produktblad <b>(PDS/TDS)</b> till adressen — AI:n tolkar dem och lägger dem här för granskning:</span>
         <span class="mono" id="inboxAddr" style="background:#fff;border:1px solid #cfe1f4;border-radius:7px;padding:6px 10px;color:#00448a;font-weight:600">${esc(inbox)}</span>
         <button class="btn ghost" id="copyInbox">Kopiera</button></div>`
    : `<div class="ai-note">📎 Nya produktblad <b>(PDS/TDS)</b> mejlas in hit för AI-tolkning och granskning. <b>Adressen är inte konfigurerad än</b> — admin sätter <code>INBOUND_EMAIL</code> i config.js när Postmark inbound kopplats (se README steg 3).</div>`;
  m.innerHTML = `<div class="tbar"><div><div class="ttl">Granskningskö</div>
    <div class="tsub">Produktinfo inkommen via mail — AI-tolkad, väntar på godkännande</div></div></div>
    <div class="content"><div>${inboxBox}</div>
      <div id="gcontent"><div class="empty"><span class="spinner"></span> Laddar…</div></div></div>`;
  if (inbox) $('#copyInbox')?.addEventListener('click', () => {
    navigator.clipboard.writeText(inbox).then(() => toast('Adress kopierad'), () => toast(inbox));
  });
  const { data, error } = await sb.from('inkommande_mail').select('*').order('created_at', { ascending: false }).limit(100);
  state.mail = error ? [] : data;
  const c = $('#gcontent');
  if (!state.mail.length) { c.innerHTML = `<div class="empty">${ICO_INBOX}Inget i kön just nu. Mail som skickas till inkorgen dyker upp här för granskning.</div>`; return; }
  const statusPill = s => ({ 'Ny': 'new', 'Importerad': 'ok', 'Avvisad': 'rej', 'Granskad': 'warn' }[s] || 'konk');
  c.innerHTML = `<table class="grid"><thead><tr><th>Ämne</th><th>Från</th><th>Föreslagen produkt</th><th>Inkom</th><th>Status</th></tr></thead><tbody>
    ${state.mail.map(r => `<tr class="clickable" data-mid="${r.id}">
      <td style="font-weight:600;color:#17242f">${esc(r.amne || '(inget ämne)')}</td>
      <td>${esc(r.fran_epost || '—')}</td>
      <td>${esc(r.tolkade_falt?.produktnamn || '—')}</td>
      <td class="mono" style="color:#8494a2">${new Date(r.created_at).toLocaleDateString('sv-SE')}</td>
      <td><span class="pill ${statusPill(r.status)}">${esc(r.status)}</span></td>
    </tr>`).join('')}</tbody></table>`;
  c.querySelectorAll('[data-mid]').forEach(tr => tr.addEventListener('click', () => openMail(tr.dataset.mid)));
}

function openMail(id) {
  const r = state.mail.find(x => String(x.id) === String(id)); if (!r) return;
  const tf = r.tolkade_falt || {};
  const fields = Object.entries(tf).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(Array.isArray(v) ? v.join(', ') : v)}</dd>`).join('');
  const canAct = isEditor() && r.status !== 'Importerad';
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="drawer">
    <div class="drawer-h"><div><h2>${esc(tf.produktnamn || r.amne || 'Inkommet mail')}</h2>
      <div class="sub">${esc(r.fran_epost || '')} · ${esc(r.status)}</div></div><button class="xbtn" id="dx">×</button></div>
    <div class="drawer-b">
      ${!isEditor() ? '<div class="ai-note">Endast redaktörer kan godkänna eller avvisa.</div>' : ''}
      <div class="fh">AI-tolkade fält</div>
      <dl class="spec">${fields || '<dt>—</dt><dd>Inga fält tolkade</dd>'}</dl>
      ${r.anteckning ? `<div style="margin-top:14px"><div class="fh">AI-anteckning</div><div style="font:500 13px/1.6 'Barlow';color:#3a4a57">${esc(r.anteckning)}</div></div>` : ''}
      <details style="margin-top:16px"><summary style="cursor:pointer;font:600 11px 'IBM Plex Mono';color:#8494a2">Visa rå mailtext</summary>
        <pre style="white-space:pre-wrap;font:400 12px 'IBM Plex Mono';color:#4a5c6a;background:#fff;padding:12px;border-radius:8px;margin-top:8px">${esc((r['rå_text'] || '').slice(0, 3000))}</pre></details>
      ${canAct ? `<div style="display:flex;gap:10px;margin-top:20px">
        <button class="btn ok" id="approve" style="flex:1">✓ Godkänn & importera</button>
        <button class="btn danger" id="reject" style="flex:1">Avvisa</button></div>` : ''}
    </div></div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  $('#dx', ov).addEventListener('click', close);
  if (canAct) {
    $('#approve', ov).addEventListener('click', async (e) => {
      e.target.disabled = true; e.target.innerHTML = '<span class="spinner"></span> Importerar…';
      try {
        const res = await fetch(`${FN_URL}/fett-import`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.session.access_token}` },
          body: JSON.stringify({ mail_id: r.id }),
        });
        const d = await res.json(); if (!res.ok) throw new Error(d.error || 'Import misslyckades');
        toast('Produkten importerad till databasen'); close(); renderGranskning($('#main'));
      } catch (err) { toast('Fel: ' + err.message); e.target.disabled = false; e.target.textContent = '✓ Godkänn & importera'; }
    });
    $('#reject', ov).addEventListener('click', async () => {
      await sb.from('inkommande_mail').update({ status: 'Avvisad', granskad_av: state.me.epost }).eq('id', r.id);
      toast('Mailet avvisat'); close(); renderGranskning($('#main'));
    });
  }
}

// ---------- 5. Användare (admin) ----------
async function renderAnvandare(m) {
  m.innerHTML = `<div class="tbar"><div><div class="ttl">Användare</div><div class="tsub">Behörighetslista — endast dessa kan logga in</div></div>
    <button class="tgo" id="adduser">+ Lägg till</button></div>
    <div class="content" id="ucontent"><div class="empty"><span class="spinner"></span> Laddar…</div></div>`;
  $('#adduser').addEventListener('click', () => userModal());
  const { data, error } = await sb.from('app_anvandare').select('*').order('created_at');
  state.users = error ? [] : data;
  $('#ucontent').innerHTML = `<table class="grid"><thead><tr><th>Namn</th><th>E-post</th><th>Roll</th><th>Status</th><th></th></tr></thead><tbody>
    ${state.users.map(u => `<tr>
      <td style="font-weight:600;color:#17242f">${esc(u.namn || '—')}</td>
      <td class="mono">${esc(u.epost)}</td>
      <td><span class="pill ${u.roll === 'admin' ? 'fuchs' : 'konk'}">${esc(u.roll)}</span></td>
      <td>${u.aktiv ? '<span class="pill ok">Aktiv</span>' : '<span class="pill rej">Inaktiv</span>'}</td>
      <td style="text-align:right"><button class="btn ghost" data-edit="${u.id}">Ändra</button></td>
    </tr>`).join('')}</tbody></table>`;
  $('#ucontent').querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => userModal(state.users.find(u => u.id === b.dataset.edit))));
}

function userModal(u) {
  const editing = !!u;
  const ov = document.createElement('div'); ov.className = 'modal';
  ov.innerHTML = `<div class="modal-card">
    <div class="modal-h">${editing ? 'Ändra användare' : 'Lägg till användare'}</div>
    <div class="modal-b">
      <div><label>Namn</label><input id="u_namn" value="${esc(u?.namn || '')}" placeholder="Förnamn Efternamn"></div>
      <div><label>E-post</label><input id="u_epost" type="email" value="${esc(u?.epost || '')}" ${editing ? 'disabled' : ''} placeholder="namn@fuchs.com"></div>
      <div><label>Roll</label><select id="u_roll">
        <option value="lasare">Läsare (endast sök & jämför)</option>
        <option value="redaktor">Redaktör (får godkänna mail)</option>
        <option value="admin">Admin (får hantera användare)</option></select></div>
      ${editing ? `<div><label>Status</label><select id="u_aktiv"><option value="true">Aktiv</option><option value="false">Inaktiv</option></select></div>` : ''}
    </div>
    <div class="modal-f"><button class="btn ghost" id="mcancel">Avbryt</button><button class="btn pri" id="msave">Spara</button></div>
  </div>`;
  document.body.appendChild(ov);
  $('#u_roll', ov).value = u?.roll || 'lasare';
  if (editing) $('#u_aktiv', ov).value = String(u.aktiv);
  const close = () => ov.remove();
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  $('#mcancel', ov).addEventListener('click', close);
  $('#msave', ov).addEventListener('click', async () => {
    const payload = { namn: $('#u_namn', ov).value.trim(), roll: $('#u_roll', ov).value };
    let error;
    if (editing) {
      payload.aktiv = $('#u_aktiv', ov).value === 'true';
      ({ error } = await sb.from('app_anvandare').update(payload).eq('id', u.id));
    } else {
      payload.epost = $('#u_epost', ov).value.trim().toLowerCase();
      if (!payload.epost) { toast('E-post krävs'); return; }
      ({ error } = await sb.from('app_anvandare').insert(payload));
    }
    if (error) { toast('Fel: ' + error.message); return; }
    toast('Sparat'); close(); renderAnvandare($('#main'));
  });
}

boot();
