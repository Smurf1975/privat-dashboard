// Välj fett — lagerbaserad fettväljare (UI-modul)
// Konsumerar beräkningsmodulen valj-fett-calc.js (Agent 1) och edge-funktionen fett-rekommendation (Agent 3).
// Exponerar renderValjFett(m, ctx) där ctx = { sb, FN_URL, session, toast, esc, openProduct }.
import { beraknaValjFett, visk40TillVid, estimeraV100, ISO_VG, LAGERTYPER } from './valj-fett-calc.js';
import { kollaByte, fortNyckelFranDb, basNyckelFranDb, FORTJOCKARE, BASOLJA, KOMP_KALLA, KOMP_SYNKAD } from './fett-kompatibilitet.js';

// ---------- utils (lokal esc-kopia, samma mönster som app.js) ----------
const esc = (v) => v == null ? '' : String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (x, d = 1) => (x == null || !isFinite(Number(x))) ? '—'
  : Number(x).toLocaleString('sv-SE', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const num = (v) => {
  const s = String(v ?? '').trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
};
function tidStr(h) {
  if (h == null || !isFinite(h) || h <= 0) return '';
  const man = h / 730.5; // h per månad vid 24/7
  if (man >= 1) return `≈ ${fmt(man, man < 10 ? 1 : 0)} månader vid 24/7-drift`;
  const dygn = h / 24;
  return `≈ ${fmt(dygn, dygn < 10 ? 1 : 0)} dygn vid 24/7-drift`;
}

// ---------- module-level state (formulärvärden ligger kvar mellan vy-byten) ----------
const S = {
  lagertyp: 'spårkullager',
  d: '', D: '', B: '', massaKg: '',
  rorelse: 'roterande', varvtal: '', oscAmplitud: '', oscFrekvens: '',
  drifttemp: '70', omgivningstemp: '20',
  belastning: 'medel', omgivning: ['ren'], orientering: 'horisontell',
  vibration: 'lag', ytterringsrotation: false, eftersmorjningsmetod: 'sida',
  lage: 'foresla',                 // 'foresla' | 'kontrollera'
  visk40: '', visk100: '', basolja: 'mineral',
  resultat: null, resultatFel: null, sisteInput: null,
  rek: null, rekFel: null, rekLaddar: false,
  // fettbyte-kompatibilitet
  kGammalFort: '', kGammalBas: '', kNyFort: '', kNyBas: '', kResultat: null, kFel: null, kOppen: false,
  // nuvarande fett i lagret (valfritt) — driver kompatibilitetsbadge på produktförslag
  nuvarandeFort: '', nuvarandeBas: '',
};
let CTX = null;

// ---------- definitioner ----------
const LAGER_ORDNING = ['spårkullager', 'vinkelkontaktkullager', 'sjalvinstallande_kullager',
  'cylindriskt_rullager', 'sfariskt_rullager', 'koniskt_rullager', 'nalrullager', 'carb',
  'axialkullager', 'sfariskt_axialrullager'];
const LAGER_NAMN = {
  'spårkullager': 'Spårkullager', vinkelkontaktkullager: 'Vinkelkontaktkullager',
  sjalvinstallande_kullager: 'Självinställande kullager', cylindriskt_rullager: 'Cylindriskt rullager',
  sfariskt_rullager: 'Sfäriskt rullager', koniskt_rullager: 'Koniskt rullager',
  nalrullager: 'Nålrullager', carb: 'CARB (toroid)', axialkullager: 'Axialkullager',
  sfariskt_axialrullager: 'Sfäriskt axialrullager',
};
const lagerNamn = (k) => (LAGERTYPER[k] && LAGERTYPER[k].namn) || LAGER_NAMN[k] || k;

const BELASTNING = [['latt', 'Lätt (C/P ≥ 15)'], ['medel', 'Medel (C/P ≈ 10)'],
  ['tung', 'Tung (C/P ≈ 5)'], ['mycket_tung', 'Mycket tung (C/P < 4)']];
const OMGIVNING = [['ren', 'Ren och torr'], ['dammig', 'Dammig'], ['fuktig', 'Fuktig'],
  ['vattentvatt', 'Vattentvätt / spolning'], ['livsmedel', 'Livsmedel (NSF H1)'], ['kemisk', 'Kemisk exponering']];
const ORIENTERING = [['horisontell', 'Horisontell axel'], ['vertikal', 'Vertikal axel']];
const VIBRATION = [['lag', 'Låg'], ['medel', 'Medel'], ['hog', 'Hög']];
const METOD = [['sida', 'Från sidan'], ['centrumhal', 'Genom centrumhål (W33)']];
const BASOLJOR = [['mineral', 'Mineralolja', 95], ['pao', 'PAO (syntet)', 145], ['ester', 'Ester', 140],
  ['polyglykol', 'Polyglykol (PAG)', 210], ['silikon', 'Silikon', 250], ['pfpe', 'PFPE', 130],
  ['whiteoil', 'White oil', 95]];
const BASOLJA_VI = Object.fromEntries(BASOLJOR.map(b => [b[0], b[2]]));
const REGIM = { lagvarv: 'Lågvarv', normal: 'Normalvarv', hogvarv: 'Högvarv' };

// ---------- handritade genomskärnings-SVG:er (SKF-manér) ----------
// Färger: ytterring/innerring i grått, rullkroppar i FUCHS-blå, streckad axellinje.
const K = { ytter: '#8b9bab', inner: '#5a6b7a', rull: '#005CA9', lj: '#2f8fd8', axel: '#9db0c0', axelHint: '#d7dee5' };

function svgLager(typ) {
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" aria-hidden="true">`;
  const axelH = `<line x1="6" y1="73" x2="74" y2="73" stroke="${K.axel}" stroke-width="1.4" stroke-dasharray="5 3"/>`;
  const axelV = `<line x1="9" y1="6" x2="9" y2="74" stroke="${K.axel}" stroke-width="1.4" stroke-dasharray="5 3"/>`;
  const skaft = `<rect x="12" y="59" width="56" height="7" rx="1.5" fill="${K.axelHint}"/>`;
  const ytter = `<rect x="12" y="8" width="56" height="11" rx="2" fill="${K.ytter}"/>`;
  const inre = `<rect x="12" y="45" width="56" height="11" rx="2" fill="${K.inner}"/>`;
  // krökt ytterring (sfärisk löpbana) för självinställande/sfäriska/CARB
  const ytterKrokt = `<path d="M12 8 h56 v11 q-28 -12 -56 0 z" fill="${K.ytter}"/>`;
  const kula = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${K.rull}"/>` +
    `<circle cx="${cx - r * 0.34}" cy="${cy - r * 0.34}" r="${r * 0.3}" fill="${K.lj}" opacity=".75"/>`;
  const axlar = { ax1: `<rect x="12" y="19" width="17" height="4" rx="1.5" fill="${K.ytter}"/><rect x="51" y="19" width="17" height="4" rx="1.5" fill="${K.ytter}"/>`,
                  ax2: `<rect x="12" y="41" width="17" height="4" rx="1.5" fill="${K.inner}"/><rect x="51" y="41" width="17" height="4" rx="1.5" fill="${K.inner}"/>` };
  let inner_ = '';
  switch (typ) {
    case 'spårkullager':
      inner_ = axelH + skaft + ytter + inre + axlar.ax1 + axlar.ax2 + kula(40, 32, 10);
      break;
    case 'vinkelkontaktkullager':
      inner_ = axelH + skaft + ytter + inre +
        `<rect x="12" y="19" width="17" height="4" rx="1.5" fill="${K.ytter}"/>` +
        `<rect x="51" y="41" width="17" height="4" rx="1.5" fill="${K.inner}"/>` +
        `<line x1="24" y1="48" x2="56" y2="16" stroke="#c2cdd8" stroke-width="1.4" stroke-dasharray="3 2"/>` +
        kula(40, 32, 10);
      break;
    case 'sjalvinstallande_kullager':
      inner_ = axelH + skaft + ytterKrokt + inre +
        `<rect x="34" y="40" width="12" height="5" rx="1.5" fill="${K.inner}"/>` +
        kula(28, 33, 7) + kula(52, 33, 7);
      break;
    case 'cylindriskt_rullager':
      inner_ = axelH + skaft + ytter + inre +
        `<rect x="12" y="37" width="7" height="8" rx="1.5" fill="${K.inner}"/>` +
        `<rect x="61" y="37" width="7" height="8" rx="1.5" fill="${K.inner}"/>` +
        `<rect x="31" y="21" width="18" height="23" rx="2.5" fill="${K.rull}"/>` +
        `<rect x="34.5" y="24" width="3.5" height="17" rx="1.5" fill="${K.lj}" opacity=".7"/>`;
      break;
    case 'sfariskt_rullager':
      inner_ = axelH + skaft + ytterKrokt + inre +
        `<rect x="35" y="40" width="10" height="5" rx="1.5" fill="${K.inner}"/>` +
        `<rect x="20" y="20" width="16" height="24" rx="8" fill="${K.rull}" transform="rotate(-15 28 32)"/>` +
        `<rect x="44" y="20" width="16" height="24" rx="8" fill="${K.rull}" transform="rotate(15 52 32)"/>`;
      break;
    case 'koniskt_rullager':
      inner_ = axelH +
        `<polygon points="12,8 68,8 68,15 12,24" fill="${K.ytter}"/>` +
        `<polygon points="12,47 68,36 68,48 12,59" fill="${K.inner}"/>` +
        `<rect x="12" y="38" width="7" height="10" rx="1.5" fill="${K.inner}"/>` +
        `<polygon points="23,28 57,18 59,32 26,44" fill="${K.rull}"/>`;
      break;
    case 'nalrullager':
      inner_ = axelH + skaft +
        `<rect x="12" y="12" width="56" height="7" rx="2" fill="${K.ytter}"/>` +
        `<rect x="12" y="50" width="56" height="6" rx="2" fill="${K.inner}"/>` +
        [21, 29.5, 38, 46.5, 55].map(x => `<rect x="${x}" y="22" width="4" height="25" rx="2" fill="${K.rull}"/>`).join('');
      break;
    case 'carb':
      inner_ = axelH + skaft + ytterKrokt +
        `<path d="M12 45 q28 -8 56 0 v10 q-28 4 -56 0 z" fill="${K.inner}"/>` +
        `<rect x="21" y="23" width="38" height="18" rx="9" fill="${K.rull}"/>` +
        `<rect x="27" y="27" width="10" height="4" rx="2" fill="${K.lj}" opacity=".7"/>`;
      break;
    case 'axialkullager':
      inner_ = axelV +
        `<rect x="20" y="15" width="48" height="10" rx="2" fill="${K.ytter}"/>` +
        `<rect x="20" y="45" width="48" height="10" rx="2" fill="${K.inner}"/>` +
        `<rect x="20" y="25" width="13" height="4" rx="1.5" fill="${K.ytter}"/><rect x="55" y="25" width="13" height="4" rx="1.5" fill="${K.ytter}"/>` +
        `<rect x="20" y="41" width="13" height="4" rx="1.5" fill="${K.inner}"/><rect x="55" y="41" width="13" height="4" rx="1.5" fill="${K.inner}"/>` +
        kula(44, 35, 10);
      break;
    case 'sfariskt_axialrullager':
      inner_ = axelV +
        `<polygon points="20,10 68,22 68,32 20,20" fill="${K.ytter}"/>` +
        `<polygon points="20,46 68,42 68,53 20,57" fill="${K.inner}"/>` +
        `<rect x="34" y="22" width="15" height="26" rx="7.5" fill="${K.rull}" transform="rotate(-42 41.5 35)"/>`;
      break;
    default:
      inner_ = axelH + ytter + inre + kula(40, 32, 10);
  }
  return open + inner_ + `</svg>`;
}

// ---------- huvudentry ----------
export function renderValjFett(m, ctx) {
  CTX = ctx;
  m.innerHTML = `
    <div class="tbar">
      <div><div class="ttl">Välj fett</div>
      <div class="tsub">Lagerbaserad fettväljare — kappavärde, fyllnadsmängd &amp; eftersmörjning</div></div>
    </div>
    <div class="vf-body">
      <div class="vf-form" id="vfForm">${formHtml()}</div>
      <div class="vf-res" id="vfRes">${resultHtml()}</div>
    </div>
    <div id="vfKomp">${kompHtml()}</div>`;
  bindForm(m);
  bindRes(m);
  bindKomp(m);
}

// ---------- förklaringar (visas som tooltip vid hover/fokus på rubriken) ----------
const TIPS = {
  d: 'Lagrets innerdiameter (borrning) i mm — det mått som sitter på axeln. T.ex. 6210 → 50 mm.',
  D: 'Lagrets ytterdiameter i mm. T.ex. 6210 → 90 mm.',
  B: 'Lagrets bredd i mm. För koniska rullager: använd måttet T. För axiallager: höjden H.',
  massaKg: 'Lagrets vikt i kg (från katalog eller förpackning). Ger exakt fyllnadsmängd i stället för en uppskattning.',
  varvtal: 'Driftvarvtal i varv/min. Vid variabelt varvtal: räkna på det mest kritiska fallet (lägst varv + högst last, och högsta varvet var för sig).',
  rorelse: 'Kontinuerlig rotation eller oscillerande/pendlande rörelse (t.ex. länkarmar, styrleder, svängkransar, ventilmanöverdon). Oscillation är den svåraste smörjsituationen — filmen kollapsar vid varje vändpunkt.',
  oscAmplitud: 'Vinkelutslag åt ena hållet, i grader (±β). T.ex. en arm som pendlar 30° totalt har β = 15°. Små utslag (< 3°) ger extrem risk för falsk brinelling.',
  oscFrekvens: 'Antal hela svängningscykler per minut (fram och tillbaka = 1 cykel).',
  drifttemp: 'Lagrets verkliga temperatur i drift — inte omgivningens. Styr både viskositeten och smörjintervallet. Mät om det går.',
  omgivningstemp: 'Lägsta temperatur vid start/omgivning. Avgör om fettet blir för styvt vid kallstart.',
  belastning: 'Grovt lastförhållande C/P: lätt ≈ C/P ≥ 15, medel ≈ 10, tung ≈ 5, mycket tung < 4. Påverkar smörjintervallet kraftigt.',
  omgivning: 'Välj alla miljöfaktorer som gäller — ett lager kan vara både dammigt och fuktigt. Den svåraste miljön styr smörjintervallet.',
  orientering: 'Horisontell eller vertikal axel. Vertikal axel halverar smörjintervallet eftersom fettet rinner undan från lagret.',
  vibration: 'Vibrations- och stötnivå. Hög vibration kortar smörjintervallet och kräver ett mekaniskt stabilt fett.',
  eftersmorjningsmetod: 'Från sidan = fettet pressas in vid lagrets sida och måste vandra genom det. W33 = smörjspår/hål i ytterringen som når löpbanan direkt (mindre mängd behövs, samma intervall).',
  visk40: 'Basoljans viskositet vid 40 °C (mm²/s). Står på nästan alla fettdatablad som "grundolja/base oil".',
  visk100: 'Basoljans viskositet vid 100 °C. Valfri bonus — lämna tom om den saknas, då uppskattas den ur basoljetypen.',
  basolja: 'Typ av basolja. Ger ett antaget viskositetsindex (VI) som används för att uppskatta hur oljan tunnas ut med temperaturen.',
  ytterringsrotation: 'Kryssa i om ytterringen roterar (t.ex. hjulnav) i stället för innerringen. Ger kortare smörjintervall.',
  nuvarandeFort: 'Vad som redan sitter i lagret (om känt). Används för att varna om ett föreslaget fett är inkompatibelt med det gamla vid byte — allt kan inte blandas, se kortet "Fettbyte" nedan.',
};
function tipBadge(key) {
  const t = TIPS[key];
  return t ? `<span class="vf-tip" tabindex="0" role="img" aria-label="${esc(t)}" data-tip="${esc(t)}">?</span>` : '';
}

// Fixed-positionerad tooltip (aldrig klippt av formulärets overflow). En delad bubbla på body.
let tipEl = null;
function showTip(target) {
  const txt = target.getAttribute('data-tip'); if (!txt) return;
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'vf-tipbubble'; document.body.appendChild(tipEl); }
  tipEl.textContent = txt;
  tipEl.style.display = 'block';
  tipEl.style.left = '0px'; tipEl.style.top = '0px';           // mät i övre hörnet först
  const r = target.getBoundingClientRect(), tr = tipEl.getBoundingClientRect();
  let left = r.left + r.width / 2 - tr.width / 2;
  left = Math.max(10, Math.min(left, window.innerWidth - tr.width - 10));
  let top = r.top - tr.height - 9;
  if (top < 8) top = r.bottom + 9;                              // vänd nedåt om det inte får plats ovanför
  tipEl.style.left = `${left}px`; tipEl.style.top = `${top}px`;
}
function hideTip() { if (tipEl) tipEl.style.display = 'none'; }
function bindTips(root) {
  root.addEventListener('mouseover', e => { const t = e.target.closest('.vf-tip'); if (t) showTip(t); });
  root.addEventListener('mouseout', e => { const t = e.target.closest('.vf-tip'); if (t) hideTip(); });
  root.addEventListener('focusin', e => { const t = e.target.closest('.vf-tip'); if (t) showTip(t); });
  root.addEventListener('focusout', e => { const t = e.target.closest('.vf-tip'); if (t) hideTip(); });
  root.addEventListener('click', e => { if (e.target.closest('.vf-tip')) { e.preventDefault(); e.stopPropagation(); } });
}

