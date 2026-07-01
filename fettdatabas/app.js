// Fettdatabas — FUCHS smörjfett-jämförelse
// Frontend-SPA. Auth via magic link, data via Supabase RLS, AI-matchning via edge function fett-sok.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  searchResult: null, // { competitor, results, note }
  // jämförelse
  compare: null,      // { competitor, fuchs }
  // katalog
  katalog: [], katalogFilter: { typ: 'alla', q: '' },
  // granskning
  mail: [],
  // admin
  users: [],
};

// ---------- filter-definitioner (label -> matchvärden i DB) ----------
const F = {
  basolja: [
    ['Mineral', ['Mineralisk Grupp I', 'Mineralisk Grupp II', 'Mineralisk']],
    ['PAO (syntet)', ['PAO']], ['Ester', ['Ester']], ['Polyglykol (PAG)', ['Polyglykol']],
    ['White oil', ['White oil']], ['Silikon', ['Silikon']], ['PFPE', ['PFPE']],
  ],
  fortjockare: [
    ['Litium', ['Litium']], ['Litiumkomplex', ['Litiumkomplex']], ['Kalcium', ['Kalcium']],
    ['Kalciumkomplex', ['Kalciumkomplex']], ['Kalciumsulfonat', ['Kalciumsulfonat']],
    ['Aluminiumkomplex', ['Aluminiumkomplex']], ['Polyurea', ['Polyurea']],
    ['Natriumkomplex', ['Natriumkomplex']], ['Bentonit', ['Bentonit']], ['PTFE', ['PTFE']],
  ],
  fasta: [
    ['Vita fasta', ['Vita fasta smörjämnen']], ['PTFE', ['PTFE']], ['MoS₂', ['MoS2']],
    ['Grafit', ['Grafit']], ['BN (bornitrid)', ['BN (bornitrid)', 'BN']],
  ],
  nlgi: ['000', '00', '0', '1', '1.5', '2', '2.5', '3'],
  nsf: ['H1', 'H2', 'H3'],
  tillampning: ['Rullager', 'Glidlager', 'Kullager', 'Spindellager', 'Kugghjul', 'Skruvförband',
    'Högtryck EP', 'Hög temperatur', 'Låg temperatur', 'Vattenexponering'],
};

const NAV = [
  ['sok', 'Sök & översätt'], ['katalog', 'Produktkatalog'],
  ['granskning', 'Granskningskö'], ['anvandare', 'Användare'],
];

// ---------- utils ----------
const $ = (s, r = document) => r.querySelector(s);
const app = () => $('#app');
const esc = (v) => v == null ? '' : String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const arr = (a) => Array.isArray(a) ? a.filter(Boolean).join(', ') : (a || '');
const tempStr = (r) => (r.temperaturomrade_min != null || r.temperaturomrade_max != null)
  ? `${r.temperaturomrade_min ?? '?'}…${r.temperaturomrade_max ?? '?'}°C` : '—';
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
const isEditor = () => state.me && ['admin', 'redaktor'].includes(state.me.roll);
const isAdmin = () => state.me && state.me.roll === 'admin';

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
  if (error) { console.warn('loadMe', error.message); }
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
    <div class="login-brand"><div class="login-logo">F</div>
      <div><h1>Fettdatabas</h1><p>Teknik</p></div></div>
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
      $('#loginMsg').className = 'login-msg ok';
      $('#loginMsg').textContent = `Länk skickad till ${email}. Öppna mailet på den här enheten för att logga in.`;
      btn.textContent = 'Länk skickad ✓';
    }
  });
}

function renderNoAccess() {
  app().innerHTML = `
  <div class="login"><div class="login-card">
    <div class="login-brand"><div class="login-logo">F</div><div><h1>Fettdatabas</h1><p>Teknik</p></div></div>
    <div class="login-msg err" style="margin-top:20px">Kontot <b>${esc(state.session.user.email)}</b> finns inte på behörighetslistan.
      Be Mats lägga till dig innan du kan använda databasen.</div>
    <button class="login-btn" id="lo" style="margin-top:16px">Logga ut</button>
  </div></div>`;
  $('#lo').addEventListener('click', () => sb.auth.signOut());
}

