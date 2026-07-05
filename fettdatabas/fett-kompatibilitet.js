// fett-kompatibilitet.js — blandbarhet mellan smörjfetter vid byte.
// Datakälla: Notion "Blandbarhet mellan förtjockare – Referensguide" (Mats), som i sin tur
// bygger på ASTM D6185, Shell Machinery Lubrication, NLGI 2023/2024 och STLE TLT.
// Senast synkad från Notion: 2026-07-05. Uppdatera denna fil om Notion-sidan ändras.
// Ren datamodul utan DOM/beroenden.

export const KOMP_KALLA = 'ASTM D6185, Shell, NLGI 2023/24 & STLE TLT (via Notions referensguide)';
export const KOMP_SYNKAD = '2026-07-05';

// Nivåer
export const NIVA = {
  ok:    { symbol: '✅', rubrik: 'Kompatibel',   klass: 'gron' },
  grans: { symbol: '⚠️', rubrik: 'Gränsvärde',   klass: 'gul' },
  nej:   { symbol: '❌', rubrik: 'Inkompatibel', klass: 'rod' },
};

// Förtjockare i matrisens ordning. `db` = värden som förekommer i fett.fortjockare (för autodetektering).
export const FORTJOCKARE = [
  { key: 'Li',       namn: 'Litium (Li)',              db: ['Litium'] },
  { key: 'Li-X',     namn: 'Litiumkomplex (Li-X)',     db: ['Litiumkomplex'] },
  { key: 'Ca',       namn: 'Kalcium (Ca)',             db: ['Kalcium'] },
  { key: 'Ca-X',     namn: 'Kalciumkomplex (Ca-X)',    db: ['Kalciumkomplex'] },
  { key: 'CaSO4',    namn: 'Kalciumsulfonat (CaSO₄)',  db: ['Kalciumsulfonat'] },
  { key: 'Al-X',     namn: 'Aluminiumkomplex (Al-X)',  db: ['Aluminiumkomplex'] },
  { key: 'Polyurea', namn: 'Polyurea',                 db: ['Polyurea'] },
  { key: 'Na',       namn: 'Natrium (Na)',             db: ['Natrium', 'Natriumkomplex'] },
  { key: 'Bentonit', namn: 'Bentonit / Clay',          db: ['Bentonit'] },
  { key: 'Silikagel',namn: 'Silikagel (SiO₂)',         db: ['Silikagel', 'Kiselgel'] },
  { key: 'PTFE',     namn: 'PTFE / PFPE',              db: ['PTFE', 'PFPE'] },
  { key: 'Barium',   namn: 'Barium',                   db: ['Barium', 'Bariumkomplex'] },
];

// Symmetrisk 12×12-matris i FORTJOCKARE-ordning (rad = kolumn). o=ok, g=gräns, n=nej.
// Rad för rad exakt som Notion-tabellen.
const M = {
  //          Li  LiX Ca  CaX Cas AlX Pu  Na  Bnt Sil PTF Ba
  'Li':       'o  o   o   g   o   o   g   g   n   g   o   g',
  'Li-X':     'o  o   o   g   o   o   g   g   n   g   o   n',
  'Ca':       'o  o   o   o   g   o   g   g   n   g   o   g',
  'Ca-X':     'g  g   o   o   n   g   n   n   n   g   o   n',
  'CaSO4':    'o  o   g   n   o   g   n   g   n   g   o   g',
  'Al-X':     'o  o   o   g   g   o   g   n   n   g   o   g',
  'Polyurea': 'g  g   g   n   n   g   o   n   n   g   o   n',
  'Na':       'g  g   g   n   g   n   n   o   n   g   g   g',
  'Bentonit': 'n  n   n   n   n   n   n   n   o   n   g   n',
  'Silikagel':'g  g   g   g   g   g   g   g   n   o   g   g',
  'PTFE':     'o  o   o   o   o   o   o   g   g   g   o   o',
  'Barium':   'g  n   g   n   g   g   n   g   n   g   o   o',
};
const KOD = { o: 'ok', g: 'grans', n: 'nej' };
const KEYS = FORTJOCKARE.map(f => f.key);
const MATRIS = {};
for (const rk of KEYS) {
  const celler = M[rk].trim().split(/\s+/).map(c => KOD[c]);
  MATRIS[rk] = {};
  KEYS.forEach((ck, i) => { MATRIS[rk][ck] = celler[i]; });
}