// ---------- formulär ----------
function fInput(key, label, ph = '') {
  return `<div class="vf-field"><label for="vf_${key}">${label}${tipBadge(key)}</label>
    <input id="vf_${key}" class="mono" data-f="${key}" inputmode="decimal" autocomplete="off"
      placeholder="${esc(ph)}" value="${esc(S[key])}"></div>`;
}
function fSelect(key, label, opts) {
  const o = opts.map(([v, l]) => `<option value="${esc(v)}" ${S[key] === v ? 'selected' : ''}>${esc(l)}</option>`).join('');
  return `<div class="vf-field"><label for="vf_${key}">${label}${tipBadge(key)}</label>
    <select id="vf_${key}" data-f="${key}">${o}</select></div>`;
}

function formHtml() {
  const kort = LAGER_ORDNING.map(k => `
    <div class="vf-lcard ${S.lagertyp === k ? 'on' : ''}" data-lager="${esc(k)}" role="button" tabindex="0"
      aria-pressed="${S.lagertyp === k}" title="${esc(lagerNamn(k))}">
      ${svgLager(k)}<div class="vf-lname">${esc(lagerNamn(k))}</div>
    </div>`).join('');
  return `
    <div class="fg"><div class="fh">Lagertyp</div><div class="vf-lgrid">${kort}</div></div>
    <div class="fg"><div class="fh">Mått &amp; drift</div>
      <div class="vf-grid2">
        ${fInput('d', 'd — innerdiameter (mm)', 't.ex. 50')}
        ${fInput('D', 'D — ytterdiameter (mm)', 't.ex. 90')}
        ${fInput('B', 'B / T / H — bredd (mm)', 't.ex. 20')}
        ${fInput('massaKg', 'Lagermassa (kg)', 'valfri')}
      </div>
      ${fSelect('rorelse', 'Rörelsetyp', [['roterande', 'Kontinuerlig rotation'], ['oscillerande', 'Oscillerande / pendlande']])}
      <div class="vf-grid2" style="margin-top:10px">
        <div id="vfVarvtalWrap" style="display:${S.rorelse === 'oscillerande' ? 'none' : 'contents'}">
          ${fInput('varvtal', 'Varvtal (r/min)', 't.ex. 1 500')}
        </div>
        <div id="vfOscWrap" style="display:${S.rorelse === 'oscillerande' ? 'contents' : 'none'}">
          ${fInput('oscAmplitud', 'Vinkelutslag ±β (grader)', 't.ex. 15')}
          ${fInput('oscFrekvens', 'Frekvens (cykler/min)', 't.ex. 60')}
        </div>
        ${fInput('drifttemp', 'Drifttemperatur (°C)', '70')}
        ${fInput('omgivningstemp', 'Lägsta omgivningstemp (°C)', '20')}
      </div>
    </div>
    <div class="fg"><div class="fh">Förhållanden</div>
      <div class="vf-field">
        <label>Omgivande miljö${tipBadge('omgivning')}<span class="vf-multi">flera val möjliga</span></label>
        <div class="vf-chips" id="vfOmg">${OMGIVNING.map(([v, l]) =>
          `<span class="chip ${S.omgivning.includes(v) ? 'on' : ''}" data-omg="${esc(v)}" role="button" tabindex="0">${esc(l)}</span>`).join('')}</div>
      </div>
      <div class="vf-grid2">
        ${fSelect('belastning', 'Belastning', BELASTNING)}
        ${fSelect('orientering', 'Axelorientering', ORIENTERING)}
        ${fSelect('vibration', 'Vibrationsnivå', VIBRATION)}
        ${fSelect('eftersmorjningsmetod', 'Eftersmörjning', METOD)}
      </div>
      <div class="ck" id="vfYtter"><span class="box ${S.ytterringsrotation ? 'on' : ''}"></span>Roterande ytterring${tipBadge('ytterringsrotation')}</div>
    </div>
    <div class="fg"><div class="fh">Nuvarande fett i lagret <span class="vf-multi">valfritt</span>${tipBadge('nuvarandeFort')}</div>
      <div class="vf-grid2">
        <div class="vf-field"><label for="vf_nuvarandeFort">Förtjockare</label><select id="vf_nuvarandeFort" data-f="nuvarandeFort">${fortOpts(S.nuvarandeFort)}</select></div>
        <div class="vf-field"><label for="vf_nuvarandeBas">Basolja</label><select id="vf_nuvarandeBas" data-f="nuvarandeBas">${basOpts(S.nuvarandeBas)}</select></div>
      </div>
    </div>
    <div class="fg"><div class="fh">Läge</div>
      <div class="vf-mode" role="tablist">
        <button type="button" data-lage="foresla" class="${S.lage === 'foresla' ? 'on' : ''}">Föreslå fett</button>
        <button type="button" data-lage="kontrollera" class="${S.lage === 'kontrollera' ? 'on' : ''}">Kontrollera eget fett</button>
      </div>
      <div id="vfFett" class="vf-fettfalt ${S.lage === 'kontrollera' ? '' : 'hidden'}">
        <div class="vf-hint" style="margin:0 0 10px">Det räcker med <b>ν40 + basoljetyp</b> — det finns på nästan alla fettdatablad. ν100 är valfri och ger bara ett smalare κ-spann.</div>
        <div class="vf-grid2">
          ${fInput('visk40', 'ν40 — basoljeviskositet (mm²/s)', 't.ex. 220')}
          ${fInput('visk100', 'ν100 (mm²/s)', 'valfri — uppskattas annars')}
        </div>
        ${fSelect('basolja', 'Basoljetyp (ger antaget VI)', BASOLJOR.map(b => [b[0], `${b[1]} — VI ≈ ${b[2]}`]))}
      </div>
    </div>
    <button class="tgo vf-calcbtn" id="vfCalc" type="button">Beräkna</button>`;
}