// ---------- shell ----------
function renderShell() {
  const nav = NAV.filter(([id]) => id !== 'anvandare' || isAdmin())
    .map(([id, label]) => `<a data-nav="${id}" class="${state.view === id ? 'on' : ''}">
      <svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2.5"/></svg>${label}</a>`).join('');
  app().innerHTML = `
  <div class="page"><div class="shell">
    <div class="side">
      <div class="sbrand"><div class="slogo">F</div><div><div class="sbn">Fettdatabas</div><div class="sbs">FUCHS · Teknik</div></div></div>
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

function renderMain() {
  const m = $('#main');
  if (state.view === 'sok') return renderSok(m);
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
      <div><div class="ttl">Sök & översätt</div><div class="tsub">Hitta FUCHS-motsvarighet till en konkurrentprodukt</div></div>
      <div class="tsearch"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="4.5"/><line x1="10.4" y1="10.4" x2="14" y2="14"/></svg>
        <input id="q" placeholder="t.ex. Klüber Isoflex NBU 15" value="${esc(state.query)}"></div>
      <button class="tgo" id="go">Översätt</button>
    </div>
    <div class="body2">
      <div class="filt">
        <div class="fg"><div class="fh">Basolja</div>${ckRow('basolja', F.basolja, f.basolja)}</div>
        <div class="fg"><div class="fh">Förtjockare</div><div class="chips">${chipRow('fortjockare', F.fortjockare, f.fortjockare)}</div></div>
        <div class="fg"><div class="fh">Fasta smörjämnen</div>
          <div class="ck" data-filter="ptfeFri" data-val="__toggle"><span class="box ${f.ptfeFri ? 'on' : ''}"></span>Endast PTFE-fri</div>
          ${ckRow('fasta', F.fasta, f.fasta)}</div>
        <div class="fg"><div class="fh">NLGI-klass</div><div class="chips">${chipRow('nlgi', F.nlgi, f.nlgi)}</div></div>
        <div class="fg"><div class="fh">Tillämpning</div><div class="chips">${chipRow('tillampning', F.tillampning, f.tillampning)}</div></div>
        <div class="fg"><div class="fh">NSF-klass</div><div class="chips">${chipRow('nsf', F.nsf, f.nsf)}</div></div>
      </div>
      <div class="res" id="res">${renderSokResult()}</div>
    </div>`;

  $('#q').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  $('#go').addEventListener('click', doSearch);
  m.querySelectorAll('[data-filter]').forEach(el => el.addEventListener('click', () => {
    const k = el.dataset.filter, v = el.dataset.val;
    if (k === 'ptfeFri') state.filters.ptfeFri = !state.filters.ptfeFri;
    else { const a = state.filters[k]; const i = a.indexOf(v); i < 0 ? a.push(v) : a.splice(i, 1); }
    renderSok(m);
  }));
}

function renderSokResult() {
  if (state.searching) return `<div class="empty"><span class="spinner"></span> AI analyserar och rankar FUCHS-produkter…</div>`;
  const r = state.searchResult;
  if (!r) return `<div class="empty">Skriv in en konkurrentprodukt och tryck <b>Översätt</b>.<br>AI:n förstår även ofullständiga eller felstavade namn.</div>`;
  if (!r.results || !r.results.length) return `<div class="empty">Inga FUCHS-produkter matchade. Prova att lätta på filtren.</div>`;
  const comp = r.competitor;
  const note = r.note ? `<div class="ai-note"><span class="ai-chip">AI</span>${comp?.matched ? `Tolkade sökningen som <b>${esc(comp.produktnamn)}</b>${comp.producent ? ` (${esc(comp.producent)})` : ''}. ` : ''}${esc(r.note)}</div>` : '';
  const rows = r.results.map((x, i) => {
    const best = i === 0 ? 'best' : '';
    const col = i === 0 ? '' : `style="color:#5a9bd4"`, bar = i === 0 ? '' : `background:#5a9bd4`;
    const tag = i === 0 ? '<span class="topmatch">Bästa träff</span>' : '';
    const nsf = (x.nsf_klass_food_grade && x.nsf_klass_food_grade !== 'Ej livsmedelsgodkänd')
      ? `<span class="nsf">${esc(x.nsf_klass_food_grade)}</span>` : `<div class="cell dim">—</div>`;
    return `<div class="tr ${best}" data-jmp="${x.id}">
      <div class="tsim"><span class="tsn" ${col}>${x.likhet}%</span><div class="tbrz"><i style="width:${x.likhet}%;${bar}"></i></div></div>
      <div><div class="tpn">${esc(x.produktnamn)} ${tag}</div><div class="tps">${esc(x.producent)}${x.motivering ? ' · ' + esc(x.motivering) : ''}</div></div>
      <div class="cell">${esc(x.nlgi_klass ?? '—')}</div>
      <div class="cell">${tempStr(x)}</div>
      <div class="cell">${esc(arr(x.basolja) || '—')}</div>
      <div class="cell">${esc(arr(x.fortjockare) || '—')}</div>
      ${nsf}
      <div class="jmp"><span class="arr">›</span> Jämför</div>
    </div>`;
  }).join('');
  const fuchsCount = r.candidateCount ?? '';
  return `${note}
    <div class="resh"><span class="t">${r.results.length} träffar${fuchsCount ? ` · <span>av ${fuchsCount} FUCHS</span>` : ''}</span><span class="s">Sortering: likhet ↓</span></div>
    <div class="thd"><span>Likhet</span><span>FUCHS-produkt</span><span>NLGI</span><span>Temp.område</span><span>Basolja</span><span>Förtjockare</span><span>NSF</span><span></span></div>
    ${rows}`;
}

