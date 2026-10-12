import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stackOf, dbsInCode, liveUrl } from '../scan.mjs';
const F = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('stack ur package.json', () => assert.deepEqual(stackOf(join(F, 'app-next')), ['next 15.1.0', 'react 19.0.0']));
test('stack ur pubspec', () => assert.deepEqual(stackOf(join(F, 'app-flutter')), ['flutter']));
test('supabase-ref i koden', () => assert.deepEqual(dbsInCode(join(F, 'app-next')), ['supabase:abcdefghijklmnopqrst']));
test('live-url ur registercell', () =>
  assert.equal(liveUrl('`x/` → GitHub `a/b` → https://ankare.vercel.app'), 'https://ankare.vercel.app'));
