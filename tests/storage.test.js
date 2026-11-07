// Older saves keep working: missing fields get defaults, and nothing is lost.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const { loadState, saveState, makeProfile } = await import('../js/storage.js');
const KEY = 'mathquest.v1';
beforeEach(() => store.clear());

test('a fresh start has two players', () => {
  const s = loadState();
  assert.equal(s.profiles.length, 2);
  assert.equal(s.pin, '');
  assert.deepEqual(s.grownups, []);
});

test('an old save gets new fields without losing progress', () => {
  store.set(KEY, JSON.stringify({
    profiles: [{ id: 'k1', name: 'Sam', grade: 4, avatar: '🦊', coins: 42, best: { multfacts: 3 }, buddy: 'owl',
      history: [{ t: 1, topic: 'multfacts', level: 2, firstTry: 8 }, { t: 2, topic: 'speed', level: 1, speed: 12, coins: 12 }] }],
  }));
  const p = loadState().profiles[0];
  assert.equal(p.coins, 42);
  assert.deepEqual(p.best, { 'multfacts:2': 3 }, 'old per-topic stars move to Medium');
  assert.deepEqual(p.focus, []);
  assert.equal(p.tellGrownUp, true);
  assert.equal(p.questCount, 2);
  assert.deepEqual(p.owned.extras, []);
  assert.equal(p.buddyXp.owl, 8 * 2 + 12, 'the current buddy keeps credit for past rounds');
  assert.equal(p.wordSteps, false);
  assert.deepEqual(p.speed, { best: {}, missed: {} });
});

test('saving and loading round-trips', () => {
  const s = loadState();
  s.profiles[0].coins = 99;
  saveState(s);
  assert.equal(loadState().profiles[0].coins, 99);
});

test('a corrupted save starts fresh instead of crashing', () => {
  store.set(KEY, '{not json');
  assert.equal(loadState().profiles.length, 2);
});

test('new players start with sensible defaults', () => {
  const p = makeProfile('Ivy', 3, '🐼');
  assert.equal(p.grade, 3);
  assert.equal(p.level, 2);
  assert.equal(p.buddy, 'cat');
});