function bindForm(m) {
  const form = m.querySelector('#vfForm');
  if (!form) return;
  form.querySelectorAll('[data-lager]').forEach(el => {
    const valj = () => {
      S.lagertyp = el.dataset.lager;
      form.querySelectorAll('[data-lager]').forEach(x => {
        x.classList.toggle('on', x.dataset.lager === S.lagertyp);
        x.setAttribute('aria-pressed', String(x.dataset.lager === S.lagertyp));
      });
      recalc(false);
    };
    el.addEventListener('click', valj);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); valj(); } });
  });
  form.addEventListener('input', e => {
    const k = e.target?.dataset?.f;
    if (!k) return;
    S[k] = e.target.value;
    recalc(false);
  });
  form.querySelectorAll('select[data-f]').forEach(sel => sel.addEventListener('change', () => {
    S[sel.dataset.f] = sel.value;
    if (sel.dataset.f === 'rorelse') {
      const osc = S.rorelse === 'oscillerande';
      form.querySelector('#vfVarvtalWrap').style.display = osc ? 'none' : 'contents';
      form.querySelector('#vfOscWrap').style.display = osc ? 'contents' : 'none';
    }
    recalc(false);
  }));
  form.querySelector('#vfYtter').addEventListener('click', (e) => {
    if (e.target.closest('.vf-tip')) return;   // klick på info-ikonen ska inte kryssa
    S.ytterringsrotation = !S.ytterringsrotation;
    form.querySelector('#vfYtter .box').classList.toggle('on', S.ytterringsrotation);
    recalc(false);
  });
  bindTips(form);
  // Omgivande miljö — flerval. "Ren och torr" är exklusivt (utesluter övriga och vice versa).
  form.querySelectorAll('[data-omg]').forEach(el => {
    const valj = () => {
      const v = el.dataset.omg;
      let arr = S.omgivning.slice();
      if (v === 'ren') arr = ['ren'];
      else {
        arr = arr.filter(x => x !== 'ren');
        const i = arr.indexOf(v);
        i < 0 ? arr.push(v) : arr.splice(i, 1);
        if (!arr.length) arr = ['ren'];
      }
      S.omgivning = arr;
      form.querySelectorAll('[data-omg]').forEach(c => c.classList.toggle('on', S.omgivning.includes(c.dataset.omg)));
      recalc(false);
    };
    el.addEventListener('click', valj);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); valj(); } });
  });
  form.querySelectorAll('[data-lage]').forEach(b => b.addEventListener('click', () => {
    S.lage = b.dataset.lage;
    form.querySelectorAll('[data-lage]').forEach(x => x.classList.toggle('on', x.dataset.lage === S.lage));
    form.querySelector('#vfFett').classList.toggle('hidden', S.lage !== 'kontrollera');
    recalc(false);
  }));
  form.querySelector('#vfCalc').addEventListener('click', () => recalc(true));
}

