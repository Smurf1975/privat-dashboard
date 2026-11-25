#!/usr/bin/env node
// Laptop Radar – riktig webbläsarverifiering av produktsidor (Playwright/Chromium).
// Användning:
//   node verify.js --out <fil.json> [--shots <dir>] [--links <regex>] URL [URL ...]
//   node verify.js --out x.json --file urls.txt
// Öppnar varje sida, försöker godkänna cookies, läser JSON-LD (Product/Offer),
// meta-taggar, synlig text och letar köpknapp. Klickar ALDRIG köp.
// Upptäcker blockering (Cloudflare/CAPTCHA/403) och markerar BLOCKED – kringgår inget.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let out = null, shots = null, linksRe = null, file = null, textLen = 12000;
const urls = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out') out = args[++i];
  else if (a === '--shots') shots = args[++i];
  else if (a === '--links') linksRe = new RegExp(args[++i], 'i');
  else if (a === '--file') file = args[++i];
  else if (a === '--text') textLen = +args[++i];
  else urls.push(a);
}
if (file) urls.push(...fs.readFileSync(file, 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')));
if (!urls.length) { console.error('Inga URL:er'); process.exit(2); }

const BLOCK_PAT = /(Attention Required|Just a moment|Vänta\.\.\.|Utför säkerhetsverifiering|verify you are human|captcha|Access Denied|You have been blocked|Sorry, you have been blocked)/i;
const COOKIE_BTNS = ['Godkänn alla', 'Acceptera alla', 'Tillåt alla', 'Godkänn', 'Acceptera', 'Accept all', 'Accept All', 'Allow all', 'OK', 'Jag godkänner', 'Accept'];
const BUY_PAT = /(lägg i (varu)?korg|lägg i kundvagn|lägg till i (varu|kund)?(korg|vagn)|till kassan|köp nu|add to (cart|basket)|in den warenkorb|ajouter au panier|lisää ostoskoriin|læg i kurv|köp$|handla)/i;
const OOS_PAT = /(slut i lager|ej i lager|tillfälligt slut|out of stock|not available|bevaka|meddela mig|kommer snart|utgått|sold out|ausverkauft)/i;
const KEYS = {
  keyboard: /(tangentbord[^.\n]{0,80}|keyboard[^.\n]{0,80}|nordisk[^.\n]{0,40}|svensk[^.\n]{0,40}layout|layout[^.\n]{0,60})/gi,
  ram: /(\d{1,2}\s?GB[^.\n]{0,60}(RAM|DDR\d|LPDDR\d)[^.\n]{0,60}|(lödd|soldered|on-?board|onboard)[^.\n]{0,80}|max(imalt)?\s?(RAM|minne)[^.\n]{0,60}|(SO-?DIMM|minnesplats|slots?)[^.\n]{0,60})/gi,
  os: /(Windows 1[01][^.\n]{0,20}|utan operativsystem|no OS|FreeDOS)/gi,
  warranty: /(garanti[^.\n]{0,80}|warranty[^.\n]{0,80})/gi,
  returns: /(öppet köp[^.\n]{0,60}|ångerrätt[^.\n]{0,60}|retur[^.\n]{0,60}|return[^.\n]{0,60})/gi,
  battery: /(batteri[^.\n]{0,80}|battery[^.\n]{0,80})/gi,
  condition: /(grade [A-C][^.\n]{0,40}|klass [A-C][^.\n]{0,40}|skick[^.\n]{0,60}|begagnad|refurbished|rekonditionerad|demo(exemplar)?|öppnad förpackning|B-vara|fyndvara|outlet)/gi,
  delivery: /(leverans[^.\n]{0,80}|frakt[^.\n]{0,60}|i lager[^.\n]{0,60}|lagerstatus[^.\n]{0,60})/gi,
  charger: /(laddare[^.\n]{0,60}|nätadapter[^.\n]{0,60}|charger[^.\n]{0,60})/gi,
};

function flattenLd(node, acc) {
  if (!node) return acc;
  if (Array.isArray(node)) { node.forEach(n => flattenLd(n, acc)); return acc; }
  if (typeof node === 'object') {
    const t = [].concat(node['@type'] || []).join(',');
    if (/Product|Offer|AggregateOffer|ItemList/i.test(t)) acc.push(node);
    if (node['@graph']) flattenLd(node['@graph'], acc);
  }
  return acc;
}
function pickProduct(lds) {
  const res = [];
  for (const p of lds) {
    if (!/Product/i.test([].concat(p['@type']).join())) continue;
    const offers = [].concat(p.offers || []).flatMap(o => o && o.offers ? [].concat(o.offers) : [o]).filter(Boolean);
    res.push({
      name: p.name, brand: p.brand && (p.brand.name || p.brand), sku: p.sku, mpn: p.mpn,
      gtin: p.gtin13 || p.gtin || p.gtin12 || p.ean,
      offers: offers.map(o => ({ price: o.price ?? o.lowPrice, currency: o.priceCurrency, availability: o.availability, condition: o.itemCondition, seller: o.seller && (o.seller.name || o.seller) })),
    });
  }
  return res;
}
function uniqHits(text, re) { const m = text.match(re) || []; return [...new Set(m.map(s => s.trim()))].slice(0, 12); }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ locale: 'sv-SE', timezoneId: 'Europe/Stockholm', viewport: { width: 1366, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' });
  const results = [];
  for (const url of urls) {
    const r = { url, checkedAt: new Date().toISOString(), method: 'playwright-chromium' };
    const page = await ctx.newPage();
    try {
      const resp = await page.goto(url, { timeout: 60000, waitUntil: 'domcontentloaded' });
      r.httpStatus = resp && resp.status();
      await page.waitForTimeout(3500);
      for (const t of COOKIE_BTNS) {
        const b = page.getByRole('button', { name: t, exact: true }).first();
        if (await b.isVisible({ timeout: 300 }).catch(() => false)) { await b.click({ timeout: 2000 }).catch(() => {}); r.cookieClicked = t; break; }
      }
      await page.waitForTimeout(1500);
      await page.mouse.wheel(0, 2500).catch(() => {}); await page.waitForTimeout(1200);
      r.finalUrl = page.url();
      r.title = await page.title();
      const body = (await page.innerText('body').catch(() => '')).replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n');
      r.blocked = (r.httpStatus === 403 || r.httpStatus === 429 || BLOCK_PAT.test(r.title) || (body.length < 1500 && BLOCK_PAT.test(body)));
      const ldRaw = await page.$$eval('script[type="application/ld+json"]', s => s.map(x => x.textContent));
      const lds = []; for (const j of ldRaw) { try { flattenLd(JSON.parse(j), lds); } catch {} }
      r.jsonld = pickProduct(lds);
      r.meta = await page.evaluate(() => {
        const g = n => (document.querySelector(`meta[property="${n}"],meta[name="${n}"],meta[itemprop="${n}"]`) || {}).content;
        return { ogTitle: g('og:title'), price: g('product:price:amount') || g('og:price:amount') || g('price'), currency: g('product:price:currency') || g('priceCurrency'), availability: g('product:availability') || g('availability') };
      });
      const buttons = await page.$$eval('button, a[role=button], input[type=submit]', bs => bs.filter(b => b.offsetParent !== null).map(b => (b.innerText || b.value || '').trim()).filter(Boolean).slice(0, 300));
      const buy = buttons.filter(t => /(lägg i|lägg till|köp|add to|warenkorb|panier|ostoskori|kurv)/i.test(t));
      r.buyButtons = [...new Set(buy)].slice(0, 6);
      r.buyable = r.buyButtons.some(t => BUY_PAT.test(t));
      r.oosText = uniqHits(body, new RegExp(OOS_PAT.source, 'gi')).slice(0, 5);
      r.priceTexts = uniqHits(body, /\d{1,3}(?:[  .]\d{3})+(?:[,:]-|,\d{2})?\s?(?:kr|SEK|:-|€|EUR)|(?:€|EUR)\s?\d[\d.,]*/g).slice(0, 10);
      r.hits = {}; for (const [k, re] of Object.entries(KEYS)) r.hits[k] = uniqHits(body, re);
      r.text = body.slice(0, textLen);
      if (linksRe) {
        r.links = await page.$$eval('a[href]', (as) => as.map(a => ({ href: a.href, text: (a.innerText || a.title || '').replace(/\s+/g, ' ').trim().slice(0, 200) })));
        r.links = r.links.filter(l => linksRe.test(l.href) || linksRe.test(l.text));
        const seen = new Set(); r.links = r.links.filter(l => !seen.has(l.href) && seen.add(l.href)).slice(0, 150);
      }
      if (shots) { fs.mkdirSync(shots, { recursive: true }); const f = path.join(shots, url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 120) + '.png'); await page.screenshot({ path: f }).catch(() => {}); r.screenshot = f; }
      r.status = r.blocked ? 'BLOCKED' : 'OK';
    } catch (e) { r.status = 'ERROR'; r.error = e.message.split('\n')[0]; }
    await page.close();
    results.push(r);
    const p0 = (r.jsonld && r.jsonld[0]) || {};
    const o0 = (p0.offers && p0.offers[0]) || {};
    console.error(`[${r.status}] ${r.httpStatus || ''} ${url}\n   ${r.title || ''}\n   sku=${p0.sku || p0.mpn || '-'} price=${o0.price || r.meta?.price || (r.priceTexts || [])[0] || '-'} avail=${o0.availability || r.meta?.availability || '-'} buyable=${r.buyable} oos=${(r.oosText || []).join('|')}`);
  }
  await browser.close();
  const json = JSON.stringify(results, null, 1);
  if (out) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, json); } else process.stdout.write(json);
})();
