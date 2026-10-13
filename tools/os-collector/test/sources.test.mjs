import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { skills, plugins, mcps } from '../sources.mjs';
const F = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const mcpItems = () => mcps(join(F, 'claude.json'), join(F, 'inventory.md'));

test('skill: första meningen, ursprung', () => {
  const [s] = skills([{ path: join(F, 'skills'), origin: 'egen' }]);
  assert.deepEqual(s, { kind: 'skill', id: 'egen:demo', data: { name: 'demo', summary: 'Gör en sak.', origin: 'egen' } });
});

test('mcp: inga hemligheter lämnar datorn', () => {
  const s = JSON.stringify(mcpItems());
  for (const bad of ['hemlig', 'sk-', 'Bearer', 'key=', 'args', 'env', 'server.js']) assert.ok(!s.includes(bad), bad);
  const moln = mcpItems().find((i) => i.id === 'moln');
  assert.equal(moln.data.host, 'mcp.example.com');
  assert.equal(moln.data.transport, 'http');
});

test('mcp: inventory-rad utan lokal konfig blir connector', () => {
  const gmail = mcpItems().find((i) => i.id === 'gmail');
  assert.equal(gmail.data.transport, 'connector');
  assert.equal(gmail.data.status, 'Active');
});

test('mcp: lokal + inventory slås ihop på namn utan skiftlägeskänslighet', () => {
  const lokal = mcpItems().filter((i) => i.id === 'lokal');
  assert.equal(lokal.length, 1);
  assert.equal(lokal[0].data.status, 'Active');
  assert.equal(lokal[0].data.transport, 'stdio');
});

test('plugin: räknar skills', () => {
  const tmp = join(mkdtempSync(join(tmpdir(), 'osc-')), 'installed.json');
  writeFileSync(tmp, readFileSync(join(F, 'installed_plugins.json'), 'utf8')
    .replace('__FIXTURES__', F.replace(/\\/g, '/')));
  const [p] = plugins(tmp);
  assert.equal(p.id, 'demo@market');
  assert.equal(p.data.skills, 1);
  assert.equal(p.data.version, '1.0.0');
});

import { runs } from '../sources.mjs';
test('run: metadata, inga repro/utfall/sökvägar, beslut flaggas', () => {
  const [r] = runs(join(F, 'apps'));
  assert.equal(r.id, 'Demo/r1');
  assert.equal(r.data.verdict, 'NOT READY');
  assert.deepEqual(r.data.reviewers.code, { agent: 'code-reviewer-f1', ids: ['CR-001'] });
  assert.equal(r.data.gates.find((g) => g.name === 'build').at, '2026-10-01T11:30:00Z');
  const f = r.data.findings[0];
  assert.equal(f.needsMats, true);
  assert.deepEqual(f.evidence, ['CR-001.txt']);
  const s = JSON.stringify(r);
  for (const bad of ['HEMLIG', 'hemlig', 'repro', 'actual']) assert.ok(!s.includes(bad), bad);
});