// Basolja — parvis kompatibilitet. Nyckel-par (sorterade) → nivå + ev. notis.
export const BASOLJA = [
  { key: 'mineral',  namn: 'Mineralolja' },
  { key: 'pao',      namn: 'PAO' },
  { key: 'ester',    namn: 'Ester' },
  { key: 'pag',      namn: 'Polyglykol (PAG/PG)' },
  { key: 'pfpe',     namn: 'PFPE' },
  { key: 'silikon',  namn: 'Silikon' },
  { key: 'whiteoil', namn: 'White oil' },
];
const BAS_PAR = {
  'mineral|mineral': ['ok'], 'mineral|pao': ['ok'], 'mineral|ester': ['grans', 'Generellt OK — kontrollera tätningar.'],
  'mineral|pag': ['nej'], 'mineral|silikon': ['nej'], 'mineral|whiteoil': ['ok'], 'mineral|pfpe': ['nej', 'PFPE-basolja är inkompatibel med mineralolja — rengör alltid.'],
  'pao|ester': ['ok'], 'pao|pag': ['nej'], 'pao|pao': ['ok'], 'pao|whiteoil': ['ok'], 'pao|pfpe': ['nej', 'Rengör alltid.'], 'pao|mineral': ['ok'], 'pao|silikon': ['nej'],
  'ester|ester': ['ok'], 'ester|pag': ['grans'], 'ester|pfpe': ['nej', 'Rengör alltid.'], 'ester|silikon': ['nej'], 'ester|whiteoil': ['grans', 'Kontrollera tätningar.'],
  'pag|pag': ['ok'], 'pag|pfpe': ['nej'], 'pag|silikon': ['nej'], 'pag|whiteoil': ['nej'],
  'pfpe|pfpe': ['ok'], 'pfpe|silikon': ['nej'], 'pfpe|whiteoil': ['nej'],
  'silikon|silikon': ['ok'], 'silikon|whiteoil': ['nej'],
  'whiteoil|whiteoil': ['ok'],
};
function basPar(a, b) {
  if (!a || !b) return null;
  const key = [a, b].sort().join('|');
  const hit = BAS_PAR[key];
  if (hit) return { niva: hit[0], notis: hit[1] || null };
  // PFPE mot allt annat = inkompatibelt; okänt par → gräns (varna)
  if (a === 'pfpe' || b === 'pfpe') return { niva: 'nej', notis: 'PFPE-basolja kräver alltid noggrann rengöring vid byte.' };
  return { niva: 'grans', notis: 'Basoljekombinationen är inte tabellförd — kontrollera med databladet.' };
}

const RANG = { ok: 0, grans: 1, nej: 2 };
const ATGARD = {
  ok:    'Byte kan ske genom normal smörjning — låt gammalt fett pressas ut under de första 2–3 smörjcyklerna. Ingen demontering behövs.',
  grans: 'Förkorta smörjintervallet under de första 3–5 cyklerna och öka ny fettmängd något vid varje tillfälle för att pressa ut det gamla. Följ upp med provtagning om möjligt.',
  nej:   'Blanda INTE. Demontera och rengör lagret, eller spola med det nya fettets basoljefraktion tills det gamla är borta. Fyll sedan med korrekt mängd nytt fett och dokumentera bytet.',
};

// Slå upp förtjockar-nyckel ur ett DB-värde eller array (fett.fortjockare).
// Matchar mest specifika token först ("Litiumkomplex" ska ge Li-X, inte Li — trots att
// strängen innehåller "Litium").
const FORT_TOKENS = FORTJOCKARE
  .flatMap(f => f.db.map(d => ({ key: f.key, token: d.toLowerCase() })))
  .sort((a, b) => b.token.length - a.token.length);
export function fortNyckelFranDb(varde) {
  const list = (Array.isArray(varde) ? varde : [varde]).map(x => String(x || '').toLowerCase());
  for (const { key, token } of FORT_TOKENS) {
    if (list.some(v => v.includes(token))) return key;
  }
  return null;
}
// Slå upp basolje-nyckel ur DB-värde/array (fett.basolja).
export function basNyckelFranDb(varde) {
  const s = (Array.isArray(varde) ? varde.join(' ') : String(varde || '')).toLowerCase();
  if (s.includes('pfpe')) return 'pfpe';
  if (s.includes('pao')) return 'pao';
  if (s.includes('ester')) return 'ester';
  if (s.includes('polyglykol') || s.includes('pag')) return 'pag';
  if (s.includes('silikon')) return 'silikon';
  if (s.includes('white')) return 'whiteoil';
  if (s.includes('mineral')) return 'mineral';
  return null;
}

/**
 * Bedöm om man kan byta från ett fett till ett annat.
 * @param {{fort:string, bas?:string}} gammalt  förtjockar-key + (valfri) basolje-key
 * @param {{fort:string, bas?:string}} nytt
 * @returns {{ fort, bas, sammantaget, atgard, rubrik }}
 */
export function kollaByte(gammalt, nytt) {
  if (!gammalt?.fort || !nytt?.fort) throw new Error('Ange förtjockartyp för både nuvarande och nytt fett.');
  if (!MATRIS[gammalt.fort] || !MATRIS[gammalt.fort][nytt.fort]) throw new Error('Okänd förtjockarkombination.');
  const fortNiva = MATRIS[gammalt.fort][nytt.fort];
  const bas = basPar(gammalt.bas, nytt.bas);
  // Sammantaget = värsta nivån av förtjockare och basolja
  const kandidater = [fortNiva];
  if (bas) kandidater.push(bas.niva);
  const sammantaget = kandidater.reduce((a, b) => RANG[b] > RANG[a] ? b : a, 'ok');
  return {
    fort: { niva: fortNiva, ...NIVA[fortNiva] },
    bas: bas ? { niva: bas.niva, notis: bas.notis, ...NIVA[bas.niva] } : null,
    sammantaget: { niva: sammantaget, ...NIVA[sammantaget] },
    atgard: ATGARD[sammantaget],
  };
}
