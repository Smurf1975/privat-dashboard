// os-ingest — tar emot insamlarens ögonblicksbild av AI Native OS.
// Kontrakt: docs/superpowers/specs/2026-10-12-os-flik-design.md
// Auth: header "x-os-secret" mot två Vault-nycklar (current + previous), konstant tid.
// Semantik: varje kind i body.kinds ersätts helt — upsert av skickade poster, radering av övriga i samma kind.
// Ingen CORS: anropas bara från datorns insamlare, aldrig från webbläsaren.
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const KINDS = new Set(["app", "skill", "mcp", "plugin", "run"]);
const MAX_BODY_BYTES = 5 * 1024 * 1024;

function constantTimeEq(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method not allowed" });
  const provided = req.headers.get("x-os-secret") ?? "";
  if (!provided) return json(401, { error: "unauthorized" });
  const { data: secrets, error: sErr } = await supabase.rpc("os_get_ingest_secrets");
  if (sErr || !secrets?.length) return json(503, { error: "auth backend unavailable" });
  if (!secrets.some((r: { secret: string }) => r.secret && constantTimeEq(provided, r.secret)))
    return json(401, { error: "unauthorized" });

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return json(413, { error: "payload too large" });
  let body: { kinds?: unknown; items?: unknown };
  try { body = JSON.parse(text); } catch { return json(400, { error: "invalid json" }); }
  const kinds = Array.isArray(body.kinds) ? body.kinds.filter((k) => KINDS.has(k as string)) as string[] : [];
  const items = Array.isArray(body.items) ? body.items : [];
  if (!kinds.length) return json(400, { error: "no valid kinds" });
  const now = new Date().toISOString();
  const rows: { kind: string; id: string; data: unknown; collected_at: string }[] = [];
  for (const it of items as Record<string, unknown>[]) {
    if (!it || !kinds.includes(it.kind as string) || typeof it.id !== "string" || !it.id
        || typeof it.data !== "object" || it.data === null) return json(400, { error: "invalid item" });
    rows.push({ kind: it.kind as string, id: it.id, data: it.data, collected_at: now });
  }

  const { data: log } = await supabase.from("os_collect_log").insert({ status: "running" }).select("id").single();
  const errs: string[] = [];
  let removed = 0;
  if (rows.length) {
    const { error } = await supabase.from("os_items").upsert(rows, { onConflict: "kind,id" });
    if (error) errs.push(error.message);
  }
  if (!errs.length) {
    // Radera det som inte längre finns: allt i typen som inte fick ny collected_at nu.
    for (const k of kinds) {
      const { error, count } = await supabase.from("os_items").delete({ count: "exact" })
        .eq("kind", k).lt("collected_at", now);
      if (error) errs.push(error.message); else removed += count ?? 0;
    }
  }
  const counts = Object.fromEntries(kinds.map((k) => [k, rows.filter((r) => r.kind === k).length]));
  const status = errs.length ? "error" : "ok";
  if (log?.id) await supabase.from("os_collect_log").update({
    completed_at: new Date().toISOString(), status, counts,
    error_summary: errs.join(" | ").slice(0, 500) || null,
  }).eq("id", log.id);
  return json(errs.length ? 500 : 200, { status, upserted: rows.length, removed });
});