// ---------- beräkning ----------
function byggInput() {
  const d = num(S.d), D = num(S.D), B = num(S.B), varvtal = num(S.varvtal);
  const oscA = num(S.oscAmplitud), oscF = num(S.oscFrekvens);
  const drift = num(S.drifttemp), omg = num(S.omgivningstemp);
  const osc = S.rorelse === 'oscillerande';
  const saknas = [];
  if (d == null) saknas.push('d');
  if (D == null) saknas.push('D');
  if (B == null) saknas.push('B');
  if (!osc && varvtal == null) saknas.push('varvtal');
  if (osc && oscA == null) saknas.push('vinkelutslag ±β');
  if (osc && oscF == null) saknas.push('frekvens');
  if (drift == null) saknas.push('drifttemperatur');
  if (omg == null) saknas.push('omgivningstemperatur');
  let fett = null;
  if (S.lage === 'kontrollera') {
    const v40 = num(S.visk40);
    if (v40 == null) saknas.push('ν40 för fettet');
    fett = { visk40: v40, visk100: num(S.visk100), viBas: BASOLJA_VI[S.basolja] ?? 95 };
  }
  if (saknas.length) return { saknas };
  return { input: {
    lagertyp: S.lagertyp, d, D, B, massaKg: num(S.massaKg),
    rorelse: S.rorelse, varvtal, oscAmplitud: oscA, oscFrekvens: oscF,
    drifttemp: drift, omgivningstemp: omg,
    belastning: S.belastning, omgivning: S.omgivning, orientering: S.orientering,
    vibration: S.vibration, ytterringsrotation: S.ytterringsrotation,
    eftersmorjningsmetod: S.eftersmorjningsmetod, fett,
  } };
}

