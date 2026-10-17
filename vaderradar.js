/* Väderradar (Väder-fliken). Egen zoombar karta med fyra lager:
   Regn  = RainViewer radar (api.rainviewer.com, tilecache.rainviewer.com)
   Satellit = EUMETSAT EUMETView WMS, Meteosat Third Generation IR 10,5 µm (view.eumetsat.int)
   Vind / Temp = Windys officiella embed (embed.windy.com)
   Bakgrundskarta: Esri Dark Gray Canvas (CARTO kräver numera API-nyckel). Inga nycklar.
   Kartan ligger i statisk DOM (#vr-karta) och byggs EN gång när den först syns; runtimen
   (support.js) renderar om sidan ofta, så inget här får bero på omrendering. */
(function () {
  'use strict';
  var LAT = 58.7525, LON = 17.0023;
  var RV_JSON = 'https://api.rainviewer.com/public/weather-maps.json';
  var EU_CAP = 'https://view.eumetsat.int/geoserver/mtg_fd/ows?service=WMS&version=1.3.0&request=GetCapabilities';
  var EU_WMS = 'https://view.eumetsat.int/geoserver/ows';
  var EU_LAYER = 'mtg_fd:ir105_hrfi';
  var SAT_FRAMES = 10, STEP = 10 * 60 * 1000;
  var WINDY = 'https://embed.windy.com/embed2.html?lat=' + LAT + '&lon=' + LON + '&detailLat=' + LAT + '&detailLon=' + LON +
    '&zoom=8&level=surface&product=ecmwf&marker=true&message=true&type=map&location=coordinates' +
    '&metricWind=m%2Fs&metricTemp=%C2%B0C&radarRange=-1&overlay=';

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var map = null, host = null, mode = null, frames = [], idx = 0, timer = null, playing = false;
  var token = 0, loadedAt = 0, visible = false, windyMode = null;

  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function rel(ms) {
    var m = Math.round((ms - Date.now()) / 60000);
    if (m >= -4 && m <= 4) return 'nu';
    return m < 0 ? (-m < 120 ? '−' + (-m) + ' min' : '−' + Math.round(-m / 60) + ' h') : '+' + m + ' min';
  }

  function build() {
    var L = window.L;
    map = L.map(host, {
      center: [LAT, LON], zoom: 8, minZoom: 4, maxZoom: 12,
      zoomControl: true, attributionControl: true, scrollWheelZoom: false,
      dragging: !L.Browser.mobile, tap: false
    });
    map.attributionControl.setPrefix(false);
    map.createPane('vrData').style.zIndex = 300;
    map.createPane('vrLabels').style.zIndex = 450;
    map.getPane('vrLabels').style.pointerEvents = 'none';
    var esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
    L.tileLayer(esri + 'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 16, maxZoom: 12, attribution: 'Karta © <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, HERE, Garmin, © OpenStreetMap'
    }).addTo(map);
    L.tileLayer(esri + 'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 16, maxZoom: 12, pane: 'vrLabels' }).addTo(map);
    L.circleMarker([LAT, LON], { radius: 6, color: '#0e1018', weight: 2, fillColor: '#b6f23c', fillOpacity: 1, interactive: false, pane: 'vrLabels' }).addTo(map);
    if (window.ResizeObserver) new ResizeObserver(function () { if (host.offsetWidth) map.invalidateSize(); }).observe(host);
    // Mushjulet zoomar bara efter ett klick i kartan, så sidan går att scrolla förbi den.
    map.on('click', function () { map.scrollWheelZoom.enable(); });
    host.addEventListener('mouseleave', function () { map.scrollWheelZoom.disable(); });
    if (L.Browser.mobile) $('vr-tips').textContent = 'Två fingrar: flytta och zooma';
    else $('vr-tips').textContent = 'Klicka i kartan för att zooma med mushjulet';
  }

  function clearLayers() {
    stop();
    frames.forEach(function (f) { map.removeLayer(f.layer); });
    frames = [];
  }

  function fetchJson(url) { return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r; }); }

  function loadRain() {
    return fetchJson(RV_JSON).then(function (r) { return r.json(); }).then(function (j) {
      var host_ = j.host || 'https://tilecache.rainviewer.com';
      var list = (j.radar.past || []).map(function (f) { return { t: f.time * 1000, path: f.path, now: false }; })
        .concat((j.radar.nowcast || []).map(function (f) { return { t: f.time * 1000, path: f.path, now: true }; }));
      if (!list.length) throw new Error('inga radarbilder');
      return list.map(function (f) {
        f.layer = window.L.tileLayer(host_ + f.path + '/256/{z}/{x}/{y}/2/1_1.png', {
          pane: 'vrData', opacity: 0, maxNativeZoom: 7, maxZoom: 12, minZoom: 4, keepBuffer: 2, updateWhenZooming: false,
          attribution: 'Radar © <a href="https://www.rainviewer.com" target="_blank" rel="noopener">RainViewer</a>'
        });
        return f;
      });
    });
  }

  function latestSat() {
    return fetchJson(EU_CAP).then(function (r) { return r.text(); }).then(function (x) {
      var m = /name="time"[^>]*default="([^"]+)"/.exec(x) || /default="(\d{4}-[^"]+)"/.exec(x);
      var t = m && Date.parse(m[1]);
      if (!t) throw new Error('ingen tid');
      return t;
    }).catch(function () { return Math.floor((Date.now() - 40 * 60000) / STEP) * STEP; });
  }

  function loadSat() {
    return latestSat().then(function (last) {
      var out = [];
      for (var i = SAT_FRAMES - 1; i >= 0; i--) {
        var t = last - i * STEP;
        out.push({
          t: t, now: false,
          layer: window.L.tileLayer.wms(EU_WMS, {
            layers: EU_LAYER, format: 'image/png', transparent: true, version: '1.3.0', time: new Date(t).toISOString().replace('.000Z', 'Z'),
            pane: 'vrData', opacity: 0, maxZoom: 12, minZoom: 4, keepBuffer: 2, updateWhenZooming: false,
            attribution: 'Satellit © <a href="https://www.eumetsat.int" target="_blank" rel="noopener">EUMETSAT</a>'
          })
        });
      }
      return out;
    });
  }

  function show(i) {
    if (!frames.length) return;
    idx = (i + frames.length) % frames.length;
    frames.forEach(function (f, k) { f.layer.setOpacity(k === idx ? (mode === 'sat' ? 0.9 : 0.75) : 0); });
    var f = frames[idx];
    $('vr-tid').textContent = hhmm(f.t) + ' · ' + rel(f.t) + (f.now ? ' · prognos' : '');
    $('vr-slide').value = idx;
  }

  function step() {
    // Dröjer kvar på sista bilden innan loopen börjar om.
    show(idx + 1);
    timer = setTimeout(step, idx === frames.length - 1 ? 1600 : 650);
  }
  function play() { if (playing || frames.length < 2) return; playing = true; $('vr-play').textContent = '❚❚'; $('vr-play').setAttribute('aria-label', 'Pausa'); timer = setTimeout(step, 500); }
  function stop() { playing = false; clearTimeout(timer); var b = $('vr-play'); if (b) { b.textContent = '▶'; b.setAttribute('aria-label', 'Spela'); } }

  function setStatus(msg) { $('vr-status').textContent = msg || ''; }

  function setMode(m) {
    var btns = document.querySelectorAll('[data-vr]');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-vr') === m;
      btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      btns[i].style.background = on ? 'rgba(182,242,60,0.16)' : 'transparent';
      btns[i].style.color = on ? '#b6f23c' : 'rgba(238,240,245,0.72)';
    }
    var windy = m === 'wind' || m === 'temp';
    $('vr-karta').style.visibility = windy ? 'hidden' : 'visible';
    $('vr-windy').style.display = windy ? 'block' : 'none';
    $('vr-ctl').style.display = windy ? 'none' : 'flex';
    $('vr-attr-windy').style.display = windy ? 'block' : 'none';
    $('vr-tips').style.display = windy ? 'none' : '';
    if (windy) {
      stop(); mode = m;
      if (windyMode !== m) { windyMode = m; $('vr-windy-if').src = WINDY + (m === 'wind' ? 'wind' : 'temp'); }
      setStatus('');
      return;
    }
    if (mode === m && frames.length) { map.invalidateSize(); return; }
    mode = m; var my = ++token;
    clearLayers(); setStatus('Hämtar ' + (m === 'rain' ? 'radarbilder' : 'satellitbilder') + '…');
    $('vr-ctl').style.opacity = '0.4';
    (m === 'rain' ? loadRain() : loadSat()).then(function (list) {
      if (my !== token) return;
      frames = list; loadedAt = Date.now();
      frames.forEach(function (f) { f.layer.addTo(map); });
      var s = $('vr-slide'); s.min = 0; s.max = frames.length - 1;
      // startar på senaste faktiska bilden (inte prognosen)
      var lastReal = frames.length - 1; while (lastReal > 0 && frames[lastReal].now) lastReal--;
      setStatus(''); $('vr-ctl').style.opacity = '1';
      show(lastReal);
      if (!reduce) { show(0); play(); }
    }).catch(function () {
      if (my !== token) return;
      setStatus(m === 'rain' ? 'Radarbilderna gick inte att hämta just nu.' : 'Satellitbilderna gick inte att hämta just nu.');
    });
  }

  function onVisible(v) {
    visible = v;
    if (!map) return;
    if (!v) { stop(); return; }
    map.invalidateSize();
    // gamla bilder efter lång frånvaro: ladda om aktuellt lager
    if (mode && mode !== 'wind' && mode !== 'temp' && Date.now() - loadedAt > 10 * 60000) { var m = mode; mode = null; setMode(m); }
    else if (mode && mode !== 'wind' && mode !== 'temp' && !reduce) play();
  }

  function attach(el) {
    host = el;
    if (!window.L) return false;
    build();
    setMode('rain');
    return true;
  }

  // Runtimen kan rita om sidan; hitta kartytan igen om den skulle bytas ut.
  function tick() {
    var el = $('vr-karta');
    if (!el) return;
    if (host && host !== el) { try { map.remove(); } catch (e) {} map = null; host = null; mode = null; }
    if (!host) {
      if (el.offsetWidth === 0) return;   // fliken ej öppen än: bygg först när kartan syns
      if (!attach(el)) return;
      visible = true;
    }
    var v = $('vr-kort') && $('vr-kort').offsetWidth > 0;
    if (v !== visible) onVisible(v);
  }
  setInterval(tick, 700);
  window.vaderRadar = { karta: function () { return map; } };   // för felsökning i konsolen

  // Lagerknappar, spela och reglage via delegering (runtimen binder bara onclick i mallen).
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-vr]');
    if (b && map) { setMode(b.getAttribute('data-vr')); return; }
    if (e.target.closest && e.target.closest('#vr-play')) { if (playing) stop(); else play(); }
  });
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'vr-slide') { stop(); show(+e.target.value); }
  });
  // Förnya bilderna var 10:e minut när kartan syns
  setInterval(function () {
    if (visible && map && (mode === 'rain' || mode === 'sat') && Date.now() - loadedAt > 10 * 60000) { var m = mode; mode = null; setMode(m); }
  }, 60000);
})();
