// Saves players and their progress in the browser (localStorage).

const KEY = 'mathquest.v1';

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function makeProfile(name, grade, avatar) {
  return normalizeProfile({ id: newId(), name, grade, avatar });
}

// Fills in fields added in later versions so older saves keep working.
function normalizeProfile(p) {
  const out = {
    coins: 0,
    best: {},
    level: 2,
    autoLevel: false, // 🧭 Auto: each topic keeps its own level and it moves with how they do
    topicLevels: {}, // topic id → level, for Auto
    buddy: 'cat',
    hat: 'none',
    theme: 'sunny',
    autoRead: false,
    easyRead: false,
    // Set by a grown-up on the Grown-ups page.
    focus: [], // topic ids to practice more
    whyEvery: false, // ask "How do you know?" after every right answer
    tellGrownUp: true, // "Tell your grown-up" prompts to explain out loud
    weeklyGoal: 0, // quests per week (0 = off)
    goalWeek: 0, // start of the week the goal bonus was last paid
    message: '', // a note the buddy shows on the quest screen
    speedOn: true, // show the timed Speed Round
    // Speed Round: best scores by "grade:level:seconds", and misses per fact.
    speed: { best: {}, missed: {} },
    // Progress: per-topic totals, and the most recent rounds.
    stats: {},
    history: [],
    ...p,
    owned: { buddies: [], hats: [], themes: [], ...p.owned },
  };
  // Stars used to be stored per topic; they're now per topic and level ("topic:level").
  for (const [key, stars] of Object.entries(out.best)) {
    if (key.includes(':')) continue;
    out.best[`${key}:2`] = Math.max(out.best[`${key}:2`] || 0, stars);
    delete out.best[key];
  }
  return out;
}

function defaultState() {
  return {
    sound: true,
    pin: '', // optional grown-up PIN
    currentId: null,
    profiles: [makeProfile('Player 1', 4, '🦊'), makeProfile('Player 2', 2, '🐼')],
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const state = { ...defaultState(), ...JSON.parse(raw) };
      state.profiles = state.profiles.map(normalizeProfile);
      return state;
    }
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