async function doSearch() {
  const q = ($('#q')?.value || '').trim();
  if (!q) { toast('Skriv in en produkt att översätta'); return; }
  state.query = q; state.searching = true; state.searchResult = null;
  $('#res').innerHTML = renderSokResult();
  try {
    const res = await fetch(`${FN_URL}/fett-sok`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.session.access_token}` },
      body: JSON.stringify({ query: q, filters: state.filters }),
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
  if (cv == null || cv === '' || cv === '—') return '<span class="dl u">FUCHS+</span>';
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
      <div class="cgh"><div>Egenskap</div><div class="comp">Konkurrent${comp && !comp.matched ? ' (AI-tolkad)' : ''}</div><div class="fu">FUCHS · ${esc(fu.produktnamn)}</div><div class="dl">Δ</div></div>
      ${rows}
    </div>`;
  $('#back').addEventListener('click', () => { state.view = 'sok'; renderShell(); });
}

// ---------- 3. Produktkatalog ----------
async function renderKatalog(m) {
  m.innerHTML = `<div class="tbar"><div><div class="ttl">Produktkatalog</div><div class="tsub">Alla produkter i databasen</div></div>
    <div class="tsearch"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="4.5"/><line x1="10.4" y1="10.4" x2="14" y2="14"/></svg>
      <input id="kq" placeholder="Sök produkt eller tillverkare…" value="${esc(state.katalogFilter.q)}"></div></div>
    <div class="content">
      <div class="toolbar">
        <select class="selectbox" id="ktyp">
          <option value="alla">Alla tillverkare</option><option value="FUCHS">Endast FUCHS</option><option value="Konkurrent">Endast konkurrenter</option></select>
        <span class="count" id="kcount"></span>
      </div>
      <div id="ktable"><div class="empty"><span class="spinner"></span> Laddar…</div></div>
    </div>`;
  $('#ktyp').value = state.katalogFilter.typ;
  $('#kq').addEventListener('input', e => { state.katalogFilter.q = e.target.value; drawKatalog(); });
  $('#ktyp').addEventListener('change', e => { state.katalogFilter.typ = e.target.value; loadKatalog(); });
  await loadKatalog();
}
async function loadKatalog() {
  let qb = sb.from('fett').select('id,produktnamn,producent,tillverkartyp,nlgi_klass,temperaturomrade_min,temperaturomrade_max,nsf_klass_food_grade,basolja,fortjockare')
    .order('produktnamn').limit(1000);
  if (state.katalogFilter.typ !== 'alla') qb = qb.eq('tillverkartyp', state.katalogFilter.typ);
  const { data, error } = await qb;
  state.katalog = error ? [] : data;
  drawKatalog();
}
function drawKatalog() {
  const q = state.katalogFilter.q.toLowerCase();
  const rows = state.katalog.filter(r => !q || (r.produktnamn + ' ' + r.producent).toLowerCase().includes(q));
  if ($('#kcount')) $('#kcount').textContent = `${rows.length} produkter`;
  const html = rows.length ? `<table class="grid"><thead><tr>
    <th>Produkt</th><th>Tillverkare</th><th>Typ</th><th>NLGI</th><th>Temp.område</th><th>NSF</th></tr></thead><tbody>
    ${rows.map(r => `<tr class="clickable" data-id="${r.id}">
      <td style="font-weight:600;color:#17242f">${esc(r.produktnamn)}</td>
      <td>${esc(r.producent)}</td>
      <td><span class="pill ${r.tillverkartyp === 'FUCHS' ? 'fuchs' : 'konk'}">${esc(r.tillverkartyp)}</span></td>
      <td class="mono">${esc(r.nlgi_klass ?? '—')}</td>
      <td class="mono">${tempStr(r)}</td>
      <td>${r.nsf_klass_food_grade && r.nsf_klass_food_grade !== 'Ej livsmedelsgodkänd' ? `<span class="pill h1">${esc(r.nsf_klass_food_grade)}</span>` : '<span style="color:#98a5b1">—</span>'}</td>
    </tr>`).join('')}</tbody></table>` : `<div class="empty">Inga produkter matchar.</div>`;
  if ($('#ktable')) {
    $('#ktable').innerHTML = html;
    $('#ktable').querySelectorAll('[data-id]').forEach(tr => tr.addEventListener('click', () => openProduct(tr.dataset.id)));
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
  m.innerHTML = `<div class="tbar"><div><div class="ttl">Granskningskö</div>
    <div class="tsub">Produktinfo inkommen via mail — AI-tolkad, väntar på godkännande</div></div></div>
    <div class="content" id="gcontent"><div class="empty"><span class="spinner"></span> Laddar…</div></div>`;
  const { data, error } = await sb.from('inkommande_mail').select('*').order('created_at', { ascending: false }).limit(100);
  state.mail = error ? [] : data;
  const c = $('#gcontent');
  if (!state.mail.length) { c.innerHTML = `<div class="empty">Inget i kön just nu. Mail som skickas till inkorgen dyker upp här för granskning.</div>`; return; }
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
