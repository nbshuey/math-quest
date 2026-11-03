// Saves players and their progress in the browser (localStorage).

const KEY = 'mathquest.v1';

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function makeProfile(name, grade, avatar) {
  return { id: newId(), name, grade, avatar, coins: 0, best: {} };
}

function defaultState() {
  return {
    sound: true,
    currentId: null,
    profiles: [makeProfile('Player 1', 4, '🦊'), makeProfile('Player 2', 2, '🐼')],
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    // Storage unavailable or corrupted: start fresh.
  }
  return defaultState();
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Ignore (private mode, storage full).
  }
}
