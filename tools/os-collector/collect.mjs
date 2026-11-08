#!/usr/bin/env node
// OS-insamlaren — se README.md. Skickar aldrig hemligheter; varje källa har vitlista.
// Användning: node collect.mjs [--dry]   (--dry skriver JSON till stdout i stället för att skicka)
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { apps, skills, plugins, mcps, runs, kbGraph } from './sources.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../..');               // Claude Co-Work OS
const OS = join(ROOT, 'AI Native OS');
const CLAUDE = join(homedir(), '.claude');
const ENDPOINT = 'https://ncgxerxkgoxptcwvramn.supabase.co/functions/v1/os-ingest';

// Titthål för den dolda timkörningen: steg med klockslag, aldrig data eller nycklar.
const LOG = join(homedir(), '.os-ingest', 'last-run.log');
writeFileSync(LOG, '');
const step = (m) => appendFileSync(LOG, `${new Date().toISOString()} ${m}\n`);
step(`start cwd=${process.cwd()}`);

async function ping(url) {
  const at = new Date().toISOString();
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) });
    return { ok: r.status < 400, code: r.status, at };
  } catch { return { ok: false, code: 0, at }; }
}

const installedPath = join(CLAUDE, 'plugins', 'installed_plugins.json');
const installed = JSON.parse(readFileSync(installedPath, 'utf8')).plugins ?? {};
const skillSources = [
  { path: join(CLAUDE, 'skills'), origin: 'egen' },
  ...Object.entries(installed).map(([k, [i]]) => ({ path: join(i.installPath, 'skills'), origin: `plugin:${k.split('@')[0]}` })),
];

const appItems = apps(join(OS, '10_REGISTRY', 'Projects Registry.md'), ROOT);
step(`appar ${appItems.length}`);
await Promise.all(appItems.map(async (a) => { if (a.data.liveUrl) a.data.live = await ping(a.data.liveUrl); }));
step('ping klart');

const all = [
  ...appItems,
  ...skills(skillSources),
  ...plugins(installedPath),
  ...mcps(join(homedir(), '.claude.json'), join(OS, '07_MCP', 'MCP Inventory.md')),
  ...runs(join(ROOT, 'Apps & Dashboards')),
  ...kbGraph(join(ROOT, 'Knowledge Base')),
];
const items = [...new Map(all.map((i) => [`${i.kind}\u0000${i.id}`, i])).values()];   // samma id två gånger → behåll sista
const body = { kinds: ['app', 'skill', 'mcp', 'plugin', 'run', 'kb'], items };

if (process.argv.includes('--dry')) { console.log(JSON.stringify(body, null, 1)); process.exit(0); }

step(`samlat ${items.length} poster`);
const secret = readFileSync(join(homedir(), '.os-ingest', 'secret'), 'utf8').trim();
step('skickar');
const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-os-secret': secret },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(60000),
});
const answer = await res.text();
step(`svar ${res.status} ${answer.slice(0, 200)}`);
console.log(res.status, answer);
step('klart');
process.exit(res.ok ? 0 : 1);
