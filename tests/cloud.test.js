// ☁️ Family accounts: signing up, logging in on another device, and keeping devices in step.
// Each "device" has its own saved data and its own copy of the sync code; they share one
// stand-in Firebase (tests/fakecloud.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCloud } from './fakecloud.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
globalThis.localStorage = memory();
const { defaultState, makeProfile } = await import('../js/storage.js');

let n = 0;
async function device(server) {
  const storage = memory();
  const C = await import(`../js/cloud.js?device=${++n}`);
  C.setConfig({ apiKey: 'test-key', projectId: 'x' });
  C.setHttp(server.fetch);
  const state = defaultState();
  // Every call runs with this device's saved data.
  const on = (fn) => async (...args) => {
    globalThis.localStorage = storage;
    return fn(...args);
  };
  return {
    state, C,
    signUp: on((e, pw) => C.signUp(e, pw)),
    logIn: on((e, pw) => C.logIn(e, pw)),
    sync: on((opts) => {
      C.stamp(dev.state);
      return C.sync(dev.state, opts);
    }),
    familyPlayers: on(() => C.familyPlayers()),
    deleteFamily: on((pw) => C.deleteFamily(pw)),
    session: on(() => C.session()),
  };
  // (dev is set below so sync can see a replaced state)
}
let dev;
const make = async (server) => (dev = await device(server));
const play = (p, coins, t = Date.now()) => {
  p.coins += coins;
  p.history.unshift({ t, topic: 'multfacts', level: 2, firstTry: coins, byTopic: { multfacts: [10, coins] } });
};
// Runs a step on a device (so its sync sees its own state).
const on = async (d, fn) => {
  dev = d;
  return fn(d);
};

test('signing up saves this device’s players; another device logs in and gets them', async () => {
  const server = fakeCloud();
  const a = await make(server);
  a.state.profiles[0].name = 'Sam';
  play(a.state.profiles[0], 8);
  a.state.grownups = [{ id: 'g1', name: 'Mom', salt: 'aa', hash: 'bb' }];
  await on(a, () => a.signUp('Parent@Example.com ', 'secret1'));
  await on(a, () => a.sync());
  assert.equal([...server.docs.keys()].filter((k) => k.includes('/kids/')).length, 2);

  const b = await make(server);
  await on(b, () => b.logIn('parent@example.com', 'secret1'));
  const players = await on(b, () => b.familyPlayers());
  assert.deepEqual(players.map((p) => p.name).sort(), ['Player 2', 'Sam']);
  b.state.profiles = []; // a new device's blank players aren't kept
  assert.equal(await on(b, () => b.sync()), true);
  assert.equal(b.state.profiles.find((p) => p.name === 'Sam').coins, 8);
  assert.deepEqual(b.state.grownups.map((g) => g.name), ['Mom'], 'grown-up logins come along');
});

test('changes on one device show up on the other', async () => {
  const server = fakeCloud();
  const a = await make(server);
  await on(a, () => a.signUp('fam@example.com', 'secret1'));
  await on(a, () => a.sync());
  const b = await make(server);
  await on(b, () => b.logIn('fam@example.com', 'secret1'));
  b.state.profiles = [];
  await on(b, () => b.sync());

  // Different kids on different devices at the same time: both are kept.
  await on(a, () => a.sync());
  play(a.state.profiles[0], 7);
  play(b.state.profiles.find((p) => p.id === a.state.profiles[1].id), 9);
  await on(a, () => a.sync());
  await on(b, () => b.sync());
  await on(a, () => a.sync());
  const [k1, k2] = a.state.profiles.map((p) => p.id);
  for (const d of [a, b]) {
    assert.equal(d.state.profiles.find((p) => p.id === k1).coins, 7);
    assert.equal(d.state.profiles.find((p) => p.id === k2).coins, 9);
  }

  // A player deleted on one device goes away on the other.
  a.state.profiles = a.state.profiles.filter((p) => p.id !== k2);
  await on(a, () => a.sync());
  await on(b, () => b.sync());
  assert.deepEqual(b.state.profiles.map((p) => p.id), [k1]);
});

