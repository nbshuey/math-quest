// Grown-up logins for the Grown-ups page: a username and a passcode for each grown-up.
// They're saved on this device with the players (and go into backup files). Passcodes are
// stored scrambled (PBKDF2 with a random salt), never as typed. No DOM here, so tests can import it.

export const PASSCODE_MIN = 4;

export const TRIES_BEFORE_WAIT = 5;

export const WAIT_SECONDS = 30;

const ITERATIONS = 100000;

const toHex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));

export async function hashPasscode(passcode, saltHex) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromHex(saltHex), iterations: ITERATIONS, hash: 'SHA-256' }, key, 256);
  return toHex(bits);
}

const newSalt = () => toHex(crypto.getRandomValues(new Uint8Array(16)));

// Usernames match whatever the capitals and spaces around them.
export const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const findGrownup = (state, username) => (state.grownups ?? []).find((g) => sameName(g.name, username));

// Returns an error message, or '' when it's fine.
export function checkNew(state, username, passcode, confirm) {
  const name = username.trim();
  if (!name) return 'Type a username.';
  if (name.length > 20) return 'Keep the username to 20 letters or fewer.';
  if (findGrownup(state, name)) return `There's already a grown-up called ${name}.`;
  return checkPasscode(passcode, confirm);
}

export function checkPasscode(passcode, confirm) {
  if (passcode.length < PASSCODE_MIN) return `The passcode needs at least ${PASSCODE_MIN} characters.`;
  if (passcode !== confirm) return "The two passcodes don't match.";
  return '';
}

export async function addGrownup(state, username, passcode) {
  const salt = newSalt();
  const g = { id: newSalt(), name: username.trim(), salt, hash: await hashPasscode(passcode, salt), added: Date.now() };
  state.grownups = [...(state.grownups ?? []), g];
  return g;
}

export async function changePasscode(g, passcode) {
  g.salt = newSalt();
  g.hash = await hashPasscode(passcode, g.salt);
}

export function removeGrownup(state, id) {
  state.grownups = (state.grownups ?? []).filter((g) => g.id !== id);
}

// The grown-up whose username and passcode match, or null.
export async function logIn(state, username, passcode) {
  const g = findGrownup(state, username);
  if (!g) {
    await hashPasscode(passcode, newSalt()); // take the same time either way
    return null;
  }
  return (await hashPasscode(passcode, g.salt)) === g.hash ? g : null;
}

// Logins are on once any grown-up is added (or an old 4-digit PIN is still set).
export const loginsOn = (state) => (state.grownups?.length ?? 0) > 0 || !!state.pin;
