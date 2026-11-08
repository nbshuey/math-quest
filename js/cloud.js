// ☁️ Family accounts: a grown-up signs in with an email and password (Firebase Authentication),
// and each family's players are saved online (Cloud Firestore), one document per player plus
// one for the family. Uses Google's web APIs directly (no SDK). This device's copy in
// localStorage stays the one the game plays with, so it works offline and catches up later.
// No DOM here, so tests can import it.

import { CLOUD } from './cloudconfig.js';
import { normalizeProfile } from './storage.js';

let config = CLOUD;
// Tests (and the browser check) use a stand-in server.
export function setConfig(value) {
  config = value;
}

let http = (...args) => fetch(...args);
export function setHttp(fn) {
  http = fn;
}

export const cloudOn = () => !!(config?.apiKey && config?.projectId);

/* ---------------- Saved on this device ---------------- */

const SESSION_KEY = 'mathquest.cloud'; // who's signed in on this device
const SYNCED_KEY = 'mathquest.synced'; // what this device last saw online
const LOCAL_ONLY_KEY = 'mathquest.localOnly'; // "Play on this device only" was picked

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the account just won't be remembered.
  }
};

export const session = () => read(SESSION_KEY);
export const localOnly = () => !!read(LOCAL_ONLY_KEY);
export const setLocalOnly = (on) => write(LOCAL_ONLY_KEY, on ? true : null);

/* ---------------- Errors in plain words ---------------- */

const MESSAGES = {
  offline: "Can't reach the internet. Check the Wi-Fi and try again.",
  EMAIL_EXISTS: 'There’s already an account with that email. Try logging in.',
  EMAIL_NOT_FOUND: 'That email and password don’t match.',
  INVALID_PASSWORD: 'That email and password don’t match.',
  INVALID_LOGIN_CREDENTIALS: 'That email and password don’t match.',
  INVALID_EMAIL: 'That doesn’t look like an email address.',
  MISSING_PASSWORD: 'Type a password.',
  WEAK_PASSWORD: 'The password needs at least 6 characters.',
  USER_DISABLED: 'This account has been turned off.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many tries. Wait a few minutes and try again.',
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Please type your password again.',
  signedOut: 'You were logged out. Please log in again.',
  conflict: 'Another device saved at the same moment. Trying again.',
};

export class CloudError extends Error {
  constructor(code) {
    super(MESSAGES[code] ?? `Something went wrong (${code}). Try again in a minute.`);
    this.code = code;
  }
}

// "WEAK_PASSWORD : Password should be at least 6 characters" → "WEAK_PASSWORD"
const codeOf = (data, status) => String(data?.error?.message ?? data?.error?.status ?? status).split(/[ :]/)[0];

async function call(url, options) {
  let res;
  try {
    res = await http(url, options);
  } catch {
    throw new CloudError('offline');
  }
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { res, data };
}

/* ---------------- Sign-in (Firebase Authentication) ---------------- */

async function auth(path, body) {
  const { res, data } = await call(`https://identitytoolkit.googleapis.com/v1/accounts:${path}?key=${config.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new CloudError(codeOf(data, res.status));
  return data;
}

function remember(d) {
  const s = {
    uid: d.localId ?? d.user_id,
    email: d.email ?? session()?.email,
    idToken: d.idToken ?? d.id_token,
    refreshToken: d.refreshToken ?? d.refresh_token,
    expires: Date.now() + (Number(d.expiresIn ?? d.expires_in) || 3600) * 1000 - 60000,
  };
  write(SESSION_KEY, s);
  setLocalOnly(false);
  return s;
}

export const cleanEmail = (email) => email.trim().toLowerCase();

export const signUp = async (email, password) => remember(await auth('signUp', { email: cleanEmail(email), password, returnSecureToken: true }));

export const logIn = async (email, password) => remember(await auth('signInWithPassword', { email: cleanEmail(email), password, returnSecureToken: true }));

export const sendReset = (email) => auth('sendOobCode', { requestType: 'PASSWORD_RESET', email: cleanEmail(email) });

// Forgets the account on this device (the family's data stays online).
export function logOut() {
  write(SESSION_KEY, null);
  write(SYNCED_KEY, null);
}

// A fresh sign-in token (they last an hour).
async function token() {
  const s = session();
  if (!s) throw new CloudError('signedOut');
  if (Date.now() < s.expires) return s;
  const { res, data } = await call(`https://securetoken.googleapis.com/v1/token?key=${config.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken)}`,
  });
  if (!res.ok) {
    if (res.status === 400) {
      logOut();
      throw new CloudError('signedOut');
    }
    throw new CloudError(codeOf(data, res.status));
  }
  return remember(data);
}

