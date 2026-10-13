// En funktion per typ → { kind, id, data }[]. Varje data-objekt byggs fält för fält (vitlista):
// inget skickas som inte uttryckligen plockas ut här.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseTables, clean } from './md.mjs';
import { stackOf, dbsInCode, gitInfo, liveUrl } from './scan.mjs';

const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
const frontmatter = (text) => {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return out;
};
const firstSentence = (s) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim().slice(0, 200);
const dirs = (p) => existsSync(p) ? readdirSync(p).filter((d) => statSync(join(p, d)).isDirectory()) : [];

export function skills(sources) {
  const out = [];
  for (const { path, origin } of sources) {
    for (const d of dirs(path)) {
      const f = join(path, d, 'SKILL.md');
      if (!existsSync(f)) continue;
      const fm = frontmatter(read(f));
      const name = fm.name || d;
      out.push({ kind: 'skill', id: `${origin}:${name}`, data: { name, summary: firstSentence(fm.description ?? ''), origin } });
    }
  }
  return out;
}

export function plugins(installedPath) {
  const { plugins: all = {} } = JSON.parse(read(installedPath));
  return Object.entries(all).map(([key, [inst]]) => {
    const [name, marketplace] = key.split('@');
    const p = inst.installPath;
    return { kind: 'plugin', id: key, data: {
      name, marketplace, version: inst.version, updated: inst.lastUpdated,
      skills: dirs(join(p, 'skills')).length,
      agents: existsSync(join(p, 'agents')) ? readdirSync(join(p, 'agents')).filter((f) => f.endsWith('.md')).length : 0,
      hooks: existsSync(join(p, 'hooks')),
    } };
  });
}

