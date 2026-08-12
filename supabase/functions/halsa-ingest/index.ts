// halsa-ingest — tar emot hälsodata (Health Connect Webhook m.fl.) och skriver
// till det kanoniska halsa_-schemat. Kontrakt: docs/HEALTH-ARCHITECTURE.md i repot.
//
// Auth: header "x-halsa-secret" jämförs (konstant tid) mot två Vault-nycklar
// (current + previous) → nyckelrotation utan driftavbrott.
// Idempotens (Ä1/Ä2): upsert mot dedup-nyckeln; återlevererade poster uppdaterar.
// source = transport (Ä5): denna funktion sätter alltid 'hc_webhook' om inte
// anroparen anger en känd transport i fältet "source" (samsung_export | manual).

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_BODY_BYTES = 20 * 1024 * 1024;  // första synken (48h, täta pulsserier) kan vara stor
const ALLOWED_SOURCES = new Set(["hc_webhook", "samsung_export", "manual"]);

// Payloadnycklar → kanonisk metric + enhet + kandidatfält för värdet.
// ponytail: fältnamnen antas från HC Webhooks dokumentation; verifieras mot
// verklig payload i Fas 1 — okända nycklar/format räknas som skipped, aldrig krasch.
const METRICS: Record<string, { metric: string; unit: string; fields: string[] }> = {
  steps:                  { metric: "steps",              unit: "count", fields: ["count", "value", "steps"] },
  // Verifierat mot verklig payload 2026-08-12: bucketade pulsposter har avg/min/max
  heart_rate:             { metric: "heart_rate",         unit: "bpm",   fields: ["bpm", "beats_per_minute", "avg", "value"] },
  resting_heart_rate:     { metric: "resting_heart_rate", unit: "bpm",   fields: ["bpm", "beats_per_minute", "avg", "value"] },
  heart_rate_variability: { metric: "hrv",                unit: "ms",    fields: ["rmssd", "heart_rate_variability_millis", "value"] },
  weight:                 { metric: "weight_kg",          unit: "kg",    fields: ["weight_kg", "kilograms", "weight", "value"] },
  body_fat:               { metric: "body_fat_pct",       unit: "pct",   fields: ["percentage", "body_fat_percentage", "value"] },
  lean_body_mass:         { metric: "lean_body_mass_kg",  unit: "kg",    fields: ["mass_kg", "kilograms", "value"] },
  height:                 { metric: "height_m",           unit: "m",     fields: ["height_m", "meters", "value"] },
  active_calories:        { metric: "active_calories",    unit: "kcal",  fields: ["energy_kcal", "calories", "kilocalories", "value"] },
  total_calories:         { metric: "total_calories",     unit: "kcal",  fields: ["energy_kcal", "calories", "kilocalories", "value"] },
  distance:               { metric: "distance_m",         unit: "m",     fields: ["distance_meters", "meters", "value"] },
  oxygen_saturation:      { metric: "spo2_pct",           unit: "pct",   fields: ["percentage", "value"] },
  vo2_max:                { metric: "vo2_max",            unit: "ml/kg/min", fields: ["vo2_max", "value"] },
};

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
function iso(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function recTimes(r: Record<string, unknown>) {
  const start = iso(r.start_time) ?? iso(r.time) ?? iso(r.timestamp);
  const end = iso(r.end_time);
  return { start, end };
}
function constantTimeEq(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// Stora payloads: upsert i batchar så PostgREST-anropen håller sig rimliga.
async function chunkUpsert(table: string, rows: Record<string, unknown>[], onConflict: string): Promise<string | null> {
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 1000), { onConflict });
    if (error) return error.message;
  }
  return null;
}

