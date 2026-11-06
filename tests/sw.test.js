// The offline cache must list every file the app loads, or the iPad breaks when offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

test('sw.js caches every js file', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const listed = [...sw.matchAll(/'(\w+)'/g)].map((m) => m[1]);
  const files = readdirSync(new URL('../js/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => f.replace('.js', ''));
  assert.deepEqual(files.filter((f) => !listed.includes(f)), []);
});
