// Repo-skanning för en app: stack, databaser i koden, git-läge. Läser bara metadata.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const KEY_DEPS = ['next', 'react', 'vite', 'tailwindcss', 'firebase', '@supabase/supabase-js', '@neondatabase/serverless', 'expo'];
const SKIP = new Set(['node_modules', '.git', '.next', 'build', 'dist', '.dart_tool', 'quality-runs', '.vercel', 'worktree', 'os-collector']);
const CODE_EXT = new Set(['.js', '.mjs', '.ts', '.tsx', '.jsx', '.html', '.dart', '.kt']);

export function stackOf(dir, depth = 0) {
  const out = [];
  const pj = join(dir, 'package.json');
  if (existsSync(pj)) {
    const p = JSON.parse(readFileSync(pj, 'utf8'));
    const deps = { ...p.dependencies, ...p.devDependencies };
    for (const d of KEY_DEPS) if (deps[d]) out.push(`${d} ${deps[d].replace(/^[\^~]/, '')}`);
  }
  if (existsSync(join(dir, 'pubspec.yaml'))) out.push('flutter');
  if (existsSync(join(dir, 'build.gradle.kts')) || existsSync(join(dir, 'app', 'build.gradle.kts'))) out.push('kotlin');
  if (!out.length && existsSync(join(dir, 'index.html'))) out.push('vanilla');
  // Monorepo (t.ex. backend/ + app/): ta stacken ur undermapparna, en nivå ner.
  if (!out.length && depth === 0) {
    for (const d of readdirSync(dir)) {
      if (SKIP.has(d)) continue;
      const p = join(dir, d);
      if (statSync(p).isDirectory()) out.push(...stackOf(p, 1));
    }
  }
  return [...new Set(out)];
}

function* files(dir, depth = 0) {
  if (depth > 5 || !existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    if (SKIP.has(f) || f.endsWith('-worktree')) continue;
    const p = join(dir, f);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) yield* files(p, depth + 1);
    else if (CODE_EXT.has(extname(f)) && st.size < 2_000_000) yield p;
  }
}

export function dbsInCode(dir) {
  const found = new Set();
  for (const f of files(dir)) {
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/https:\/\/([a-z0-9]{20})\.supabase\.co/g)) found.add(`supabase:${m[1]}`);
    for (const m of t.matchAll(/projectId:\s*["']([a-z0-9-]+)["']/g)) found.add(`firebase:${m[1]}`);
    if (/neon\.tech|@neondatabase\/serverless/.test(t)) found.add('neon');
  }
  return [...found].sort();
}

export function gitInfo(dir) {
  try {
    const g = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const [commit, date] = g('log', '-1', '--format=%h|%cI').split('|');
    return { commit, date, branch: g('rev-parse', '--abbrev-ref', 'HEAD'), dirty: g('status', '--porcelain').length > 0 };
  } catch { return null; }
}

export const liveUrl = (cell) => cell.match(/https:\/\/[^\s`|)*,]+/)?.[0].replace(/[.:;]+$/, '') ?? null;
