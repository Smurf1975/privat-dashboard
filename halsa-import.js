// halsa-import.js — Eufy-vågen in i hälsomodulen utan ny infrastruktur.
// Ren funktionsmodul (ingen DOM): EufyLife-export (CSV) eller manuell vikt →
// payload för Edge Function halsa-ingest. source = 'manual' för båda (Ä5:
// transporten är "Mats via dashboarden"); raw.origin skiljer fil från formulär.
// Testbar i Node: node -e "require('./halsa-import.js')".
(function (root) {
  'use strict';
  const KOL = { tid: 'Time', medlem: 'Family Members', vikt: 'WEIGHT (kg)', fett: 'BODY FAT %', mager: 'LEAN BODY MASS (kg)' };
  // Följer med i raw på viktposten (halsa-ingest lagrar hela posten) — inget tappas.
  const EXTRA = { bmi: 'BMI', muskelmassa_kg: 'MUSCLE MASS (kg)', vatten_pct: 'WATER', bmr: 'BMR',
                  benmassa_kg: 'BONE MASS (kg)', visceralt_fett: 'VISCERAL FAT', protein_pct: 'PROTEIN %',
                  skelettmuskel_kg: 'SKELETAL MUSCLE MASS (kg)' };

  // Eufy skriver 0.000000 för "saknas" → null.
  function tal(v) { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; }
  // Exporten har lokal tid utan zon → tolkas i webbläsarens zon (Europe/Stockholm).
  function iso(t) { const d = new Date(String(t || '').trim().replace(' ', 'T')); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }

  function parseEufy(text, medlem) {
    medlem = medlem || 'Mats Enmark';
    const rader = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter(r => r.trim());
    const kol = (rader.shift() || '').split(',').map(s => s.trim());
    const ix = {}; for (const k in KOL) ix[k] = kol.indexOf(KOL[k]);
    if (ix.tid < 0 || ix.vikt < 0 || ix.medlem < 0) throw new Error('Inte en EufyLife-viktexport (saknar Time/Family Members/WEIGHT)');
    const sedda = new Set(); let andra = 0, dubbletter = 0, utanVikt = 0;
    const weight = [], body_fat = [], lean_body_mass = [];
    for (const rad of rader) {
      const c = rad.split(',');
      if ((c[ix.medlem] || '').trim() !== medlem) { andra++; continue; }
      const time = iso(c[ix.tid]), kg = tal(c[ix.vikt]);
      if (!time || !kg) { utanVikt++; continue; }
      if (sedda.has(time)) { dubbletter++; continue; }   // Eufy exporterar ibland samma vägning 2–3 ggr
      sedda.add(time);
      const w = { time, weight_kg: kg, origin: 'eufy_export' };
      for (const k in EXTRA) { const i = kol.indexOf(EXTRA[k]); const v = i >= 0 ? tal(c[i]) : null; if (v != null) w[k] = v; }
      weight.push(w);
      const fett = ix.fett >= 0 ? tal(c[ix.fett]) : null;
      if (fett) body_fat.push({ time, percentage: fett, origin: 'eufy_export' });
      const mager = ix.mager >= 0 ? tal(c[ix.mager]) : null;
      if (mager) lean_body_mass.push({ time, mass_kg: mager, origin: 'eufy_export' });
    }
    // En vägning som avviker mer än 25 % från medianen är i praktiken någon annan
    // på Mats profil (exporten har en post på 30,45 kg). Den importeras inte — annars
    // återuppstår den vid varje ny import av samma fil.
    const vikter = weight.map(w => w.weight_kg).sort((a, b) => a - b);
    const median = vikter.length ? vikter[Math.floor(vikter.length/2)] : null;
    const rimlig = t => !median || Math.abs(t - median) / median <= 0.25;
    const ok = new Set(weight.filter(w => rimlig(w.weight_kg)).map(w => w.time));
    const orimliga = weight.length - ok.size;
    return {
      payload: { source: 'manual', weight: weight.filter(w => ok.has(w.time)),
                 body_fat: body_fat.filter(r => ok.has(r.time)),
                 lean_body_mass: lean_body_mass.filter(r => ok.has(r.time)) },
      vagningar: ok.size, andra, dubbletter, utanVikt, orimliga,
    };
  }

  // Manuell inmatning: datum (tomt = idag) + vikt + valfri fett-%. Dagens datum → nu, annars 08:00.
  function manuell(datum, vikt, fett) {
    const kg = tal(vikt); if (!kg) return null;
    const idag = new Date().toLocaleDateString('sv-SE');
    datum = (datum || '').trim() || idag;
    const time = datum === idag ? new Date().toISOString() : iso(datum + ' 08:00:00');
    if (!time) return null;
    const p = { source: 'manual', weight: [{ time, weight_kg: kg, origin: 'manual_form' }], body_fat: [] };
    const f = tal(fett); if (f) p.body_fat.push({ time, percentage: f, origin: 'manual_form' });
    return { payload: p, time };
  }

  const api = { parseEufy, manuell };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HalsaImport = api;
})(typeof window !== 'undefined' ? window : globalThis);