function recalc(force) {
  const b = byggInput();
  if (b.saknas) {
    if (force) {
      S.resultat = null; S.sisteInput = null;
      S.resultatFel = 'Fyll i: ' + b.saknas.join(', ') + ' för att kunna beräkna.';
      S.rek = null; S.rekFel = null; S.rekLaddar = false;
      updateRes();
    }
    return;
  }
  try {
    S.resultat = beraknaValjFett(b.input);
    S.sisteInput = b.input;
    S.resultatFel = null;
  } catch (e) {
    S.resultat = null; S.sisteInput = null;
    S.resultatFel = e && e.message ? e.message : 'Beräkningen misslyckades.';
  }
  S.rek = null; S.rekFel = null; S.rekLaddar = false; // kravprofilen har ändrats
  updateRes();
}

function updateRes() {
  const el = document.getElementById('vfRes');
  if (!el) return;
  el.innerHTML = resultHtml();
  bindRes(el);
}

function bindRes(root) {
  const btn = root.querySelector('#vfRekBtn');
  if (btn) btn.addEventListener('click', hamtaRek);
  root.querySelectorAll('[data-pid]').forEach(x =>
    x.addEventListener('click', () => CTX && CTX.openProduct(x.dataset.pid)));
}

// ---------- resultat-rendering ----------
function resultHtml() {
  if (S.resultatFel) return `<div class="ai-note vf-warn rod">⚠ ${esc(S.resultatFel)}</div>`;
  const r = S.resultat;
  if (!r) return `<div class="empty">Välj lagertyp och fyll i mått, varvtal och temperatur —<br>
    resultatet visas här direkt: κ-värde, viskositets- och NLGI-förslag,<br>fyllnadsmängd och eftersmörjningsintervall.</div>`;
  return gaugeHtml(r) + nyckeltalHtml(r) + fyllnadHtml(r) + eftersmorjningHtml(r)
    + varningarHtml(r) + kravProfilHtml(r) + forklaringHtml(r) + rekSektionHtml(r);
}

// Synlig sammanfattning av vad fettet ska uppfylla — så teknikern ser kravet även utan
// att hämta AI-produktförslag (som kräver uppkoppling). Testar-anmärkning 2026-07-04.
function kravProfilHtml(r) {
  const k = r.krav; if (!k) return '';
  const chips = [];
  const push = (txt, kls = '') => chips.push(`<span class="vf-kravchip ${kls}">${esc(txt)}</span>`);
  push(`ν40 ${fmt(k.visk40Min, 0)}–${fmt(k.visk40Max, 0)} mm²/s`, 'pri');
  if (Array.isArray(k.nlgi) && k.nlgi.length) push(`NLGI ${k.nlgi.join('/')}`);
  push(`Temp ${fmt(k.tempMin, 0)}…${fmt(k.tempMax, 0)} °C`);
  if (k.nsf) push(`NSF ${k.nsf}`, 'nsf');
  if (k.ep) push('EP/AW-tillsatser', 'ep');
  if (k.fastaSmorjamnen) push('Fasta smörjämnen (vita fasta)', 'ep');
  if (k.oscillerande) push('Oscillerande rörelse', 'ep');
  if (k.vattenbestandig) push('Vattenbeständig', 'vatten');
  if (k.hogvarv) push('Höghastighetsfett');
  if (k.lagvarv) push('Lågvarv – hög basviskositet');
  return `<div class="vf-card vf-kravcard">
    <div class="fh">Kravprofil — leta efter ett fett som uppfyller</div>
    <div class="vf-kravchips">${chips.join('')}</div>
  </div>`;
}

function zonKlass(kappa) { return kappa < 1 ? 'rod' : kappa <= 4 ? 'gron' : 'gul'; }

function gaugeHtml(r) {
  const k = r.kontroll;
  const varde = k ? k.kappa : (r.forslag?.kappaMal ?? 2);
  const pct = Math.max(0, Math.min(6, varde)) / 6 * 100;
  const zon = zonKlass(varde);
  const band = k && k.kappaBand ? k.kappaBand : null;
  const ticks = [0, 1, 2, 3, 4, 5, 6].map(t => `<span style="left:${t / 6 * 100}%">${t}</span>`).join('');
  // Skuggat osäkerhetsband på skalan (när ν100 uppskattats)
  const bandHtml = band ? (() => {
    const lo = Math.max(0, Math.min(6, band[0])) / 6 * 100;
    const hi = Math.max(0, Math.min(6, band[1])) / 6 * 100;
    return `<span class="vf-band" style="left:${lo}%;width:${Math.max(0, hi - lo)}%"></span>`;
  })() : '';
  const stor = k
    ? `<div class="vf-kbig ${zon}">κ ${band ? '≈' : '='} ${fmt(k.kappa, k.kappa < 10 ? 2 : 1)}</div>`
    : `<div class="vf-kbig gron">mål κ = ${fmt(r.forslag?.kappaMal ?? 2, 0)}</div>`;
  const spann = band
    ? `<div class="vf-kspann">uppskattat spann <b>${fmt(band[0], band[0] < 10 ? 1 : 0)}–${fmt(band[1], band[1] < 10 ? 1 : 0)}</b></div>` : '';
  const rub = k ? (k.tolkning?.rubrik ?? '') : 'Förslags-läge';
  const txt = k ? (k.tolkning?.text ?? '')
    : `Basoljeviskositeten dimensioneras mot κ = ${fmt(r.forslag?.kappaMal ?? 2, 0)} — god fullfilmsmarginal utan onödig friktionsvärme.`;
  const uppsk = k && k.v100Uppskattad
    ? `<div class="vf-hint">ν100 uppskattad ur basoljetyp (antaget VI). ${band
        ? (k.straddlarGrans
          ? '<b>Bandet korsar en zongräns</b> — här avgör basoljevalet. Ange uppmätt ν100 för säkert svar.'
          : 'Bandet visar hur mycket VI-antagandet påverkar κ — smalt band = försumbart.')
        : 'Ange uppmätt ν100 för högre precision.'}</div>` : '';
  return `<div class="vf-card vf-gaugecard">
    <div class="fh">Smörjfilmskvot κ (ISO 281)</div>
    <div class="vf-gaugerow">
      <div>${stor}${spann}</div>
      <div class="vf-gaugewrap">
        <div class="vf-gauge">${bandHtml}<span class="vf-needle ${zon}" style="left:${pct}%"></span></div>
        <div class="vf-gticks">${ticks}</div>
      </div>
    </div>
    <div class="vf-zonrub ${zon}">${esc(rub)}</div>
    <div class="vf-zontxt">${esc(txt)}</div>${uppsk}
  </div>`;
}

