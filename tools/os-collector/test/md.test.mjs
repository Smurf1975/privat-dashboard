import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTables, clean } from '../md.mjs';

test('parsar en tabell med rubriker', () => {
  const md = 'intro\n\n| A | B |\n|---|---|\n| 1 | **två** |\n| 3 | `x` |\n\nslut';
  const [t] = parseTables(md);
  assert.deepEqual(t.headers, ['A', 'B']);
  assert.deepEqual(t.rows, [{ A: '1', B: '**två**' }, { A: '3', B: '`x`' }]);
});

test('escapad pipe i wikilänk delar inte cellen', () => {
  const [t] = parseTables('| A | B |\n|---|---|\n| [[a/b/Project Context\\|Project Context]] | z |');
  assert.equal(t.rows[0].B, 'z');
  assert.equal(clean(t.rows[0].A), 'Project Context');
});

test('clean städar markdown', () => {
  assert.equal(clean('**v2 LIVE** `main`'), 'v2 LIVE main');
  assert.equal(clean('[[AI Native OS/04_APPS/Ankare/Project Context]]'), 'Project Context');
});

test('flera tabeller', () => {
  assert.equal(parseTables('| A |\n|---|\n| 1 |\n\ntext\n\n| B |\n|---|\n| 2 |').length, 2);
});
