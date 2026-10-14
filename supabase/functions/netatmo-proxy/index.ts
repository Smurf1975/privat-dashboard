// netatmo-proxy — uppmätt väder från andras publika Netatmo-stationer runt Väster, Nyköping.
// Läser bara publik data (getpublicdata, scope read_station). Öppen som weather-proxy: svaret är
// ett offentligt väderaggregat, och cachen (10 min i netatmo_cache) gör att Netatmo anropas högst
// sex gånger i timmen oavsett trafik.
// Secrets (Supabase): NETATMO_CLIENT_ID, NETATMO_CLIENT_SECRET, NETATMO_REFRESH_TOKEN (startnyckel
// från Netatmos token-generator). Netatmo byter refresh-token vid varje förnyelse → den nya sparas
// i netatmo_auth och används därefter; secreten läses bara när tabellen är tom.
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ORIGINS = new Set(["https://privat-dashboard-inky.vercel.app", "http://localhost:8117"]);
const CENTER = { lat: 58.7525, lon: 17.0023, name: "Väster, Nyköping" };
const BOX = { dLat: 0.02, dLon: 0.04 };          // ≈ ±2,2 km åt alla håll
const TTL_MS = 10 * 60 * 1000;
const MAX_AGE_S = 60 * 60;                       // mätvärden äldre än 1 h räknas inte

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") ?? "";
  return ORIGINS.has(o) ? { "Access-Control-Allow-Origin": o, "Vary": "Origin" } : {};
}

async function accessToken(): Promise<string> {
  const { data: row } = await db.from("netatmo_auth").select("*").eq("id", "me").maybeSingle();
  if (row?.access_token && row.expires_at && new Date(row.expires_at).getTime() > Date.now() + 60_000) return row.access_token;
  const refresh = row?.refresh_token ?? Deno.env.get("NETATMO_REFRESH_TOKEN");
  const id = Deno.env.get("NETATMO_CLIENT_ID"), secret = Deno.env.get("NETATMO_CLIENT_SECRET");
  if (!refresh || !id || !secret) throw new Error("not_connected");
  const res = await fetch("https://api.netatmo.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: id, client_secret: secret }),
  });
  const t = await res.json().catch(() => ({}));
  if (!res.ok || !t.access_token) throw new Error(`token_${res.status}_${t.error ?? "unknown"}`);
  await db.from("netatmo_auth").upsert({
    id: "me", access_token: t.access_token, refresh_token: t.refresh_token ?? refresh,
    expires_at: new Date(Date.now() + (t.expires_in ?? 10800) * 1000).toISOString(), updated_at: new Date().toISOString(),
  });
  return t.access_token;
}

const median = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2);
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10;
};

// getpublicdata: body[] = { _id, place:{location:[lon,lat]}, measures:{ <modul>: {res:{<ts>:[v…]}, type:[…]}
//   | {rain_60min, rain_24h, rain_timeutc} | {wind_strength, gust_strength, wind_angle, wind_timeutc} } }
function aggregate(body: Record<string, unknown>[]) {
  const now = Date.now() / 1000;
  const v: Record<string, number[]> = { temperature: [], humidity: [], pressure: [], rain_60min: [], rain_24h: [], wind_strength: [], gust_strength: [] };
  let newest = 0;
  for (const st of body) {
    for (const m of Object.values((st.measures ?? {}) as Record<string, Record<string, unknown>>)) {
      if (m.res && Array.isArray(m.type)) {
        for (const [ts, vals] of Object.entries(m.res as Record<string, number[]>)) {
          if (now - Number(ts) > MAX_AGE_S) continue;
          newest = Math.max(newest, Number(ts));
          (m.type as string[]).forEach((k, i) => { if (v[k] && typeof vals[i] === "number") v[k].push(vals[i]); });
        }
      }
      if (typeof m.rain_timeutc === "number" && now - m.rain_timeutc <= MAX_AGE_S) {
        if (typeof m.rain_60min === "number") v.rain_60min.push(m.rain_60min);
        if (typeof m.rain_24h === "number") v.rain_24h.push(m.rain_24h);
      }
      if (typeof m.wind_timeutc === "number" && now - m.wind_timeutc <= MAX_AGE_S) {
        if (typeof m.wind_strength === "number") v.wind_strength.push(m.wind_strength);
        if (typeof m.gust_strength === "number") v.gust_strength.push(m.gust_strength);
      }
    }
  }
  const kmh = (x: number | null) => x == null ? null : Math.round(x / 3.6 * 10) / 10;   // Netatmo ger km/h
  return {
    place: CENTER.name, stations: body.length,
    temp: median(v.temperature), humidity: median(v.humidity), pressure: median(v.pressure),
    rain1h: median(v.rain_60min), rain24h: median(v.rain_24h),
    wind: kmh(median(v.wind_strength)), gust: kmh(median(v.gust_strength)),
    counts: Object.fromEntries(Object.entries(v).map(([k, a]) => [k, a.length])),
    measuredAt: newest ? new Date(newest * 1000).toISOString() : null,
  };
}

Deno.serve(async (req) => {
  const h = { "Content-Type": "application/json", ...cors(req) };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: h });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...h, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
  if (req.method !== "GET") return json(405, { error: "method not allowed" });

  const { data: cached } = await db.from("netatmo_cache").select("data,fetched_at").eq("id", "vaster").maybeSingle();
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < TTL_MS) return json(200, { ...cached.data, fetchedAt: cached.fetched_at, cached: true });

  try {
    const token = await accessToken();
    const q = new URLSearchParams({
      lat_ne: String(CENTER.lat + BOX.dLat), lon_ne: String(CENTER.lon + BOX.dLon),
      lat_sw: String(CENTER.lat - BOX.dLat), lon_sw: String(CENTER.lon - BOX.dLon), filter: "true",
    });
    const res = await fetch(`https://api.netatmo.com/api/getpublicdata?${q}`, { headers: { Authorization: `Bearer ${token}` } });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(out.body)) throw new Error(`getpublicdata_${res.status}`);
    const data = aggregate(out.body);
    const fetchedAt = new Date().toISOString();
    await db.from("netatmo_cache").upsert({ id: "vaster", data, fetched_at: fetchedAt });
    return json(200, { ...data, fetchedAt, cached: false });
  } catch (e) {
    const msg = (e as Error).message;
    // Hellre gammal mätning med flagga än ingen alls.
    if (cached) return json(200, { ...cached.data, fetchedAt: cached.fetched_at, cached: true, stale: true, error: msg });
    return json(msg === "not_connected" ? 503 : 502, { error: msg });
  }
});