test('the same player changed on two devices while apart: the newer change wins', async () => {
  const server = fakeCloud();
  const a = await make(server);
  await on(a, () => a.signUp('fam@example.com', 'secret1'));
  await on(a, () => a.sync());
  const b = await make(server);
  await on(b, () => b.logIn('fam@example.com', 'secret1'));
  b.state.profiles = [];
  await on(b, () => b.sync());
  const id = a.state.profiles[0].id;
  play(a.state.profiles[0], 3);
  a.C.stamp(a.state, 1000);
  play(b.state.profiles.find((p) => p.id === id), 5);
  b.C.stamp(b.state, 2000);
  await on(a, () => a.sync());
  await on(b, () => b.sync());
  await on(a, () => a.sync());
  assert.equal(a.state.profiles.find((p) => p.id === id).coins, 5);
  assert.equal(b.state.profiles.find((p) => p.id === id).coins, 5);
});

test('a player in the middle of a round isn’t swapped out', async () => {
  const server = fakeCloud();
  const a = await make(server);
  await on(a, () => a.signUp('fam@example.com', 'secret1'));
  await on(a, () => a.sync());
  const b = await make(server);
  await on(b, () => b.logIn('fam@example.com', 'secret1'));
  b.state.profiles = [];
  await on(b, () => b.sync());
  play(a.state.profiles[0], 4);
  await on(a, () => a.sync());
  const id = a.state.profiles[0].id;
  await on(b, () => b.sync({ canApply: (x) => x !== id }));
  assert.equal(b.state.profiles.find((p) => p.id === id).coins, 0, 'waits');
  await on(b, () => b.sync());
  assert.equal(b.state.profiles.find((p) => p.id === id).coins, 4, 'then catches up');
});

test('offline: the game keeps going and catches up later', async () => {
  const server = fakeCloud();
  const a = await make(server);
  await on(a, () => a.signUp('fam@example.com', 'secret1'));
  await on(a, () => a.sync());
  server.offline = true;
  play(a.state.profiles[0], 6);
  await assert.rejects(on(a, () => a.sync()), (e) => e.code === 'offline');
  server.offline = false;
  await on(a, () => a.sync());
  const saved = JSON.parse(server.docs.get(`families/${(await on(a, () => a.session())).uid}/kids/${a.state.profiles[0].id}`).data.data.stringValue);
  assert.equal(saved.coins, 6);
});

test('families are kept apart', async () => {
  const server = fakeCloud();
  const a = await make(server);
  a.state.profiles[0].name = 'Sam';
  await on(a, () => a.signUp('one@example.com', 'secret1'));
  await on(a, () => a.sync());
  const other = await make(server);
  other.state.profiles = [makeProfile('Lee', 3, '🐸')];
  await on(other, () => other.signUp('two@example.com', 'secret2'));
  await on(other, () => other.sync());
  assert.deepEqual(other.state.profiles.map((p) => p.name), ['Lee']);
  // Family two's sign-in can't read family one's players.
  const s = await on(other, () => other.session());
  const uidA = (await on(a, () => a.session())).uid;
  const res = await server.fetch(`https://firestore.googleapis.com/v1/projects/x/databases/(default)/documents/families/${uidA}/kids`, { headers: { Authorization: `Bearer ${s.idToken}` } });
  assert.equal(res.status, 403);
});

test('plain-words errors, and deleting a family removes everything', async () => {
  const server = fakeCloud();
  const a = await make(server);
  await on(a, () => a.signUp('fam@example.com', 'secret1'));
  await on(a, () => a.sync());
  const b = await make(server);
  await assert.rejects(on(b, () => b.logIn('fam@example.com', 'wrong12')), /don’t match/);
  await assert.rejects(on(b, () => b.signUp('fam@example.com', 'secret1')), /already an account/);
  await assert.rejects(on(b, () => b.signUp('new@example.com', '123')), /at least 6/);
  await assert.rejects(on(a, () => a.deleteFamily('wrong12')), /don’t match/);
  await on(a, () => a.deleteFamily('secret1'));
  assert.equal(server.docs.size, 0);
  assert.equal(server.users.size, 0);
  assert.equal(await on(a, () => a.session()), null);
});
