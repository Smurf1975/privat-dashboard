// trafik-proxy — Trafikverkets öppna API (v2): vägkameror närmast Väster, Nyköping.
// Secret: TRAFIKVERKET_API_KEY (Mats nyckel från data.trafikverket.se). Öppen som weather-proxy —
// kamerabilderna är offentliga (PhotoUrl kräver ingen nyckel, Cache-Control: public), så klienten
// visar dem direkt; proxyn levererar bara listan. Ny datakälla sedan 2026-08-25 (nya Id:n) — därför
// hämtas kamerorna efter position, aldrig efter fasta Id:n.
const KEY = Deno.env.get("TRAFIKVERKET_API_KEY");
const ORIGINS = new Set(["https://privat-dashboard-inky.vercel.app", "http://localhost:8117"]);
const CENTER = { lon: 17.0023, lat: 58.7525 };   // Väster

const km = (lon: number, lat: number) => {
  const R = 6371, r = Math.PI / 180;
  const a = Math.sin((lat - CENTER.lat) * r / 2) ** 2
    + Math.cos(CENTER.lat * r) * Math.cos(lat * r) * Math.sin((lon - CENTER.lon) * r / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
};

Deno.serve(async (req) => {
  const o = req.headers.get("origin") ?? "";
  const h = { "Content-Type": "application/json", ...(ORIGINS.has(o) ? { "Access-Control-Allow-Origin": o, "Vary": "Origin" } : {}) };
  const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: h });
  if (req.method !== "GET") return json(405, { error: "method not allowed" });
  if (!KEY) return json(503, { error: "not_connected" });
  if (new URL(req.url).searchParams.get("what") === "weather") {
    try {
      const res = await fetch("https://api.trafikinfo.trafikverket.se/v2/data.json", {
        method: "POST", headers: { "Content-Type": "text/xml" },
        body: `<REQUEST><LOGIN authenticationkey="${KEY}"/>
          <QUERY objecttype="WeatherMeasurepoint" schemaversion="2" limit="10">
            <FILTER><AND><EQ name="Deleted" value="false"/>
              <NEAR name="Geometry.WGS84" value="${CENTER.lon} ${CENTER.lat}" mindistance="0" maxdistance="30000"/></AND></FILTER>
          </QUERY></REQUEST>`,
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) return json(502, { error: `trafikverket_${res.status}` });
      const st = (out?.RESPONSE?.RESULT?.[0]?.WeatherMeasurepoint ?? [])
        .map((s: Record<string, any>) => {
          const [lon, lat] = (String(s.Geometry?.WGS84 ?? "").match(/[\d.]+/g) ?? []).map(Number);
          return { s, km: lon && lat ? km(lon, lat) : 999 };
        })
        .filter((x: { s: Record<string, any> }) => x.s.Observation)
        .sort((a: { km: number }, b: { km: number }) => a.km - b.km)[0];
      if (!st) return json(200, { station: null, fetchedAt: new Date().toISOString() });
      const ob = st.s.Observation, v = (x: any) => (typeof x?.Value === "number" ? x.Value : null);
      const surface = v(ob.Surface?.Temperature), air = v(ob.Air?.Temperature), dew = v(ob.Air?.Dewpoint);
      const w = (ob.Wind ?? [])[0] ?? {};
      const p5 = ob.Aggregated5minutes?.Precipitation ?? {};
      const rain = p5.Rain === true, snow = p5.Snow === true;
      const precip = ob.Weather?.Precipitation ?? null;
      // Halkrisk: vägbanan nära/under noll är grunden; nederbörd eller vägbana vid/under daggpunkt (rimfrost) höjer.
      let risk = "unknown", why = "Vägbanans temperatur saknas";
      if (surface !== null) {
        const wet = rain || snow || (dew !== null && surface <= dew);
        if (surface <= 0.5 && wet) { risk = "high"; why = `Vägbana ${surface} °C och ${rain || snow ? "nederbörd" : "fukt (vid/under daggpunkten)"}`; }
        else if (surface <= 2) { risk = "elevated"; why = `Vägbana ${surface} °C, nära fryspunkten`; }
        else { risk = "low"; why = `Vägbana ${surface} °C`; }
      }
      return json(200, {
        station: { id: st.s.Id, name: st.s.Name, km: st.km }, sample: ob.Sample ?? null,
        surfaceTemp: surface, airTemp: air, dewpoint: dew, humidity: v(ob.Air?.RelativeHumidity),
        windSpeed: v(w.Speed), windDir: v(w.Direction), windGust: v(ob.Aggregated10minutes?.Wind?.SpeedMax),
        rain, snow, rainMm5: v(p5.RainSum), precipitation: precip,
        risk, riskWhy: why, fetchedAt: new Date().toISOString(),
      });
    } catch (e) {
      return json(502, { error: (e as Error).message });
    }
  }
  const radius = Math.min(50, Math.max(5, Number(new URL(req.url).searchParams.get("km")) || 30));
  try {
    const res = await fetch("https://api.trafikinfo.trafikverket.se/v2/data.json", {
      method: "POST", headers: { "Content-Type": "text/xml" },
      body: `<REQUEST><LOGIN authenticationkey="${KEY}"/>
        <QUERY objecttype="Camera" schemaversion="1" limit="40">
          <FILTER><AND><EQ name="Active" value="true"/><EQ name="Deleted" value="false"/>
            <NEAR name="Geometry.WGS84" value="${CENTER.lon} ${CENTER.lat}" mindistance="0" maxdistance="${radius * 1000}"/></AND></FILTER>
        </QUERY></REQUEST>`,
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return json(502, { error: `trafikverket_${res.status}` });
    const cams = (out?.RESPONSE?.RESULT?.[0]?.Camera ?? [])
      .filter((c: Record<string, unknown>) => c.PhotoUrl)
      .map((c: Record<string, any>) => {
        const [lon, lat] = (String(c.Geometry?.WGS84 ?? "").match(/[\d.]+/g) ?? []).map(Number);
        return { id: c.Id, name: c.Name, type: c.Type ?? null, direction: c.Direction ?? null,
          photoUrl: c.PhotoUrl, fullUrl: c.HasFullSizePhoto ? `${c.PhotoUrl}?type=fullsize` : c.PhotoUrl,
          photoTime: c.PhotoTime ?? null, km: lon && lat ? km(lon, lat) : null };
      })
      .sort((a: { km: number | null }, b: { km: number | null }) => (a.km ?? 999) - (b.km ?? 999));
    return json(200, { radiusKm: radius, cameras: cams, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return json(502, { error: (e as Error).message });
  }
});