/* ---------------- Saving (Cloud Firestore) ---------------- */

const familyUrl = (uid) => `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/families/${uid}`;

async function store(method, url, body) {
  const s = await token();
  const { res, data } = await call(url, {
    method,
    headers: { Authorization: `Bearer ${s.idToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 && method === 'GET') return null;
  if (res.status === 409 || data?.error?.status === 'FAILED_PRECONDITION' || data?.error?.status === 'ALREADY_EXISTS') throw new CloudError('conflict');
  if (res.status === 401) throw new CloudError('signedOut');
  if (!res.ok) throw new CloudError(codeOf(data, res.status));
  return data;
}

// A document holds the JSON text of a player (or the family settings) and when it changed.
const toFields = (value) => ({ fields: { data: { stringValue: JSON.stringify(value) }, changed: { integerValue: String(value.changedAt ?? 0) } } });
const fromDoc = (doc) => ({ id: doc.name.split('/').pop(), value: JSON.parse(doc.fields.data.stringValue), updateTime: doc.updateTime });

async function listKids(uid) {
  const kids = [];
  let page = '';
  do {
    const data = await store('GET', `${familyUrl(uid)}/kids?pageSize=100${page ? `&pageToken=${page}` : ''}`);
    kids.push(...(data?.documents ?? []).map(fromDoc));
    page = data?.nextPageToken ?? '';
  } while (page);
  return kids;
}

async function getFamily(uid) {
  const doc = await store('GET', familyUrl(uid));
  return doc?.fields ? fromDoc(doc) : null;
}

// Writes only if the document is as this device last saw it (or new), so two devices
// never silently overwrite each other.
function put(url, value, updateTime) {
  const pre = updateTime ? `currentDocument.updateTime=${encodeURIComponent(updateTime)}` : 'currentDocument.exists=false';
  return store('PATCH', `${url}?${pre}`, toFields(value)).then((doc) => doc.updateTime);
}

/* ---------------- Keeping this device and the account in step ---------------- */

// Family-wide settings (the rest of the saved data belongs to each player, or to this device).
export const FAMILY_KEYS = ['grownups', 'pin', 'teamGoal', 'teamWeek', 'teamWins'];

const familyOf = (state) => Object.fromEntries(FAMILY_KEYS.filter((k) => state[k] !== undefined).map((k) => [k, state[k]]));

// A short fingerprint of a player or the family settings, ignoring when it changed.
export function fingerprint(value) {
  const text = JSON.stringify({ ...value, changedAt: undefined });
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36) + text.length.toString(36);
}

// Marks what changed since the last save with the time, so the newer copy wins
// if two devices change the same player while apart.
const seen = new Map();
export function stamp(state, now = Date.now()) {
  for (const p of state.profiles) {
    const f = fingerprint(p);
    if (seen.has(p.id) && seen.get(p.id) !== f) p.changedAt = now;
    seen.set(p.id, f);
  }
  const fam = fingerprint(familyOf(state));
  if (seen.has('family') && seen.get('family') !== fam) state.familyChangedAt = now;
  seen.set('family', fam);
}

const syncedFor = (uid) => {
  const s = read(SYNCED_KEY);
  return s?.uid === uid ? s : { uid, kids: {}, family: null };
};

// Players with no progress yet (like the two blank players on a new device).
export const blank = (p) => !p.history?.length && !p.coins && !p.questCount;

// Brings this device and the family account in step. `canApply(id)` says whether an online
// change to that player can be used right now (not in the middle of a round).
// Returns true when this device's players changed.
export async function sync(state, { canApply = () => true } = {}) {
  const { uid } = await token();
  const synced = syncedFor(uid);
  const base = familyUrl(uid);
  let changed = false;

  // Players.
  const remote = new Map((await listKids(uid)).map((k) => [k.id, k]));
  const local = new Map(state.profiles.map((p) => [p.id, p]));
  for (const [id, r] of remote) {
    const last = synced.kids[id];
    const p = local.get(id);
    if (!p) {
      if (last && last.u === r.updateTime) {
        // Deleted on this device.
        await store('DELETE', `${base}/kids/${id}`);
        delete synced.kids[id];
      } else if (canApply(id)) {
        // New from another device.
        state.profiles.push(normalizeProfile(r.value));
        synced.kids[id] = { h: fingerprint(r.value), u: r.updateTime };
        changed = true;
      }
      continue;
    }
    const localDirty = !last || last.h !== fingerprint(p);
    const remoteChanged = !last || last.u !== r.updateTime;
    const remoteWins = remoteChanged && (!localDirty || (r.value.changedAt ?? 0) > (p.changedAt ?? 0));
    if (remoteWins) {
      if (!canApply(id)) continue;
      state.profiles[state.profiles.indexOf(p)] = normalizeProfile(r.value);
      synced.kids[id] = { h: fingerprint(r.value), u: r.updateTime };
      changed = true;
    } else if (localDirty) {
      synced.kids[id] = { h: fingerprint(p), u: await put(`${base}/kids/${id}`, p, r.updateTime) };
    } else synced.kids[id] = { h: last.h, u: r.updateTime };
  }
  for (const p of [...state.profiles]) {
    if (remote.has(p.id)) continue;
    const last = synced.kids[p.id];
    if (last && last.h === fingerprint(p) && canApply(p.id)) {
      // Deleted on another device.
      state.profiles.splice(state.profiles.indexOf(p), 1);
      delete synced.kids[p.id];
      changed = true;
    } else {
      synced.kids[p.id] = { h: fingerprint(p), u: await put(`${base}/kids/${p.id}`, p, null) };
    }
  }

  // Family settings (grown-up logins, team goal).
  const r = await getFamily(uid);
  const last = synced.family;
  const useRemote = (value) => {
    const mine = state.grownups ?? [];
    for (const k of FAMILY_KEYS) delete state[k];
    const { changedAt, ...rest } = value;
    Object.assign(state, { grownups: [], pin: '' }, rest);
    state.familyChangedAt = changedAt ?? 0;
    return mine;
  };
  if (r && !last) {
    // First time this device joins the family: the family's settings win, and any
    // grown-up logins made on this device are added to them.
    const mine = useRemote(r.value);
    const extra = mine.filter((g) => !state.grownups.some((x) => x.name.toLowerCase() === g.name.toLowerCase()));
    synced.family = { h: fingerprint(familyOf(state)), u: r.updateTime };
    if (extra.length) state.grownups.push(...extra);
    changed = true;
  }
  const fam = familyOf(state);
  const localDirty = !synced.family || synced.family.h !== fingerprint(fam);
  const remoteChanged = r && synced.family?.u !== r.updateTime;
  if (remoteChanged && (!localDirty || (r.value.changedAt ?? 0) > (state.familyChangedAt ?? 0))) {
    useRemote(r.value);
    synced.family = { h: fingerprint(familyOf(state)), u: r.updateTime };
    changed = true;
  } else if (localDirty || !r) {
    const value = { ...fam, changedAt: state.familyChangedAt ?? 0 };
    synced.family = { h: fingerprint(fam), u: await put(base, value, r?.updateTime) };
  } else synced.family = { h: synced.family.h, u: r.updateTime };

  write(SYNCED_KEY, synced);
  stamp(state); // what's now here counts as seen
  return changed;
}

// Does the family account already have players? (Asked right after logging in.)
export async function familyPlayers() {
  const { uid } = await token();
  return (await listKids(uid)).map((k) => k.value);
}

// Deletes everything online for this family, then the account itself. The password is
// asked again first, because deleting an account needs a fresh sign-in.
export async function deleteFamily(password) {
  const s = session();
  const fresh = await logIn(s.email, password);
  const base = familyUrl(fresh.uid);
  for (const k of await listKids(fresh.uid)) await store('DELETE', `${base}/kids/${k.id}`);
  await store('DELETE', base);
  await auth('delete', { idToken: fresh.idToken });
  logOut();
}
