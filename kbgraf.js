/* Kunskap-fliken: levande karta över Knowledge Base, ritad på canvas.
   Data: os_items kind='kb' (tools/os-collector → os-ingest, RLS: bara Mats). Filen innehåller ingen data.
   Källdokument är namnlösa punkter med flit (Mats val 2026-11-08). Rörelsen är bara kameran som vrider sig;
   det enda som blinkar är källor som verkligen kommit in senaste veckan.
   All DOM här är statisk och byggs en gång; runtimen (support.js) rör den inte. Text sätts med textContent. */
(function () {
  'use strict';
  var GROUP = { Floorball: '#6ea8fe', 'Egna finanser': '#ef6f8e', Fritid: '#c39bff', Appar: '#3fcda9', Jobb: '#efb84a',
    'Smarta Hem': '#59d0e6', Hem: '#f08f5b', Personligt: '#e7a3d8', 'Övrigt': '#9aa4b2' };
  var HUB = '#f2c14e', WEEK = 7 * 864e5, TAU = Math.PI * 2;
  var KIND = { hub: 'Mittpunkt', dom: 'Område', ent: 'Entitet', page: 'Wikisida', src: 'Källdokument' };
  var TYPE = { organisation: 'Organisation', event: 'Evenemang', person: 'Person', concept: 'Begrepp', team: 'Lag', app: 'App',
    product: 'Produkt', place: 'Plats', topics: 'Ämnessida', overviews: 'Översikt', summaries: 'Sammanfattning', guides: 'Guide',
    comparisons: 'Jämförelse', document: 'Dokument', pdf: 'PDF', link: 'Länk', file: 'Fil', web: 'Webbsida', image: 'Bild' };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var el = {}, ctx, W = 0, H = 0, dpr = 1, ready = false, pendingMsg = null;
  var G = null, generated = null, sel = -1, hover = -1, group = null, query = '';
  var cam = { x: 0, y: 0, k: 1, rot: 0 }, drag = null, wheelOn = false, dirty = true, running = false, spin = !reduce;

  function $(id) { return document.getElementById(id); }
  function make(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function rnd(i) { var x = Math.sin(i * 127.1 + 3.7) * 43758.5453; return x - Math.floor(x); }

  function build(data) {
    var N = data.nodes.map(function (n, i) {
      return { i: i, k: n.k, l: n.l || null, t: n.t || null, d: n.d || null, g: n.g || null, a: n.a || null, u: n.u || null, x: 0, y: 0, vx: 0, vy: 0, deg: 0, nb: [] };
    });
    var domGroup = {}, domNode = {};
    N.forEach(function (n) { if (n.k === 'dom') { domGroup[n.d] = GROUP[n.g] ? n.g : 'Övrigt'; domNode[n.d] = n; } });
    N.forEach(function (n) { n.grp = n.k === 'hub' ? null : (domGroup[n.d] || 'Övrigt'); n.col = n.k === 'hub' ? HUB : GROUP[n.grp]; });
    var E = data.edges.map(function (e) {
      var a = N[e[0]], b = N[e[1]];
      a.deg++; b.deg++; a.nb.push({ n: b, t: e[2] }); b.nb.push({ n: a, t: e[2] });
      return { a: a, b: b, t: e[2] };
    });
    N.forEach(function (n) { n.r = n.k === 'hub' ? 15 : n.k === 'dom' ? 6 + Math.min(7, Math.sqrt(n.deg)) : n.k === 'src' ? 2.1 : 2.8 + Math.min(6, Math.sqrt(n.deg)); });

    // Startläge: områdena på en ring, ordnade grupp för grupp; varje punkt nära sitt område.
    var doms = N.filter(function (n) { return n.k === 'dom'; }).sort(function (a, b) { return a.grp.localeCompare(b.grp, 'sv'); });
    doms.forEach(function (d, i) { var v = i / doms.length * TAU; d.x = Math.cos(v) * 340; d.y = Math.sin(v) * 340; });
    N.forEach(function (n) {
      if (n.k === 'hub' || n.k === 'dom') return;
      var d = domNode[n.d] || doms[0], v = rnd(n.i) * TAU, r = 30 + rnd(n.i + 9) * 130;
      n.x = d.x + Math.cos(v) * r; n.y = d.y + Math.sin(v) * r;
    });
    // Kraftsimulering körs färdigt direkt: samma data ger samma karta, och inget hoppar när man tittar.
    for (var it = 0; it < 240; it++) {
      var cool = 1 - it / 240, i, j;
      for (i = 0; i < N.length; i++) for (j = i + 1; j < N.length; j++) {
        var a = N[i], b = N[j], dx = a.x - b.x, dy = a.y - b.y, q = dx * dx + dy * dy + 30;
        if (q > 90000) continue;
        var f = (a.grp === b.grp ? 520 : 1500) / q;
        a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      }
      E.forEach(function (e) {
        var hubLink = e.a.k === 'hub', len = hubLink ? 330 : e.t === 'område' ? 95 : e.t === 'källa' ? 62 : 80, s = hubLink ? 0.05 : 0.035;
        var dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, f = (d - len) * s / d;
        e.a.vx += dx * f; e.a.vy += dy * f; e.b.vx -= dx * f; e.b.vy -= dy * f;
      });
      N.forEach(function (n) {
        if (n.k === 'hub') { n.x = n.y = n.vx = n.vy = 0; return; }
        n.vx -= n.x * 0.004; n.vy -= n.y * 0.004;
        n.x += Math.max(-30, Math.min(30, n.vx * cool)); n.y += Math.max(-30, Math.min(30, n.vy * cool));
        n.vx *= 0.72; n.vy *= 0.72;
      });
    }
    var maxR = 1; N.forEach(function (n) { maxR = Math.max(maxR, Math.hypot(n.x, n.y)); });
    return { N: N, E: E, maxR: maxR };
  }

  function stats() {
    clear(el.stats);
    var c = { dom: 0, ent: 0, page: 0, src: 0 };
    G.N.forEach(function (n) { if (c[n.k] != null) c[n.k]++; });
    [['Områden', c.dom], ['Entiteter', c.ent], ['Wikisidor', c.page], ['Källor', c.src], ['Kopplingar', G.E.length]].forEach(function (s) {
      var b = make('div', 'kb-stat'); b.appendChild(make('b', '', String(s[1]))); b.appendChild(make('span', '', s[0])); el.stats.appendChild(b);
    });
  }

  function legend() {
    clear(el.legend);
    var cnt = {}; G.N.forEach(function (n) { if (n.grp) cnt[n.grp] = (cnt[n.grp] || 0) + 1; });
    Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).forEach(function (g) {
      var b = make('button', 'kb-leg' + (group === g ? ' on' : '')); b.type = 'button'; b.setAttribute('aria-pressed', group === g ? 'true' : 'false');
      var d = make('i'); d.style.background = GROUP[g]; b.appendChild(d); b.appendChild(make('span', '', g)); b.appendChild(make('em', '', String(cnt[g])));
      b.onclick = function () { group = group === g ? null : g; sel = -1; legend(); panel(); dirty = true; };
      el.legend.appendChild(b);
    });
    // Källor per vecka, senaste halvåret: faktiska importdatum.
    var w = new Array(26).fill(0), now = Date.now(), recent = 0;
    G.N.forEach(function (n) {
      if (n.k !== 'src' || !n.a) return;
      var age = now - new Date(n.a).getTime(), idx = Math.floor(age / WEEK);
      if (age < WEEK) recent++;
      if (idx >= 0 && idx < 26) w[25 - idx]++;
    });
    var m = Math.max.apply(null, w.concat(1)), bars = make('div', 'kb-bars');
    bars.title = 'Nya källor per vecka, senaste 26 veckorna';
    w.forEach(function (v) { var s = make('i'); s.style.height = Math.max(v ? 3 : 1, v / m * 26) + 'px'; bars.appendChild(s); });
    el.legend.appendChild(make('div', 'kb-cap', 'Nya källor per vecka'));
    el.legend.appendChild(bars);
    el.legend.appendChild(make('div', 'kb-cap', recent + ' nya senaste veckan'));
  }

  function linkBtn(n, suffix) {
    var b = make('button', 'kb-link', (n.l || KIND[n.k]) + (suffix ? ' · ' + suffix : '')); b.type = 'button';
    b.onclick = function () { focus(n.i); };
    return b;
  }
  function panel() {
    clear(el.panel);
    if (sel < 0) { el.panel.style.display = 'none'; return; }
    el.panel.style.display = '';
    var n = G.N[sel], close = make('button', 'kb-x', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Stäng');
    close.onclick = function () { sel = -1; panel(); dirty = true; };
    el.panel.appendChild(close);
    el.panel.appendChild(make('div', 'kb-kind', (n.t && TYPE[n.t]) || KIND[n.k]));
    el.panel.appendChild(make('div', 'kb-name', n.l || 'Namnlöst källdokument'));
    var dom = n.k === 'hub' ? null : G.N.filter(function (x) { return x.k === 'dom' && x.d === n.d; })[0];
    var meta = [];
    if (dom && n.k !== 'dom') meta.push(dom.l);
    if (n.a) meta.push('Importerad ' + n.a);
    if (n.u) meta.push('Uppdaterad ' + n.u);
    meta.push(n.deg + (n.deg === 1 ? ' koppling' : ' kopplingar'));
    el.panel.appendChild(make('div', 'kb-meta', meta.join(' · ')));
    if (n.k === 'src') el.panel.appendChild(make('div', 'kb-note', 'Filnamnet stannar på datorn. Här syns bara område, typ och datum.'));
    var rel = n.nb.filter(function (x) { return x.n.k !== 'src' && x.n.k !== 'hub'; }), src = n.nb.filter(function (x) { return x.n.k === 'src'; });
    if (rel.length) {
      el.panel.appendChild(make('div', 'kb-sub', 'Hänger ihop med'));
      var list = make('div', 'kb-list');
      rel.sort(function (a, b) { return b.n.deg - a.n.deg; }).slice(0, 40).forEach(function (x) { list.appendChild(linkBtn(x.n, /område|domän|källa/.test(x.t) ? '' : x.t.replace(/_/g, ' '))); });
      el.panel.appendChild(list);
    }
    if (src.length) {
      var by = {}, dates = [];
      src.forEach(function (x) { var t = TYPE[x.n.t] || 'Övrigt'; by[t] = (by[t] || 0) + 1; if (x.n.a) dates.push(x.n.a); });
      dates.sort();
      el.panel.appendChild(make('div', 'kb-sub', src.length + (src.length === 1 ? ' källdokument' : ' källdokument')));
      el.panel.appendChild(make('div', 'kb-meta', Object.keys(by).map(function (t) { return by[t] + ' ' + t.toLowerCase(); }).join(' · ') + (dates.length ? ' · ' + dates[0] + ' till ' + dates[dates.length - 1] : '')));
    }
  }
  function focus(i) {
    sel = i; group = null; legend(); panel();
    var n = G.N[i], c = Math.cos(cam.rot), s = Math.sin(cam.rot);
    cam.k = Math.max(cam.k, 1.5 * fit()); cam.x = -(n.x * c - n.y * s) * cam.k; cam.y = -(n.x * s + n.y * c) * cam.k;
    dirty = true;
  }

  function fit() { return G ? Math.min(W, H) / 2 / (G.maxR + 50) : 1; }
  function resize() {
    var w = el.canvas.clientWidth, h = el.canvas.clientHeight;
    if (!w || !h) return;
    var first = !W;
    dpr = window.devicePixelRatio || 1; W = w; H = h;
    el.canvas.width = w * dpr; el.canvas.height = h * dpr;
    if (first && G) cam.k = fit();
    dirty = true; wake();
  }

  function shown(n) {
    if (group && n.grp !== group) return false;
    return !query || (n.l || '').toLowerCase().indexOf(query) >= 0;
  }
  function place() {
    var c = Math.cos(cam.rot), s = Math.sin(cam.rot);
    G.N.forEach(function (n) {
      n.sx = W / 2 + cam.x + (n.x * c - n.y * s) * cam.k;
      n.sy = H / 2 + cam.y + (n.x * s + n.y * c) * cam.k;
    });
  }
  function pill(text, x, y, col, strong) {
    ctx.font = (strong ? '600 ' : '500 ') + '11px "Plus Jakarta Sans",system-ui,sans-serif';
    var w = ctx.measureText(text).width + 14;
    ctx.fillStyle = 'rgba(10,14,20,0.86)'; ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 10, w, 20, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#eef0f5'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 0.5);
  }
  function draw(now) {
    place();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var focusSet = null, active = sel >= 0 ? sel : hover;
    if (active >= 0) { focusSet = new Set([active]); G.N[active].nb.forEach(function (x) { focusSet.add(x.n.i); }); }
    var filtered = group || query;

    ctx.lineWidth = 0.6; ctx.globalAlpha = focusSet || filtered ? 0.05 : 0.22;
    G.E.forEach(function (e) { ctx.strokeStyle = e.b.col; ctx.beginPath(); ctx.moveTo(e.a.sx, e.a.sy); ctx.lineTo(e.b.sx, e.b.sy); ctx.stroke(); });
    if (focusSet) {
      ctx.globalAlpha = 0.85; ctx.lineWidth = 1.2;
      G.N[active].nb.forEach(function (x) { ctx.strokeStyle = x.n.col; ctx.beginPath(); ctx.moveTo(G.N[active].sx, G.N[active].sy); ctx.lineTo(x.n.sx, x.n.sy); ctx.stroke(); });
    }
    var nowMs = Date.now(), zoom = Math.sqrt(cam.k / fit());
    G.N.forEach(function (n) {
      var on = focusSet ? focusSet.has(n.i) : (!filtered || shown(n));
      var r = n.r * Math.min(1.8, zoom);
      ctx.globalAlpha = on ? 1 : 0.13; ctx.fillStyle = n.col;
      // Bara källor som faktiskt kom in senaste veckan får blinka.
      if (n.k === 'src' && n.a && nowMs - new Date(n.a).getTime() < WEEK) {
        var p = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(now / 500 + n.i);
        ctx.save(); ctx.globalAlpha = (on ? 0.45 : 0.08) * p; ctx.beginPath(); ctx.arc(n.sx, n.sy, r + 6, 0, TAU); ctx.fill(); ctx.restore();
      }
      ctx.beginPath(); ctx.arc(n.sx, n.sy, r, 0, TAU); ctx.fill();
      if (n.k === 'hub') { ctx.strokeStyle = HUB; ctx.globalAlpha = 0.4; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(n.sx, n.sy, r + 6, 0, TAU); ctx.stroke(); }
      if (n.i === sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(n.sx, n.sy, r + 3, 0, TAU); ctx.stroke(); }
    });
    ctx.globalAlpha = 1;
    if (active < 0) {
      var cl = {};
      G.N.forEach(function (n) { if (!n.grp || (group && n.grp !== group)) return; var c = cl[n.grp] || (cl[n.grp] = { x: 0, y: 0, n: 0 }); c.x += n.sx; c.y += n.sy; c.n++; });
      Object.keys(cl).forEach(function (g) { var c = cl[g]; if (c.n >= 4) pill(g, c.x / c.n, c.y / c.n, GROUP[g], true); });
    }
    var hub = G.N.filter(function (n) { return n.k === 'hub'; })[0];
    if (hub) { ctx.fillStyle = '#10141c'; ctx.font = '700 13px "Plus Jakarta Sans",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('K', hub.sx, hub.sy + 0.5); }
    var labels = [];
    if (focusSet) focusSet.forEach(function (i) { if (G.N[i].l) labels.push(G.N[i]); });
    else if (query) G.N.forEach(function (n) { if (n.l && shown(n)) labels.push(n); });
    else if (cam.k > 1.5 * fit()) G.N.forEach(function (n) { if (n.l && n.k !== 'hub' && (n.k === 'dom' || n.deg >= 4)) labels.push(n); });
    labels.sort(function (a, b) { return b.deg - a.deg; }).slice(0, 40).forEach(function (n) {
      ctx.font = '500 11px "Plus Jakarta Sans",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      var t = n.l.length > 34 ? n.l.slice(0, 33) + '…' : n.l;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,14,20,0.9)'; ctx.strokeText(t, n.sx, n.sy + n.r + 5);
      ctx.fillStyle = '#eef0f5'; ctx.fillText(t, n.sx, n.sy + n.r + 5);
    });
    if (hover >= 0 && hover !== sel && !G.N[hover].l) pill((TYPE[G.N[hover].t] || 'Källa') + (G.N[hover].a ? ' · ' + G.N[hover].a : ''), G.N[hover].sx, G.N[hover].sy - 16, G.N[hover].col);
  }
  function loop(now) {
    if (!G || !el.canvas.offsetWidth) { running = false; return; }
    var hasFresh = G.fresh && !reduce;
    if (spin && sel < 0 && hover < 0 && !drag) { cam.rot += 0.00045; dirty = true; }
    if (dirty || hasFresh) { draw(now); dirty = false; }
    requestAnimationFrame(loop);
  }
  function wake() { if (!running && G && el.canvas.offsetWidth) { running = true; requestAnimationFrame(loop); } }

  function at(mx, my) {
    var best = -1, bd = 14 * 14;
    G.N.forEach(function (n) {
      if ((group || query) && !shown(n)) return;
      var d = (n.sx - mx) * (n.sx - mx) + (n.sy - my) * (n.sy - my);
      if (d < bd) { bd = d; best = n.i; }
    });
    return best;
  }
  function pos(e) { var r = el.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function zoomAt(f, x, y) {
    var k = Math.max(0.5 * fit(), Math.min(8 * fit(), cam.k * f)), g = k / cam.k, ox = x - W / 2, oy = y - H / 2;
    cam.x = ox - (ox - cam.x) * g; cam.y = oy - (oy - cam.y) * g; cam.k = k; dirty = true;
  }
  function wire() {
    var c = el.canvas, pts = {}, pinch = 0;
    c.addEventListener('pointerdown', function (e) {
      pts[e.pointerId] = pos(e);
      var n = Object.keys(pts).length;
      if (n === 1) { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, mouse: e.pointerType === 'mouse' }; if (drag.mouse) c.setPointerCapture(e.pointerId); }
      else { drag = null; pinch = 0; }
    });
    c.addEventListener('pointermove', function (e) {
      if (pts[e.pointerId]) pts[e.pointerId] = pos(e);
      var ids = Object.keys(pts);
      if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) zoomAt(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch = d; return;
      }
      if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        if (drag.mouse && drag.moved) { cam.x = drag.cx + dx; cam.y = drag.cy + dy; dirty = true; }
        return;
      }
      if (e.pointerType === 'mouse') { var p = pos(e), h = at(p.x, p.y); if (h !== hover) { hover = h; c.style.cursor = h >= 0 ? 'pointer' : 'grab'; dirty = true; } }
    });
    function up(e) {
      var one = Object.keys(pts).length === 1;
      delete pts[e.pointerId]; pinch = 0;
      if (one && drag && !drag.moved && e.type === 'pointerup') {
        var p = pos(e); sel = at(p.x, p.y); panel(); dirty = true; wheelOn = true; el.hint.textContent = 'Mushjulet zoomar nu';
      }
      if (one) drag = null;
    }
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', function () { if (hover >= 0) { hover = -1; dirty = true; } });
    // Mushjulet zoomar först efter klick i kartan, annars fastnar sidans scrollning (samma som väderradarn).
    el.stage.addEventListener('mouseleave', function () { wheelOn = false; el.hint.textContent = 'Klicka i kartan för att zooma med mushjulet'; });
    c.addEventListener('wheel', function (e) { if (!wheelOn) return; e.preventDefault(); var p = pos(e); zoomAt(e.deltaY < 0 ? 1.15 : 0.87, p.x, p.y); }, { passive: false });
    $('kb-in').onclick = function () { zoomAt(1.35, W / 2, H / 2); };
    $('kb-ut').onclick = function () { zoomAt(0.74, W / 2, H / 2); };
    $('kb-hem').onclick = function () { cam.x = cam.y = 0; cam.k = fit(); sel = -1; group = null; legend(); panel(); dirty = true; };
    el.spin.onclick = function () { spin = !spin; el.spin.textContent = spin ? 'Pausa' : 'Rotera'; el.spin.setAttribute('aria-pressed', spin ? 'false' : 'true'); };
    el.spin.textContent = spin ? 'Pausa' : 'Rotera';
    el.sok.addEventListener('input', function () { query = el.sok.value.trim().toLowerCase(); sel = -1; panel(); dirty = true; });
    if (window.ResizeObserver) new ResizeObserver(resize).observe(el.canvas);
    window.addEventListener('resize', resize);
  }

  function init() {
    if (ready) return true;
    el.canvas = $('kb-canvas'); if (!el.canvas) return false;
    el.stage = $('kb-stage'); el.stats = $('kb-stats'); el.legend = $('kb-legend'); el.panel = $('kb-panel');
    el.sok = $('kb-sok'); el.spin = $('kb-spin'); el.hint = $('kb-hint'); el.msg = $('kb-msg');
    ctx = el.canvas.getContext('2d'); ready = true; wire(); resize();
    if (pendingMsg != null) msg(pendingMsg);
    return true;
  }
  function msg(t) { pendingMsg = t; if (el.msg) { el.msg.textContent = t || ''; el.msg.style.display = t ? '' : 'none'; } }

  window.KbGraf = {
    // Anropas vid inloggning och var femte minut. Samma data → ingen omräkning, kartan står kvar där den är.
    setData: function (data, collectedAt) {
      if (!init()) { setTimeout(function () { window.KbGraf.setData(data, collectedAt); }, 300); return; }
      if (data.generated !== generated) {
        generated = data.generated; sel = -1; hover = -1;
        G = build(data);
        G.fresh = G.N.some(function (n) { return n.k === 'src' && n.a && Date.now() - new Date(n.a).getTime() < WEEK; });
        W = 0; resize(); stats(); legend(); panel();
      }
      var m = Math.round((Date.now() - new Date(collectedAt).getTime()) / 60000);
      $('kb-age').textContent = 'Uppdaterad ' + (m < 2 ? 'nyss' : m < 60 ? m + ' min sedan' : m < 1440 ? Math.floor(m / 60) + ' h sedan' : Math.floor(m / 1440) + ' d sedan');
      msg(''); dirty = true; wake();
    },
    message: function (t) { init(); msg(t); },
    wake: function () { if (init()) { resize(); wake(); } }
  };
})();
