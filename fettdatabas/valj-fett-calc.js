// valj-fett-calc.js — beräkningsmotor för "Välj fett" (lagerfettväljare)
// Ren ES-modul utan DOM och utan beroenden.
//
// Ingenjörsmodell (källor angivna per steg):
//  ν1 (nominell/krävd referensviskositet)  — ISO 281 / SKF-approximationer
//  ν vid drifttemperatur                   — ASTM D341 (Ubbelohde–Walther)
//  ν100-uppskattning ur ν40 + VI           — egen estimator kalibrerad mot typiska
//                                            datablad per basoljefamilj (se estimeraV100)
//  κ = ν/ν1 med zontolkning                — ISO 281 / SKF katalog
//  Fyllnadsmängd                           — SKF: V = π/4·B(D²−d²)·10⁻³ − M/(7,8·10⁻³) [cm³]
//  Efterfyllnadsmängd                      — SKF: Gp = 0,005·D·B (sida) / 0,002·D·B (centrumhål) [g]
//  Eftersmörjningsintervall t_f            — kurvanpassning mot SKF:s intervalldiagram
//                                            (bf·n·dm vid 70 °C, C/P ≥ 15) + SKF:s justeringsregler.
//                                            UPPSKATTNING — verifiera kritiska fall i SKF Product Select.
//  L10-fettlivslängd ≈ 2,7 · t_f           — SKF (t_f är L1-liv)

// ---------- konstanter ----------

export const ISO_VG = [10, 15, 22, 32, 46, 68, 100, 150, 220, 320, 460, 680, 1000, 1500];

// bf = SKF:s lagerfaktor (multiplicerar n·dm i intervalldiagrammet).
// K_typ används ej separat — typberoendet ligger i bf. kommentar visas ej i UI (referens).
export const LAGERTYPER = {
  'spårkullager':            { namn: 'Spårkullager',            bf: 1.0,  kommentar: 'Referenstyp — långa fettintervall' },
  vinkelkontaktkullager:     { namn: 'Vinkelkontaktkullager',   bf: 1.0,  kommentar: 'Som spårkullager vid normal förspänning' },
  sjalvinstallande_kullager: { namn: 'Självinställande kullager', bf: 1.0, kommentar: '' },
  cylindriskt_rullager:      { namn: 'Cylindriskt rullager',    bf: 1.5,  kommentar: 'bf 2 vid samtidig axiallast' },
  sfariskt_rullager:         { namn: 'Sfäriskt rullager',       bf: 2.0,  kommentar: 'bf stiger kraftigt vid tung last (SKF: upp till 8)' },
  koniskt_rullager:          { namn: 'Koniskt rullager',        bf: 3.5,  kommentar: '' },
  nalrullager:               { namn: 'Nålrullager',             bf: 3.5,  kommentar: '' },
  carb:                      { namn: 'CARB (toroid)',           bf: 2.0,  kommentar: '' },
  axialkullager:             { namn: 'Axialkullager',           bf: 5.5,  kommentar: 'Korta intervall — kontrollera oljesmörjning vid höga varv' },
  sfariskt_axialrullager:    { namn: 'Sfäriskt axialrullager',  bf: 50,   kommentar: 'SKF rekommenderar ofta oljesmörjning' },
};

const BELASTNING_FAKTOR = { latt: 1.0, medel: 0.6, tung: 0.3, mycket_tung: 0.1 }; // ~C/P 15/10/5/<4 ur SKF-diagrammets kurvskara
const MILJO_FAKTOR = { ren: 1.0, dammig: 0.7, fuktig: 0.5, vattentvatt: 0.25, livsmedel: 0.25, kemisk: 0.5 };
const MILJO_NAMN = { ren: 'ren', dammig: 'dammig', fuktig: 'fuktig', vattentvatt: 'vattentvätt', livsmedel: 'livsmedel', kemisk: 'kemisk' };
const VIBRATION_FAKTOR = { lag: 1.0, medel: 0.75, hog: 0.5 };

// ---------- hjälpare ----------

const log10 = Math.log10;
const rund = (x, dec = 1) => { const f = 10 ** dec; return Math.round(x * f) / f; };