let cachedSecrets: string[] | null = null;
async function validSecrets(): Promise<string[]> {
  if (cachedSecrets) return cachedSecrets;
  const { data, error } = await supabase.rpc("halsa_get_ingest_secrets");
  if (error || !data?.length) throw new Error("secrets unavailable");
  cachedSecrets = data.map((r: { secret: string }) => r.secret).filter(Boolean);
  return cachedSecrets!;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
  }

  const provided = req.headers.get("x-halsa-secret") ?? "";
  let ok = false;
  try {
    const secrets = await validSecrets();
    ok = provided.length > 0 && secrets.some((s) => constantTimeEq(provided, s));
  } catch {
    return new Response(JSON.stringify({ error: "auth backend unavailable" }), { status: 503 });
  }
  if (!ok) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "payload too large" }), { status: 413 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text);
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
  }

  const source = ALLOWED_SOURCES.has(payload.source as string) ? payload.source as string : "hc_webhook";

  const { data: logRow } = await supabase
    .from("halsa_ingest_log")
    .insert({ source, status: "running" })
    .select("id").single();
  const logId = logRow?.id;

  let received = 0, upserted = 0, skipped = 0, errors = 0;
  let latestTs: string | null = null;
  const errMsgs: string[] = [];
  const bump = (ts: string | null) => { if (ts && (!latestTs || ts > latestTs)) latestTs = ts; };

  // Metrics
  const metricRows: Record<string, unknown>[] = [];
  for (const [key, cfg] of Object.entries(METRICS)) {
    const arr = payload[key];
    if (!Array.isArray(arr)) continue;
    for (const r of arr) {
      received++;
      if (r === null || typeof r !== "object") { skipped++; continue; }
      const { start, end } = recTimes(r);
      const value = cfg.fields.map((f) => num((r as Record<string, unknown>)[f])).find((v) => v !== null);
      if (!start || value == null) { skipped++; continue; }
      metricRows.push({ ts: start, end_ts: end, metric: cfg.metric, value, unit: cfg.unit, source, raw: r });
      bump(end ?? start);
    }
  }
  // Träningspass → exercise_minutes (duration ur start/slut)
  const exercises = payload.exercise_sessions ?? payload.exercise;
  if (Array.isArray(exercises)) {
    for (const r of exercises) {
      received++;
      if (r === null || typeof r !== "object") { skipped++; continue; }
      const { start, end } = recTimes(r);
      if (!start || !end) { skipped++; continue; }
      const minutes = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
      if (minutes <= 0) { skipped++; continue; }
      metricRows.push({ ts: start, end_ts: end, metric: "exercise_minutes", value: Math.round(minutes), unit: "min", source, raw: r });
      bump(end);
    }
  }
  // Okända arraynycklar → skipped (defensivt, aldrig gissning)
  const known = new Set([...Object.keys(METRICS), "exercise_sessions", "exercise", "sleep"]);
  for (const [key, v] of Object.entries(payload)) {
    if (Array.isArray(v) && !known.has(key)) { received += v.length; skipped += v.length; }
  }

  if (metricRows.length) {
    const err = await chunkUpsert("halsa_metrics", metricRows, "metric,ts,dedup_end_ts,source");
    if (err) { errors += metricRows.length; errMsgs.push(`metrics: ${err}`); }
    else upserted += metricRows.length;
  }

  // Sömnsessioner
  if (Array.isArray(payload.sleep)) {
    const sleepRows: Record<string, unknown>[] = [];
    for (const r of payload.sleep) {
      received++;
      if (r === null || typeof r !== "object") { skipped++; continue; }
      const rec = r as Record<string, unknown>;
      const start = iso(rec.session_start_time) ?? iso(rec.start_time);
      const end = iso(rec.session_end_time) ?? iso(rec.end_time);
      if (!start || !end || end <= start) { skipped++; continue; }
      sleepRows.push({
        start_ts: start, end_ts: end, quality: num(rec.quality),
        phases: Array.isArray(rec.stages) ? rec.stages : null, source, raw: r,
      });
      bump(end);
    }
    if (sleepRows.length) {
      const err = await chunkUpsert("halsa_sleep_sessions", sleepRows, "start_ts,source");
      if (err) { errors += sleepRows.length; errMsgs.push(`sleep: ${err}`); }
      else upserted += sleepRows.length;
    }
  }

  const status = errors > 0 ? "error" : "ok";
  if (logId) {
    await supabase.from("halsa_ingest_log").update({
      completed_at: new Date().toISOString(), status,
      records_received: received, upserted_count: upserted,
      skipped_count: skipped, error_count: errors,
      latest_record_ts: latestTs,
      error_summary: errMsgs.length ? errMsgs.slice(0, 5).join(" | ").slice(0, 500) : null,
    }).eq("id", logId);
  }

  return new Response(
    JSON.stringify({ status, received, upserted, skipped, errors }),
    { status: errors > 0 ? 500 : 200, headers: { "Content-Type": "application/json" } },
  );
});
