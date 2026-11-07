// Grown-up logins: usernames, scrambled passcodes, and who can log in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../js/accounts.js';

test('a grown-up can log in with their username and passcode', async () => {
  const state = { grownups: [], pin: '' };
  assert.equal(A.loginsOn(state), false, 'no logins yet: the page is open');
  await A.addGrownup(state, ' Mom ', 'sunflower');
  await A.addGrownup(state, 'Dad', '2468');
  assert.equal(A.loginsOn(state), true);
  assert.equal((await A.logIn(state, 'mom', 'sunflower'))?.name, 'Mom', 'username ignores capitals and spaces');
  assert.equal((await A.logIn(state, 'Dad', '2468'))?.name, 'Dad');
  assert.equal(await A.logIn(state, 'Mom', '2468'), null, "someone else's passcode doesn't work");
  assert.equal(await A.logIn(state, 'Mom', 'Sunflower'), null, 'passcodes care about capitals');
  assert.equal(await A.logIn(state, 'Grandma', 'sunflower'), null);
});

test('passcodes are never saved as typed', async () => {
  const state = { grownups: [] };
  const a = await A.addGrownup(state, 'Mom', 'sunflower');
  const b = await A.addGrownup(state, 'Dad', 'sunflower');
  const saved = JSON.stringify(state);
  assert.ok(!saved.includes('sunflower'));
  assert.notEqual(a.hash, b.hash, 'the same passcode looks different for each grown-up');
});

test('changing and removing logins', async () => {
  const state = { grownups: [] };
  const mom = await A.addGrownup(state, 'Mom', 'sunflower');
  await A.changePasscode(mom, 'tulip99');
  assert.equal(await A.logIn(state, 'Mom', 'sunflower'), null);
  assert.ok(await A.logIn(state, 'Mom', 'tulip99'));
  A.removeGrownup(state, mom.id);
  assert.equal(A.loginsOn(state), false);
});

test('new logins are checked before they are added', async () => {
  const state = { grownups: [] };
  await A.addGrownup(state, 'Mom', 'sunflower');
  assert.match(A.checkNew(state, '', 'abcd', 'abcd'), /username/);
  assert.match(A.checkNew(state, 'MOM', 'abcd', 'abcd'), /already/);
  assert.match(A.checkNew(state, 'Dad', 'abc', 'abc'), /at least 4/);
  assert.match(A.checkNew(state, 'Dad', 'abcd', 'abce'), /match/);
  assert.equal(A.checkNew(state, 'Dad', 'abcd', 'abcd'), '');
});

test('an old 4-digit PIN still keeps the page locked', () => {
  assert.equal(A.loginsOn({ grownups: [], pin: '1234' }), true);
  assert.equal(A.loginsOn({ pin: '' }), false, 'older saves without logins');
});