function kravTal(namn, v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Ogiltigt värde för ${namn} — ange ett tal.`);
  if (n < min || n > max) throw new Error(`${namn} måste ligga mellan ${min} och ${max}.`);
  return n;
}
function kravEnum(namn, v, tillatna) {
  if (!tillatna.includes(v)) throw new Error(`Ogiltigt val för ${namn}.`);
  return v;
}

// ---------- ASTM D341 (Ubbelohde–Walther): ν(T) ur två kända punkter ----------
// loglog(ν + 0,7) = A − B·log10(T[K]).  Giltig för ν > ~2 mm²/s (basoljor i fett: ok).

const T40K = 313.15, T100K = 373.15;
const LL = (nu) => log10(log10(nu + 0.7));
const invLL = (y) => 10 ** (10 ** y) - 0.7;

export function visk40TillVid(tempC, v40, v100) {
  if (!Number.isFinite(tempC) || tempC < -80 || tempC > 350) throw new Error('Temperatur utanför giltigt område (−80…350 °C).');
  if (!(v40 > 1.5) || !(v100 > 1.5)) throw new Error('Viskositeter måste vara > 1,5 mm²/s.');
  if (v100 >= v40) throw new Error('ν100 måste vara lägre än ν40.');
  const B = (LL(v40) - LL(v100)) / (log10(T100K) - log10(T40K));
  const A = LL(v40) + B * log10(T40K);
  const nu = invLL(A - B * log10(tempC + 273.15));
  if (!Number.isFinite(nu) || nu <= 0) throw new Error('Viskositetsberäkningen gav ogiltigt värde — kontrollera indata.');
  return nu;
}

// ---------- ν100-uppskattning ur ν40 + viskositetsindex ----------
// ASTM D2270:s tabell/polynom är opraktiska att invertera exakt här. I stället:
// (1) mineralreferens VI ≈ 95: typiska ν100 per ISO VG-grad ur parafiniska datablad,
//     log-log-interpolerad; (2) VI-korrektion kalibrerad mot PAO (VI 145, VG68: ν100 ≈ 10,4)
//     och PAG (VI 210, VG220: ν100 ≈ 38): faktor = 1 + 1,44e-4·ΔVI + 7,51e-5·ΔVI².
// Detta är en dokumenterad ingenjörsuppskattning (±10 %) — uppmätt ν100 vinner alltid.

const MIN_REF = [ // [ν40, ν100] mineralolja VI ≈ 95
  [10, 2.6], [15, 3.4], [22, 4.3], [32, 5.4], [46, 6.8], [68, 8.7], [100, 11.2],
  [150, 14.7], [220, 18.9], [320, 24.1], [460, 30.7], [680, 39.5], [1000, 50], [1500, 65], [2500, 88],
];

export function estimeraV100(v40, vi = 95) {
  if (!(v40 >= 2 && v40 <= 10000)) throw new Error('ν40 utanför giltigt område (2…10 000 mm²/s).');
  if (!(vi >= 40 && vi <= 400)) throw new Error('VI utanför giltigt område (40…400).');
  // mineralbas: log-log-interpolation i referenstabellen
  const t = MIN_REF;
  let v100min;
  if (v40 <= t[0][0]) v100min = t[0][1] * (v40 / t[0][0]) ** 0.62;
  else if (v40 >= t[t.length - 1][0]) {
    const [a, b] = [t[t.length - 2], t[t.length - 1]];
    const k = Math.log(b[1] / a[1]) / Math.log(b[0] / a[0]);
    v100min = b[1] * (v40 / b[0]) ** k;
  } else {
    for (let i = 0; i < t.length - 1; i++) {
      const [x0, y0] = t[i], [x1, y1] = t[i + 1];
      if (v40 >= x0 && v40 <= x1) {
        const k = Math.log(y1 / y0) / Math.log(x1 / x0);
        v100min = y0 * (v40 / x0) ** k; break;
      }
    }
  }
  // VI-korrektion (kalibrerad mot PAO/PAG-datablad, se kommentar ovan)
  const dvi = vi - 95;
  const faktor = dvi >= 0
    ? 1 + 1.44e-4 * dvi + 7.51e-5 * dvi * dvi
    : Math.max(0.6, 1 + 0.0035 * dvi);
  const v100 = Math.min(v100min * faktor, v40 * 0.55);
  // fysikalisk rimlighet: klart under ν40, och golvad så D341 förblir giltig (>1,5 mm²/s)
  return v40 >= 4 ? Math.max(v100, 1.8) : v100;
}

// Krävd ν40 för att nå målviskositet nuMal vid drifttemp (bisektion, antaget VI).
function kravdV40(nuMal, tempC, vi) {
  const f = (v40) => visk40TillVid(tempC, v40, estimeraV100(v40, vi)) - nuMal;
  let lo = 6, hi = 9000; // under ν40 = 6 finns inga fettbasoljor — och D341-giltigheten säkras
  if (f(hi) < 0) return Infinity;   // ouppnåeligt med fett — flaggas av anroparen
  if (f(lo) > 0) return lo;
  for (let i = 0; i < 60; i++) {
    const mid = Math.sqrt(lo * hi); // geometrisk bisektion (viskositet är log-skalig)
    (f(mid) < 0) ? (lo = mid) : (hi = mid);
  }
  return Math.sqrt(lo * hi);
}

// ---------- ν1 — nominell viskositet (ISO 281/SKF) ----------
function nominellViskositet(n, dm) {
  return n < 1000
    ? 45000 * n ** -0.83 * dm ** -0.5
    : 4500 * n ** -0.5 * dm ** -0.5;
}

// ---------- t_f-basintervall ----------
// Kurvanpassning mot SKF:s eftersmörjningsdiagram (70 °C, C/P ≥ 15, ren miljö, horisontell axel):
// tf ≈ 20 000 · 10^(−3,0e-6 · (bf·n·dm − 100 000)) h, tak 30 000 h.
// Ankare: 100k→20 000 h, 200k→10 000 h, 400k→2 500 h, 700k→~320 h — följer diagrammets kurva.
function tfBas(bfNdm) {
  const tf = 20000 * 10 ** (-3.0e-6 * (bfNdm - 100000));
  return Math.min(30000, Math.max(0, tf));
}

// ---------- huvudfunktion ----------

export function beraknaValjFett(input) {
  if (!input || typeof input !== 'object') throw new Error('Saknar indata.');

  // --- validering ---
  const lagertyp = kravEnum('lagertyp', input.lagertyp, Object.keys(LAGERTYPER));
  const d = kravTal('d (innerdiameter)', input.d, 3, 1500);
  const D = kravTal('D (ytterdiameter)', input.D, 4, 2500);
  if (D <= d) throw new Error('D måste vara större än d.');
  const B = kravTal('B (bredd)', input.B, 1, 1000);
  const massaKg = (input.massaKg == null || input.massaKg === '') ? null : kravTal('lagermassa', input.massaKg, 0.001, 5000);
  const n = kravTal('varvtal', input.varvtal, 0.1, 200000);
  const drift = kravTal('drifttemperatur', input.drifttemp, -60, 250);
  const omg = kravTal('omgivningstemperatur', input.omgivningstemp, -60, 250);
  const belastning = kravEnum('belastning', input.belastning, Object.keys(BELASTNING_FAKTOR));
  // Omgivning kan vara flera samtidigt (t.ex. dammig + fuktig). Accepterar array eller enskild
  // sträng (bakåtkompatibelt). Tom → 'ren'. 'ren' + annat → 'ren' faller bort (irrelevant, faktor 1).
  let omgArr = Array.isArray(input.omgivning) ? input.omgivning : [input.omgivning];
  omgArr = [...new Set(omgArr.filter(x => x != null && x !== ''))];
  if (!omgArr.length) omgArr = ['ren'];
  omgArr.forEach(o => kravEnum('omgivning', o, Object.keys(MILJO_FAKTOR)));
  const omgivning = omgArr.length > 1 ? omgArr.filter(o => o !== 'ren') : omgArr;
  const harMiljo = (...vals) => omgivning.some(o => vals.includes(o));
  const orientering = kravEnum('orientering', input.orientering, ['horisontell', 'vertikal']);
  const vibration = kravEnum('vibration', input.vibration, Object.keys(VIBRATION_FAKTOR));
  const metod = kravEnum('eftersmörjningsmetod', input.eftersmorjningsmetod, ['sida', 'centrumhal']);
  const ytterrot = !!input.ytterringsrotation;

  let fett = null;
  if (input.fett) {
    const v40 = kravTal('ν40', input.fett.visk40, 2, 10000);
    let v100 = (input.fett.visk100 == null || input.fett.visk100 === '') ? null : kravTal('ν100', input.fett.visk100, 2, 500);
    if (v100 != null && v100 >= v40) throw new Error('ν100 måste vara lägre än ν40.');
    const viBas = (input.fett.viBas == null) ? 95 : kravTal('VI', input.fett.viBas, 40, 400);
    fett = { v40, v100, viBas };
  }

  const varningar = [];
  const forklaring = [];

  // --- steg 1: geometri & hastighet ---
  const dm = 0.5 * (d + D);
  const ndm = n * dm;
  const hogGrans = dm <= 200 ? 500000 : 400000;
  const regim = ndm < 10000 ? 'lagvarv' : ndm > hogGrans ? 'hogvarv' : 'normal';
  forklaring.push({
    steg: 1, rubrik: 'Medeldiameter och hastighetsfaktor',
    formel: `dm = 0,5·(d + D) = 0,5·(${d} + ${D}) = ${rund(dm)} mm;   n·dm = ${n} · ${rund(dm)} = ${Math.round(ndm).toLocaleString('sv-SE')}`,
    text: regim === 'lagvarv'
      ? 'n·dm < 10 000 — lågvarvsregim: lastbärande film kräver hög basoljeviskositet.'
      : regim === 'hogvarv'
        ? `n·dm > ${hogGrans.toLocaleString('sv-SE')} — högvarvsregim: låg krävd viskositet, välj lågviskös basolja och kanalbildande fett.`
        : 'Normal hastighetsregim.',
  });

  // --- steg 2: ν1 ---
  const nu1 = nominellViskositet(n, dm);
  forklaring.push({
    steg: 2, rubrik: 'Nominell viskositet ν₁ (ISO 281)',
    formel: n < 1000
      ? `ν₁ = 45 000 · n^-0,83 · dm^-0,5 = 45 000 · ${n}^-0,83 · ${rund(dm)}^-0,5 = ${rund(nu1)} mm²/s`
      : `ν₁ = 4 500 · n^-0,5 · dm^-0,5 = 4 500 · ${n}^-0,5 · ${rund(dm)}^-0,5 = ${rund(nu1)} mm²/s`,
    text: 'ν₁ är den viskositet som krävs vid drifttemperaturen för fullgod filmbildning i rullkontakten.',
  });

  // --- steg 3–4: κ (kontroll-läge) och krävd ν40 (alltid) ---
  let kontroll = null;
  if (fett) {
    const v100Uppskattad = fett.v100 == null;
    let v100 = fett.v100;
    if (v100 == null) {
      v100 = estimeraV100(fett.v40, fett.viBas);
      // Väldigt tunna basoljor (ν40 ≲ 4) ger uppskattad ν100 nära ASTM D341:s giltighetsgräns
      // → be om uppmätt ν100 i stället för att låta viskositetsberäkningen kasta ett kryptiskt fel.
      if (!(v100 > 1.6)) throw new Error('Basoljan är för tunn för att uppskatta ν100 automatiskt — ange uppmätt ν100 från databladet.');
    }
    const nu = visk40TillVid(drift, fett.v40, v100);
    const kappa = nu / nu1;
    const zon = kappa < 0.1 ? 'under_0_1' : kappa < 1 ? '0_1_till_1' : kappa <= 4 ? '1_till_4' : 'over_4';

    // κ-osäkerhetsband: när ν100 uppskattats ur basoljetyp (VI) vet vi inte exakt hur oljan
    // tunnas med temperaturen. Vi räknar κ över ett rimligt VI-spann (±20 VI, familjespridning)
    // kombinerat med estimatorns ±8 % modellfel, och tar min/max. Bandet blir smalt nära 40 °C
    // (då spelar VI knappt roll) och brett vid höga drifttemperaturer — precis den bedömning
    // teknikern behöver: "spelar min basolje-gissning roll här?".
    let kappaBand = null;
    if (v100Uppskattad) {
      const korner = [];
      for (const vi of [Math.max(40, fett.viBas - 20), fett.viBas + 20]) {
        const v100c0 = estimeraV100(fett.v40, vi);
        for (const f of [0.92, 1.08]) {
          const v100c = Math.min(v100c0 * f, fett.v40 * 0.55);
          if (v100c > 1.6) { try { korner.push(visk40TillVid(drift, fett.v40, v100c) / nu1); } catch { /* hoppa ogiltig hörna */ } }
        }
      }
      if (korner.length >= 2) {
        const lo = Math.min(...korner), hi = Math.max(...korner);
        if (isFinite(lo) && isFinite(hi) && hi - lo > 0.02) kappaBand = [lo, hi];
      }
    }
    const tolkningar = {
      under_0_1: { rubrik: 'Gränsskiktssmörjning — otillräckligt', text: 'Lasten bärs av ytojämnheterna, inte av oljefilmen. Livslängdsmodellen (ISO 281) gäller inte under κ = 0,1 — dimensionera efter statisk säkerhetsfaktor s0 och använd fett med EP/AW och/eller fasta smörjämnen.' },
      '0_1_till_1': { rubrik: 'Otillräcklig smörjfilm (blandfriktion)', text: 'Viss metallkontakt förekommer. EP/AW-tillsatser rekommenderas (under 80 °C kan κEP = 1 tillgodoräknas i aSKF). Överväg högre basoljeviskositet eller bättre kylning.' },
      '1_till_4': { rubrik: 'Målzon — god smörjfilm', text: 'Basoljeviskositeten räcker för att separera ytorna; vid κ ≈ 4 nås full EHD-film. Bra balans mellan filmbildning och friktionsförluster.' },
      over_4: { rubrik: 'Mer viskositet än nödvändigt', text: 'Ingen ytterligare livslängdsvinst över κ = 4 — men ökad friktionsvärme och startmoment. Kan ändå vara motiverat vid start-stopp-drift eller temperaturvariationer.' },
    };
    // Spänner osäkerhetsbandet över en zongräns (κ=1 eller κ=4)? Då är basoljevalet avgörande.
    const straddlarGrans = kappaBand
      ? (kappaBand[0] < 1 && kappaBand[1] >= 1) || (kappaBand[0] <= 4 && kappaBand[1] > 4)
      : false;
    kontroll = { nu, kappa, tolkning: { zon, ...tolkningar[zon] }, v100Uppskattad,
      kappaBand: kappaBand ? [rund(kappaBand[0], 2), rund(kappaBand[1], 2)] : null, straddlarGrans };
    forklaring.push({
      steg: 3, rubrik: 'Driftviskositet för valt fett (ASTM D341)',
      formel: `ν(${drift} °C) = ${rund(nu)} mm²/s  (ν40 = ${fett.v40}, ν100 = ${rund(v100)}${v100Uppskattad ? ' — uppskattad ur VI ' + fett.viBas : ''})`,
      text: 'Viskositet–temperatur-sambandet loglog(ν+0,7) = A − B·log(T) ger fettets verkliga viskositet i lagret.'
        + (kappaBand ? ` Eftersom ν100 uppskattats visas κ som ett spann (${rund(kappaBand[0], 2)}–${rund(kappaBand[1], 2)}) för ett rimligt VI-intervall.` : ''),
    });
    forklaring.push({
      steg: 4, rubrik: 'Kappavärde',
      formel: `κ = ν / ν₁ = ${rund(nu)} / ${rund(nu1)} = ${rund(kappa, 2)}`,
      text: tolkningar[zon].rubrik + '.',
    });
    if (zon === 'under_0_1' || zon === '0_1_till_1') {
      varningar.push(`κ = ${rund(kappa, 2)} < 1 — otillräcklig smörjfilm vid ${drift} °C. Välj EP/AW-fett och överväg högre viskositet; under κ 0,1 gäller ej livslängdsmodellen (statisk dimensionering).`);
    }
    if (fett.viBas >= 240) varningar.push('Silikon-/högVI-basolja: VI-uppskattningen är osäker — använd uppmätta ν40/ν100 från databladet.');
    if (straddlarGrans) varningar.push(`κ-osäkerheten (${rund(kontroll.kappaBand[0], 2)}–${rund(kontroll.kappaBand[1], 2)}) spänner över en smörjzonsgräns eftersom ν100 är uppskattat — här avgör basoljevalet bedömningen. Leta upp uppmätt ν100 från databladet för säkert svar.`);
  }

  // --- steg 5: föreslagen viskositet (mål κ = 2) ---
  const KAPPA_MAL = 2;
  const viAntagen = fett ? fett.viBas : 95; // konservativt mineral-VI i förslags-läge
  const nuKrav = KAPPA_MAL * nu1;
  let nu40Krav = kravdV40(nuKrav, drift, viAntagen);
  let v40Min = kravdV40(1 * nu1, drift, viAntagen);   // κ = 1
  let v40Max = kravdV40(4 * nu1, drift, viAntagen);   // κ = 4
  if (!Number.isFinite(nu40Krav)) {
    varningar.push('Krävd viskositet är ouppnåelig med fett vid denna kombination av lågt varvtal och hög temperatur — överväg oljesmörjning eller kontakta teknisk support.');
    nu40Krav = 9000; v40Max = 10000; if (!Number.isFinite(v40Min)) v40Min = 2000;
  }
  if (!Number.isFinite(v40Max)) v40Max = 10000;
  const isoVgVal = ISO_VG.find(g => g >= nu40Krav) ?? ISO_VG[ISO_VG.length - 1];
  const forslag = {
    nu40Krav: rund(nu40Krav, 0),
    isoVg: `ISO VG ${isoVgVal}`,
    visk40Fonster: [rund(v40Min, 0), rund(v40Max, 0)],
    kappaMal: KAPPA_MAL,
  };
  forklaring.push({
    steg: 5, rubrik: `Krävd basoljeviskositet för mål κ = ${KAPPA_MAL}`,
    formel: `ν_krav(${drift} °C) = ${KAPPA_MAL}·ν₁ = ${rund(nuKrav)} mm²/s  ⇒  ν40 ≈ ${rund(nu40Krav, 0)} mm²/s (VI ${viAntagen})  ⇒  ${forslag.isoVg}`,
    text: `Fönstret κ 1–4 motsvarar ν40 ≈ ${rund(v40Min, 0)}–${rund(v40Max, 0)} mm²/s. Högre VI (syntetbas) ger samma κ med lägre ν40 och mindre friktion vid kallstart.`,
  });
  if (regim === 'hogvarv') varningar.push('Högvarvsapplikation — välj kanalbildande fett med lågviskös basolja (spindelfett) och kontrollera fettets hastighetsfaktor (n·dm) mot databladet.');

  // --- steg 6: NLGI-förslag (poängmodell) ---
  const poang = { '0': 0, '1': 0, '2': 1, '3': 0 };
  const nlgiMot = [];
  if (metod === 'centrumhal') { poang['1'] += 2; poang['0'] += 1; nlgiMot.push('Eftersmörjning genom centrumhål kräver pumpbart fett — NLGI 1–2.'); }
  if (regim === 'hogvarv') { poang['2'] += 1; poang['3'] += 1; nlgiMot.push('Högvarv: styvare, kanalbildande fett (NLGI 2–3) minskar valkning och värme.'); }
  if (regim === 'lagvarv' && (belastning === 'tung' || belastning === 'mycket_tung')) { poang['1'] += 2; poang['2'] += 1; nlgiMot.push('Lågvarv + tung last: mjukare fett (NLGI 1–2) med hög basoljeviskositet ger bättre efterflöde till kontakten.'); }
  if (orientering === 'vertikal') { poang['2'] += 1; poang['3'] += 2; nlgiMot.push('Vertikal axel: styvare fett (NLGI 2–3) motverkar avrinning.'); }
  if (vibration === 'hog') { poang['2'] += 1; poang['3'] += 1; nlgiMot.push('Hög vibrationsnivå: mekaniskt stabilt fett (NLGI 2–3, t.ex. polyurea/litiumkomplex/kalciumsulfonat).'); }
  if (omg < -30) { poang['1'] += 2; nlgiMot.push('Låg starttemperatur: mjukare fett (NLGI 1–2) på syntetbas säkrar startsmörjning.'); }
  if (harMiljo('vattentvatt', 'livsmedel')) { poang['2'] += 1; nlgiMot.push('Spolning/tvättmiljö: NLGI 2 med vattenresistent förtjockare (kalciumsulfonat/aluminiumkomplex).'); }
  if (!nlgiMot.length) nlgiMot.push('Normalförhållanden — NLGI 2 är standardvalet för rullningslager.');
  const nlgiForslag = Object.entries(poang).sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0])).slice(0, 2)
    .filter(([, p], i) => i === 0 || p > 0).map(([k]) => k)
    .sort((a, b) => Number(a) - Number(b));
  const nlgi = { forslag: nlgiForslag, motivering: nlgiMot };

  // --- steg 7: fyllnadsmängd ---
  const annulusCm3 = (Math.PI / 4) * B * (D * D - d * d) * 1e-3;
  let friVolym, arUppskattning;
  if (massaKg != null) {
    friVolym = annulusCm3 - massaKg / 7.8e-3;   // stålvolym: M[kg]/(7,8 g/cm³·10⁻³)
    arUppskattning = false;
    if (friVolym <= 0 || friVolym > annulusCm3) {
      varningar.push('Angiven lagermassa ger orimlig fri volym — kontrollera värdet. Uppskattning används i stället.');
      friVolym = 0.30 * annulusCm3; arUppskattning = true;
    }
  } else {
    friVolym = 0.30 * annulusCm3;               // typisk fri volym ~30 % av snittvolymen (lager med hållare)
    arUppskattning = true;
  }
  const fyllnad = {
    friVolymCm3: rund(friVolym, 1),
    gramStandard: rund(friVolym * 0.9, 0),      // fettdensitet ~0,9 g/cm³
    gramPfpe: rund(friVolym * 1.9, 0),          // PFPE ~1,9 g/cm³
    arUppskattning,
    husText: regim === 'lagvarv' && harMiljo('dammig', 'fuktig', 'vattentvatt', 'kemisk')
      ? 'Husfyllnad: lågvarv + föroreningar — fyll 70–100 % av husets fria volym som barriär.'
      : metod === 'sida'
        ? 'Husfyllnad vid sidosmörjning: ca 40 % av husets fria volym initialt.'
        : 'Husfyllnad vid centrumhålssmörjning (W33): ca 20 % av husets fria volym initialt.',
  };
  forklaring.push({
    steg: 6, rubrik: 'Fyllnadsmängd i lagret (SKF)',
    formel: massaKg != null && !arUppskattning
      ? `V = π/4·B·(D²−d²)·10⁻³ − M/(7,8·10⁻³) = ${rund(annulusCm3, 1)} − ${rund(massaKg / 7.8e-3, 1)} = ${rund(friVolym, 1)} cm³ ⇒ ${fyllnad.gramStandard} g`
      : `V ≈ 0,30 · π/4·B·(D²−d²)·10⁻³ = 0,30 · ${rund(annulusCm3, 1)} = ${rund(friVolym, 1)} cm³ ⇒ ${fyllnad.gramStandard} g (uppskattning)`,
    text: 'Lagrets fria volym fylls helt vid montering (gram = V·0,9 för standardfett, V·1,9 för PFPE). Husets fria volym fylls delvis enligt eftersmörjningsmetoden.',
  });

  // --- steg 8: efterfyllnadsmängd Gp ---
  const gp = (metod === 'sida' ? 0.005 : 0.002) * D * B;
  forklaring.push({
    steg: 7, rubrik: 'Efterfyllnadsmängd (SKF)',
    formel: `Gp = ${metod === 'sida' ? '0,005' : '0,002'}·D·B = ${metod === 'sida' ? '0,005' : '0,002'} · ${D} · ${B} = ${rund(gp, 1)} g`,
    text: metod === 'sida'
      ? 'Påfyllning från lagrets sida (inget W33-spår): fettet måste vandra genom lagret för att nå löpbanorna — därför större mängd per tillfälle (0,005·D·B) och 40 % initial husfyllnad.'
      : 'Påfyllning genom smörjhål och W33-spår i ytterringen: fettet når löpbanorna direkt — därför räcker mindre mängd per tillfälle (0,002·D·B) och 20 % initial husfyllnad. Intervallet påverkas inte av påförselvägen — det styrs av fettets åldring (temperatur, varvtal, last, miljö).',
  });

  // --- steg 9: eftersmörjningsintervall ---
  const bf = LAGERTYPER[lagertyp].bf;
  const A = bf * ndm;
  const tfBasH = tfBas(A);
  const faktorer = [];
  let tf = tfBasH;
  const laddaFaktor = (namn, varde) => { if (varde !== 1) { faktorer.push({ namn, varde }); tf *= varde; } };

  laddaFaktor(`Belastning (${belastning.replace('_', ' ')})`, BELASTNING_FAKTOR[belastning]);
  // temperatur: kontinuerlig halvering per +15 °C över 70 °C (max 4 halveringar);
  // ×2 max en gång vid ≥15 °C under 70 (SKF: gäller ej axiallager)
  if (drift > 70) {
    const halveringar = Math.min((drift - 70) / 15, 4);
    laddaFaktor(`Temperatur +${rund(drift - 70, 0)} °C över 70`, rund(0.5 ** halveringar, 3));
  } else if (drift <= 55 && !['axialkullager', 'sfariskt_axialrullager'].includes(lagertyp)) {
    laddaFaktor('Temperatur under 55 °C', 2);
  }
  if (orientering === 'vertikal') laddaFaktor('Vertikal axel', 0.5);
  laddaFaktor(`Vibration (${vibration})`, VIBRATION_FAKTOR[vibration]);
  if (ytterrot) laddaFaktor('Roterande ytterring', 0.6);
  // Flera miljöer: den svåraste (lägsta faktorn) styr — standard SKF-förenkling (föroreningsnivå
  // är en enskild svårighetsgrad, inte multiplikativ). Alla valda listas, den styrande markeras.
  const miljoFaktor = Math.min(...omgivning.map(o => MILJO_FAKTOR[o]));
  const styrMiljo = omgivning.reduce((a, o) => MILJO_FAKTOR[o] < MILJO_FAKTOR[a] ? o : a, omgivning[0]);
  const miljoNamn = omgivning.map(o => MILJO_NAMN[o] || o).join(' + ');
  laddaFaktor(omgivning.length > 1 ? `Miljö (${miljoNamn} → svårast: ${MILJO_NAMN[styrMiljo] || styrMiljo})` : `Miljö (${miljoNamn})`, miljoFaktor);
  tf = Math.max(0, Math.min(30000, tf));

  let rekommendation;
  if (tf < 250) rekommendation = 'Mycket kort intervall — montera automatisk smörjapparat (t.ex. engångs- eller flerpunktsdoserare) eller gå över till oljesmörjning.';
  else if (tf < 1000) rekommendation = `Efterfyll ${rund(gp, 1)} g var ${Math.round(tf).toLocaleString('sv-SE')}:e drifttimme — en automatisk enpunktsdoserare avlastar underhållet.`;
  else rekommendation = `Efterfyll ${rund(gp, 1)} g var ${Math.round(tf).toLocaleString('sv-SE')}:e drifttimme. Vid längre stillestånd: rotera axeln några varv efter fyllning så fettet fördelas.`;
  if (drift > 110) varningar.push(`Drifttemperatur ${drift} °C över 110 °C — kräver högtemperaturfett (polyurea, litiumkomplex, kalciumsulfonatkomplex eller PFPE) med droppunkt klart över drifttemperaturen. Kontrollera fettets övre brukstemperatur.`);
  if (drift > 150) varningar.push('Över 150 °C är konventionella fetter olämpliga — PFPE- eller silikonbaserade högtemperaturfetter rekommenderas.');
  if (belastning === 'mycket_tung' && regim === 'lagvarv') varningar.push('Mycket tung last vid lågvarv — dimensionera efter statisk säkerhetsfaktor (s0) och kontakta teknisk support för fettval med fasta smörjämnen.');
  if (drift < omg) varningar.push('Drifttemperaturen är lägre än omgivningstemperaturen — kontrollera att värdena inte är förväxlade.');
  if (LAGERTYPER[lagertyp].bf >= 50) varningar.push('Sfäriskt axialrullager: SKF rekommenderar ofta oljesmörjning — fettintervallet blir mycket kort.');

  const eftersmorjning = {
    gpGram: rund(gp, 1),
    metodText: metod === 'sida'
      ? 'Gp = 0,005·D·B — från sidan (utan W33): fettet ska vandra genom lagret, större mängd'
      : 'Gp = 0,002·D·B — via W33-spåret i ytterringen: når löpbanan direkt, mindre mängd',
    tfBasH: Math.round(tfBasH),
    tfH: Math.round(tf),
    l10H: Math.round(Math.min(30000 * 2.7, tf * 2.7)),
    faktorer,
    rekommendation,
  };
  forklaring.push({
    steg: 8, rubrik: 'Eftersmörjningsintervall',
    formel: `bf·n·dm = ${bf} · ${Math.round(ndm).toLocaleString('sv-SE')} = ${Math.round(A).toLocaleString('sv-SE')} ⇒ t_f(bas) ≈ ${Math.round(tfBasH).toLocaleString('sv-SE')} h; justerat: ${Math.round(tf).toLocaleString('sv-SE')} h`,
    text: `Basintervall ur SKF-diagrammet (70 °C, C/P ≥ 15, ren miljö), därefter ${faktorer.length} justeringsfaktor(er). t_f är L1-fettlivslängd — L10 ≈ 2,7·t_f = ${eftersmorjning.l10H.toLocaleString('sv-SE')} h. Uppskattning — verifiera kritiska fall i SKF Product Select eller med FUCHS teknisk support.`,
  });

  // --- kravprofil för produktsök ---
  const krav = {
    visk40Mal: rund(Math.min(nu40Krav, 5000), 0),
    visk40Min: rund(Math.max(2, Math.min(v40Min, 5000)), 0),
    visk40Max: rund(Math.min(v40Max, 10000), 0),
    nlgi: nlgiForslag,
    tempMax: drift,
    tempMin: omg,
    nsf: harMiljo('livsmedel') ? 'H1' : null,
    vattenbestandig: harMiljo('fuktig', 'vattentvatt', 'livsmedel'),
    ep: (kontroll ? kontroll.kappa < 1 : false) || belastning === 'tung' || belastning === 'mycket_tung',
    hogvarv: regim === 'hogvarv',
    lagvarv: regim === 'lagvarv',
  };

  // Renumrera stegen löpande (steg 3–4 finns bara i kontroll-läge → annars hoppade numren 1,2,5,…)
  forklaring.forEach((f, i) => { f.steg = i + 1; });

  return {
    dm: rund(dm, 1), ndm: Math.round(ndm), regim,
    nu1: rund(nu1, 2),
    kontroll: kontroll ? {
      nu: rund(kontroll.nu, 1), kappa: rund(kontroll.kappa, 2),
      tolkning: kontroll.tolkning, v100Uppskattad: kontroll.v100Uppskattad,
      kappaBand: kontroll.kappaBand, straddlarGrans: kontroll.straddlarGrans,
    } : null,
    forslag, nlgi, fyllnad, eftersmorjning, varningar, forklaring, krav,
  };
}