const slug = (s) => clean(s).toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim().replace(/\s+/g, '-');
const hostOf = (s) => { try { return new URL(s.match(/https:\/\/[^\s`)]+/)?.[0]).hostname; } catch { return null; } };

export function mcps(claudeJsonPath, inventoryPath) {
  const byId = new Map();
  const { mcpServers = {} } = JSON.parse(read(claudeJsonPath));
  for (const [name, cfg] of Object.entries(mcpServers)) {
    const data = { name, transport: cfg.url ? 'http' : 'stdio' };
    if (cfg.url) data.host = new URL(cfg.url).hostname;   // bara värdnamn — aldrig sökväg/query
    byId.set(name.toLowerCase(), { kind: 'mcp', id: name.toLowerCase(), data });
  }
  for (const t of parseTables(read(inventoryPath)).filter((t) => t.headers[0] === 'MCP')) {
    for (const r of t.rows) {
      // Inventariets namn skiljer sig ibland från konfigens ("Cloudinary" vs "cloudinary-asset-mgmt") — matcha då på värdnamn.
      const host = hostOf(r.Typ);
      const id = [...byId.values()].find((i) => host && i.data.host === host)?.id ?? slug(r.MCP);
      const prev = byId.get(id)?.data ?? { name: clean(r.MCP), transport: 'connector' };
      byId.set(id, { kind: 'mcp', id, data: { ...prev,
        status: clean(r.Status), purpose: clean(r['Primärt användningsområde']),
        consumers: clean(r.Konsumenter), risk: clean(r.Risk), verified: clean(r.Verifierad).slice(0, 10) } });
    }
  }
  return [...byId.values()];
}

// Quality-körningar: <appsDir>/<app>/quality-runs/<run>/. Bara metadata — aldrig repro, kod eller evidensinnehåll.
const REVIEW_FILES = { code: 'findings-code.json', ui: 'findings-ui.json', qa: 'findings-qa.json', sec: 'findings-security.json', diff: 'findings-diff.json' };
const tryJson = (p) => { try { return JSON.parse(read(p)); } catch { return null; } };
const trim = (s, n) => (s ?? '').length > n ? s.slice(0, n - 1) + '…' : (s ?? '');
const base = (p) => p.split(/[\\/]/).pop();
// Absoluta sökvägar på datorn (C:\Users\…) kortas till filnamnet innan något skickas.
const noPaths = (s) => (s ?? '').replace(/[A-Za-z]:[\\/][^\s"'`]*/g, (m) => base(m));
const NEEDS_MATS = /väntar (hos|på) mats|mats beslut|produktbeslut|beslut väntar/i;

export function runs(appsDir) {
  const out = [];
  for (const app of dirs(appsDir)) {
    const qr = join(appsDir, app, 'quality-runs');
    for (const name of dirs(qr)) {
      const d = join(qr, name), run = tryJson(join(d, 'run.json'));
      if (!run) continue;
      const verdict = tryJson(join(d, 'verdict.json'));
      const gatesRaw = tryJson(join(d, 'gates.json')) ?? {};
      const merged = tryJson(join(d, 'findings.json'))?.findings ?? [];
      const reviewers = {};
      for (const [k, f] of Object.entries(REVIEW_FILES)) {
        const r = tryJson(join(d, f));
        if (r) reviewers[k] = { agent: r.agent ?? null, ids: (r.findings ?? []).map((x) => x.id) };
      }
      const review = (f) => { const r = tryJson(join(d, f)); return r ? { agent: r.agent ?? null, verdict: r.verdict ?? null } : null; };
      out.push({ kind: 'run', id: `${run.project}/${name}`, data: {
        project: run.project, run: name, mode: run.mode ?? null, env: run.env ?? null, created: run.created ?? null,
        verdict: verdict?.verdict ?? null, computedAt: verdict?.computed_at ?? null,
        blockers: verdict?.blockers ?? [],
        agents: (run.agents ?? []).map((a) => ({ id: a.id, role: a.role, model: a.model ?? null, at: a.at })),
        cycles: (run.cycles ?? []).map((c) => ({ n: c.n, started: c.started, findings: c.findings ?? [] })),
        gates: Object.entries(verdict?.gates ?? {}).map(([g, v]) => ({
          name: g, status: v.status, detail: trim(noPaths(v.detail), 160), at: gatesRaw[g]?.at ?? null })),
        reviewers, second: review('second-review.json'), final: review('final-review.json'),
        findings: merged.map((f) => ({
          id: f.id, reviewer: f.reviewer, severity: f.severity, status: f.status, cycle: f.cycle ?? null,
          title: trim(f.title, 180), where: f.file ? `${f.file}${f.line ? ':' + f.line : ''}` : null,
          evidence: (f.evidence ?? []).slice(0, 8).map(base), evidenceCount: (f.evidence ?? []).length,
          verifiedBy: f.verified_by ?? null,
          needsMats: NEEDS_MATS.test(f.severity_note ?? ''),
          // Gäller fyndet ett beslut av Mats: skicka meningen som säger det, inte början av noteringen.
          note: trim(noPaths((f.severity_note ?? '').split(/(?<=[.;])\s+/).find((p) => NEEDS_MATS.test(p)) ?? f.severity_note), 240),
        })),
      } });
    }
  }
  return out;
}

export function apps(registryPath, root) {
  const t = parseTables(read(registryPath)).find((t) => t.headers[0] === 'Canonical name');
  return t.rows.map((r) => {
    const codeCell = r['Code location'] ?? '';
    const rel = codeCell.match(/`([^`]+[\\/])`/)?.[1].replace(/\\/g, '/');
    const dir = rel ? join(root, rel) : null;
    const has = !!dir && existsSync(dir) && readdirSync(dir).length > 0;
    const dbRegistry = clean(r.Database);
    const dbCode = has ? dbsInCode(dir) : [];
    const mismatch = [];
    const claim = (prefix, re, label) => {
      if (dbCode.some((d) => d.startsWith(prefix)) && !re.test(dbRegistry)) mismatch.push(`Koden använder ${label}, registret säger inte det`);
    };
    claim('neon', /neon/i, 'Neon');
    claim('firebase', /firebase|firestore/i, 'Firebase');
    claim('supabase', /supabase/i, 'Supabase');
    if (rel && !has) mismatch.push(`Kodmappen ${rel} finns inte eller är tom`);
    return { kind: 'app', id: clean(r['Canonical name']), data: {
      name: clean(r['Canonical name']), alias: clean(r.Alias), tier: clean(r.Tier),
      status: clean(r[t.headers[3]]), stackRegistry: clean(r.Stack), dbRegistry,
      codePath: rel ?? null, liveUrl: liveUrl(codeCell) ?? liveUrl(r[t.headers[3]] ?? ''), repo: codeCell.match(/GitHub `([^`]+)`/)?.[1] ?? null,
      stackCode: has ? stackOf(dir) : [], dbCode, git: has ? gitInfo(dir) : null, mismatch,
    } };
  });
}