function kvKort(label, varde, sub, stor) {
  return `<div class="vf-card vf-kv ${stor ? 'stor' : ''}">
    <div class="vf-kv-l">${label}</div>
    <div class="vf-kv-v mono">${varde}</div>
    ${sub ? `<div class="vf-kv-s">${sub}</div>` : ''}
  </div>`;
}

function nyckeltalHtml(r) {
  const reg = REGIM[r.regim] || r.regim || '';
  const f = r.forslag || {};
  const fonster = Array.isArray(f.visk40Fonster)
    ? `fönster κ 1–4: ${fmt(f.visk40Fonster[0], 0)}–${fmt(f.visk40Fonster[1], 0)} mm²/s` : '';
  const kort = [
    kvKort('d<sub>m</sub> medeldiameter', `${fmt(r.dm, 1)} <small>mm</small>`, ''),
    kvKort('n·d<sub>m</sub> hastighetsfaktor', `${fmt(r.ndm, 0)}`,
      esc(reg) + (r.rorelse === 'oscillerande' ? ` · oscillerande, n<sub>ekv</sub> ≈ ${fmt(r.nEkv, 1)} r/min` : '')),
    kvKort('ν₁ — krävd referensviskositet', `${fmt(r.nu1, 1)} <small>mm²/s</small>`, 'vid drifttemperatur (ISO 281)'),
  ];
  if (r.kontroll) kort.push(kvKort('ν — valt fett vid drifttemp', `${fmt(r.kontroll.nu, 1)} <small>mm²/s</small>`, 'ASTM D341'));
  kort.push(kvKort('Föreslagen basoljeviskositet', esc(f.isoVg ?? '—'),
    `krävd ν40 ≈ ${fmt(f.nu40Krav, 0)} mm²/s${fonster ? ' · ' + fonster : ''}`, true));
  const nlgiF = (r.nlgi?.forslag || []).map(esc).join(' / ') || '—';
  const mot = (r.nlgi?.motivering || []).length
    ? `<ul class="vf-mot">${r.nlgi.motivering.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
  kort.push(kvKort('NLGI-förslag', nlgiF, mot, true));
  return `<div class="vf-kvgrid">${kort.join('')}</div>`;
}

function fyllnadHtml(r) {
  const f = r.fyllnad;
  if (!f) return '';
  return `<div class="vf-card">
    <div class="fh">Fyllnadsmängd</div>
    <div class="vf-storrad"><span class="vf-big mono">${fmt(f.gramStandard, 0)} g</span>
      <span class="vf-big-s">i lagret (standardfett, ρ ≈ 0,9 g/cm³)</span></div>
    <div class="vf-rad">PFPE-fett (ρ ≈ 1,9 g/cm³): <b class="mono">≈ ${fmt(f.gramPfpe, 0)} g</b></div>
    <div class="vf-rad">Fri volym i lagret: <b class="mono">${fmt(f.friVolymCm3, 0)} cm³</b>
      ${f.arUppskattning ? '<span class="vf-flagga">uppskattning — ange lagermassa för exakt värde</span>' : ''}</div>
    ${f.husText ? `<div class="vf-rad dim">${esc(f.husText)}</div>` : ''}
  </div>`;
}

function eftersmorjningHtml(r) {
  const e = r.eftersmorjning;
  if (!e) return '';
  const fakt = (e.faktorer || []).map(f =>
    `<span class="vf-faktor"><span>${esc(f.namn)}</span><b class="mono">×${fmt(f.varde, 2)}</b></span>`).join('');
  const tfTid = tidStr(e.tfH), l10Tid = tidStr(e.l10H);
  return `<div class="vf-card">
    <div class="fh">Eftersmörjning</div>
    <div class="vf-esm-grid">
      <div><div class="vf-kv-l">Efterfyllnadsmängd G<sub>p</sub></div>
        <div class="vf-kv-v mono">${fmt(e.gpGram, 1)} <small>g</small></div>
        ${e.metodText ? `<div class="vf-kv-s">${esc(e.metodText)}</div>` : ''}</div>
      <div><div class="vf-kv-l">Intervall t<sub>f</sub></div>
        <div class="vf-kv-v mono">${fmt(e.tfH, 0)} <small>h</small></div>
        <div class="vf-kv-s">${esc(tfTid)}</div></div>
      <div><div class="vf-kv-l">Basintervall (70 °C, ren, C/P ≥ 15)</div>
        <div class="vf-kv-v mono">${fmt(e.tfBasH, 0)} <small>h</small></div></div>
      <div><div class="vf-kv-l">Fettlivslängd L<sub>10</sub></div>
        <div class="vf-kv-v mono">${fmt(e.l10H, 0)} <small>h</small></div>
        <div class="vf-kv-s">${esc(l10Tid)}</div></div>
    </div>
    ${fakt ? `<div class="vf-kv-l" style="margin-top:12px">Tillämpade justeringsfaktorer</div><div class="vf-faktorer">${fakt}</div>` : ''}
    ${e.rekommendation ? `<div class="ai-note vf-rekrad">${esc(e.rekommendation)}</div>` : ''}
  </div>`;
}

function varningarHtml(r) {
  return (r.varningar || []).map(w => {
    const rod = /statisk|kontakta|gäller ej|gränsskikt|högtemperatur|oljesmörjning/i.test(w);
    return `<div class="ai-note vf-warn ${rod ? 'rod' : ''}">⚠ ${esc(w)}</div>`;
  }).join('');
}

function forklaringHtml(r) {
  const steg = (r.forklaring || []).map(f => `
    <div class="vf-steg">
      <div class="vf-steg-h"><span class="vf-steg-n mono">${esc(f.steg)}</span>${esc(f.rubrik)}</div>
      ${f.formel ? `<div class="vf-formel mono">${esc(f.formel)}</div>` : ''}
      ${f.text ? `<div class="vf-steg-t">${esc(f.text)}</div>` : ''}
    </div>`).join('');
  if (!steg) return '';
  return `<details class="vf-details"><summary>Så räknade jag — stegvis formelgenomgång</summary>${steg}</details>`;
}

// ---------- fettbyte: kompatibilitetskoll ----------
function fortOpts(sel) {
  return `<option value="">— välj förtjockare —</option>` +
    FORTJOCKARE.map(f => `<option value="${esc(f.key)}" ${sel === f.key ? 'selected' : ''}>${esc(f.namn)}</option>`).join('');
}
function basOpts(sel) {
  return `<option value="">— basolja (valfri) —</option>` +
    BASOLJA.map(b => `<option value="${esc(b.key)}" ${sel === b.key ? 'selected' : ''}>${esc(b.namn)}</option>`).join('');
}

function kompResultHtml() {
  if (S.kFel) return `<div class="ai-note vf-warn">⚠ ${esc(S.kFel)}</div>`;
  const r = S.kResultat;
  if (!r) return `<div class="vf-hint" style="margin-top:4px">Välj förtjockare för både nuvarande och nytt fett — basoljan är valfri men ger säkrare svar.</div>`;
  const s = r.sammantaget;
  const rad = (label, cell) => cell
    ? `<div class="vf-komp-rad"><span>${label}</span><span class="vf-kbadge ${cell.klass}">${cell.symbol} ${esc(cell.rubrik)}</span>${cell.notis ? `<span class="vf-komp-notis">${esc(cell.notis)}</span>` : ''}</div>`
    : '';
  return `
    <div class="vf-komp-dom ${s.klass}">
      <div class="vf-komp-symbol">${s.symbol}</div>
      <div><div class="vf-komp-verdikt">${esc(s.rubrik)}</div>
        <div class="vf-komp-atgard">${esc(r.atgard)}</div></div>
    </div>
    ${rad('Förtjockare', r.fort)}
    ${rad('Basolja', r.bas)}`;
}

function kompHtml() {
  return `<div class="vf-card vf-kompcard">
    <button type="button" class="vf-komp-head" id="vfKompToggle" aria-expanded="${S.kOppen}">
      <span class="fh" style="margin:0">🔄 Fettbyte — kan jag byta fett?</span>
      <span class="vf-komp-chev">${S.kOppen ? '▾' : '▸'}</span>
    </button>
    <div class="vf-komp-body ${S.kOppen ? '' : 'hidden'}">
      <div class="vf-hint" style="margin:2px 0 12px">Kontrollerar blandbarhet mellan gammalt och nytt fett i lagret. Att byta till ett inkompatibelt fett kan bryta ned förtjockaren och orsaka haveri.</div>
      <div class="vf-komp-grid">
        <div class="vf-komp-col"><div class="vf-komp-coltitle">Nuvarande fett i lagret</div>
          <div class="vf-field"><label for="vf_kGammalFort">Förtjockare</label><select id="vf_kGammalFort" data-kf="kGammalFort">${fortOpts(S.kGammalFort)}</select></div>
          <div class="vf-field"><label for="vf_kGammalBas">Basolja</label><select id="vf_kGammalBas" data-kf="kGammalBas">${basOpts(S.kGammalBas)}</select></div>
        </div>
        <div class="vf-komp-arrow">→</div>
        <div class="vf-komp-col"><div class="vf-komp-coltitle">Nytt fett</div>
          <div class="vf-field"><label for="vf_kNyFort">Förtjockare</label><select id="vf_kNyFort" data-kf="kNyFort">${fortOpts(S.kNyFort)}</select></div>
          <div class="vf-field"><label for="vf_kNyBas">Basolja</label><select id="vf_kNyBas" data-kf="kNyBas">${basOpts(S.kNyBas)}</select></div>
        </div>
      </div>
      <div id="vfKompRes" class="vf-komp-res">${kompResultHtml()}</div>
      <div class="vf-komp-kalla">Källa: ${esc(KOMP_KALLA)}. Synkad ${esc(KOMP_SYNKAD)}. Vid tveksamhet — testa enligt ASTM D6185 eller kontakta leverantören.</div>
    </div>
  </div>`;
}

function kompRakna() {
  S.kFel = null; S.kResultat = null;
  if (S.kGammalFort && S.kNyFort) {
    try { S.kResultat = kollaByte({ fort: S.kGammalFort, bas: S.kGammalBas || null }, { fort: S.kNyFort, bas: S.kNyBas || null }); }
    catch (e) { S.kFel = e && e.message ? e.message : 'Kunde inte bedöma bytet.'; }
  }
  const el = document.getElementById('vfKompRes');
  if (el) el.innerHTML = kompResultHtml();
}

function bindKomp(root) {
  const toggle = root.querySelector('#vfKompToggle');
  if (toggle) toggle.addEventListener('click', () => {
    S.kOppen = !S.kOppen;
    const body = root.querySelector('.vf-komp-body');
    body.classList.toggle('hidden', !S.kOppen);
    toggle.setAttribute('aria-expanded', String(S.kOppen));
    root.querySelector('.vf-komp-chev').textContent = S.kOppen ? '▾' : '▸';
  });
  root.querySelectorAll('[data-kf]').forEach(sel => sel.addEventListener('change', () => {
    S[sel.dataset.kf] = sel.value;
    kompRakna();
  }));
}

// ---------- produktrekommendation ----------
function rekSektionHtml() {
  let inre;
  if (S.rekLaddar) {
    inre = `<div class="empty" style="padding:26px 12px"><span class="spinner"></span> AI väljer produkter ur sortimentet…</div>`;
  } else if (S.rekFel) {
    inre = `<div class="ai-note vf-warn rod">⚠ ${esc(S.rekFel)}</div>
      <button class="btn ghost" id="vfRekBtn" type="button">Försök igen</button>`;
  } else if (!S.rek) {
    inre = `<button class="tgo" id="vfRekBtn" type="button">Föreslå produkter ur sortimentet</button>`;
  } else {
    const rk = S.rek;
    const note = rk.note ? `<div class="ai-note"><span class="ai-chip">AI</span>${esc(rk.note)}</div>` : '';
    const prods = (rk.results || []).map(prodHtml).join('');
    const antal = rk.candidateCount != null
      ? `<div class="vf-kv-s" style="margin-top:8px">${(rk.results || []).length} förslag av ${esc(rk.candidateCount)} kandidater i sortimentet.</div>` : '';
    inre = (rk.results || []).length
      ? note + prods + antal
      : `<div class="empty" style="padding:26px 12px">Inga produkter i sortimentet matchade kravprofilen.</div>`;
  }
  return `<div class="vf-card vf-rek"><div class="fh">Produkter ur sortimentet</div>${inre}</div>`;
}

function viFranBasolja(basolja) {
  const s = (Array.isArray(basolja) ? basolja.join(' ') : String(basolja || '')).toLowerCase();
  if (s.includes('pao')) return 145;
  if (s.includes('ester')) return 140;
  if (s.includes('polyglykol') || s.includes('pag')) return 210;
  if (s.includes('silikon')) return 250;
  if (s.includes('pfpe')) return 130;
  if (s.includes('white')) return 95;
  return 95; // mineral / okänd
}

function produktKappa(p) {
  const r = S.resultat, inp = S.sisteInput;
  if (!r || !inp) return null;
  const v40 = Number(p.viskositet_40c);
  if (!isFinite(v40) || v40 <= 0) return null;
  try {
    let v100 = Number(p.viskositet_100c);
    if (!isFinite(v100) || v100 <= 0) v100 = estimeraV100(v40, viFranBasolja(p.basolja));
    const nu = visk40TillVid(inp.drifttemp, v40, v100);
    const kappa = nu / r.nu1;
    return isFinite(kappa) ? kappa : null;
  } catch { return null; }
}

// Kompatibilitet mellan nuvarande fett i lagret (om angivet) och en föreslagen produkt.
function produktKompatibilitet(p) {
  if (!S.nuvarandeFort) return null;
  try {
    const nyFort = fortNyckelFranDb(p.fortjockare);
    if (!nyFort) return null;
    return kollaByte({ fort: S.nuvarandeFort, bas: S.nuvarandeBas || null },
      { fort: nyFort, bas: basNyckelFranDb(p.basolja) });
  } catch { return null; }
}

function prodHtml(p) {
  const lam = Math.max(0, Math.min(100, Math.round(Number(p.lamplighet) || 0)));
  const kappa = produktKappa(p);
  const kHtml = kappa == null
    ? `<span class="vf-kpill okand">κ okänt<br><small>(viskositet saknas)</small></span>`
    : `<span class="vf-kpill ${zonKlass(kappa)}">κ ≈ ${fmt(kappa, 1)}</span>`;
  const komp = produktKompatibilitet(p);
  const kompHtml = komp
    ? `<span class="vf-kbadge ${komp.sammantaget.klass}" title="${esc(komp.atgard)}">🔄 ${komp.sammantaget.symbol} byte</span>` : '';
  const temp = (p.temperaturomrade_min != null || p.temperaturomrade_max != null)
    ? `${p.temperaturomrade_min ?? '?'}…${p.temperaturomrade_max ?? '?'} °C` : '—';
  const nsf = (p.nsf_klass_food_grade && p.nsf_klass_food_grade !== 'Ej livsmedelsgodkänd')
    ? `<span class="nsf">${esc(p.nsf_klass_food_grade)}</span>` : '';
  return `<div class="vf-prod" data-pid="${esc(p.id)}" role="button" tabindex="0">
    <div class="vf-prod-sim"><span class="tsn">${lam}%</span><div class="tbrz"><i style="width:${lam}%"></i></div></div>
    <div class="vf-prod-mitt">
      <div class="tpn">${esc(p.produktnamn)}</div>
      <div class="tps">${esc(p.producent)}${p.motivering ? ' · ' + esc(p.motivering) : ''}</div>
      ${p.applikationsrad ? `<div class="vf-prod-app">${esc(p.applikationsrad)}</div>` : ''}
      <div class="vf-prod-specs">
        <span>NLGI <b class="mono">${esc(p.nlgi_klass ?? '—')}</b></span>
        <span>ν40 <b class="mono">${p.viskositet_40c != null ? fmt(p.viskositet_40c, 0) + ' mm²/s' : '—'}</b></span>
        <span class="mono">${esc(temp)}</span>
        ${nsf}${kompHtml}
      </div>
    </div>
    <div class="vf-prod-k">${kHtml}</div>
  </div>`;
}

function byggKontext() {
  const i = S.sisteInput;
  if (!i) return { beskrivning: '' };
  const l = (arr, v) => { const hit = arr.find(x => x[0] === v); return hit ? hit[1] : v; };
  const delar = [
    `${lagerNamn(i.lagertyp)} ${fmt(i.d, 0)}×${fmt(i.D, 0)}×${fmt(i.B, 0)} mm`,
    i.rorelse === 'oscillerande'
      ? `oscillerande ±${fmt(i.oscAmplitud, 1)}° vid ${fmt(i.oscFrekvens, 0)} cykler/min (fretting-risk — kräver fasta smörjämnen)`
      : `${fmt(i.varvtal, 0)} r/min`,
    `${fmt(i.drifttemp, 0)} °C drift (min ${fmt(i.omgivningstemp, 0)} °C)`,
    l(BELASTNING, i.belastning),
    'miljö: ' + (Array.isArray(i.omgivning) ? i.omgivning : [i.omgivning]).map(o => l(OMGIVNING, o)).join(' + '),
    l(ORIENTERING, i.orientering), `vibration: ${l(VIBRATION, i.vibration)}`,
  ];
  if (i.ytterringsrotation) delar.push('roterande ytterring');
  delar.push(`eftersmörjning ${l(METOD, i.eftersmorjningsmetod)}`);
  if (i.fett) delar.push(`kontroll av eget fett ν40=${fmt(i.fett.visk40, 0)} mm²/s`);
  const nuvarandeFortNamn = S.nuvarandeFort ? (FORTJOCKARE.find(f => f.key === S.nuvarandeFort)?.namn || S.nuvarandeFort) : null;
  if (nuvarandeFortNamn) delar.push(`nuvarande fett i lagret: ${nuvarandeFortNamn}${S.nuvarandeBas ? ' / ' + (BASOLJA.find(b => b.key === S.nuvarandeBas)?.namn || S.nuvarandeBas) : ''}`);
  return {
    beskrivning: delar.join(', ').slice(0, 480),
    lagertyp: lagerNamn(i.lagertyp), d: i.d, D: i.D, B: i.B,
    varvtal: i.varvtal, drifttemp: i.drifttemp, omgivningstemp: i.omgivningstemp,
    belastning: i.belastning,
    omgivning: (Array.isArray(i.omgivning) ? i.omgivning : [i.omgivning]).join(', '),
    orientering: i.orientering, vibration: i.vibration,
    nuvarandeFort: S.nuvarandeFort || null, nuvarandeBas: S.nuvarandeBas || null,
  };
}

async function hamtaRek() {
  const r = S.resultat;
  if (!r || !CTX) return;
  S.rekLaddar = true; S.rekFel = null; S.rek = null;
  updateRes();
  try {
    const sess = CTX.session();
    if (!sess) throw new Error('Ingen aktiv session — logga in på nytt.');
    const res = await fetch(`${CTX.FN_URL}/fett-rekommendation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sess.access_token}` },
      body: JSON.stringify({ krav: r.krav, kontext: byggKontext() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Rekommendationen misslyckades');
    S.rek = data;
  } catch (e) {
    const msg = e && e.message ? e.message : '';
    S.rekFel = /failed to fetch|networkerror|load failed/i.test(msg)
      ? 'Kunde inte nå servern — kontrollera uppkopplingen och försök igen.'
      : (msg || 'Kunde inte hämta rekommendationer.');
    CTX.toast('Fel: ' + S.rekFel);
  } finally {
    S.rekLaddar = false;
    updateRes();
  }
}
