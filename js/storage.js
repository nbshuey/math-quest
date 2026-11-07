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
    extra: 'none', // something the buddy holds
    theme: 'sunny',
    autoRead: false,
    easyRead: false,
    wordSteps: false, // word problems one sentence at a time
    birthday: '', // 'M-D', optional: birthday gifts in the shop
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
    stickers: {}, // sticker id → when it was earned
    bossProgress: {}, // topic id → quests since its last boss win
    bossWins: {}, // topic id → boss battles won
    ...p,
    owned: { buddies: [], hats: [], extras: [], themes: [], ...p.owned },
  };
  // Buddy growth (coins earned with each buddy). Older saves start the current
  // buddy with credit for the rounds already played, so it doesn't shrink.
  if (!p.buddyXp) {
    const earned = out.history.reduce((n, h) => n + (h.coins ?? (h.firstTry ?? h.speed ?? 0) * (h.level ?? 1)), 0);
    out.buddyXp = { [out.buddy]: earned };
  }
  // Quests finished in all (history only keeps the most recent ones).
  out.questCount ??= out.history.length;
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
    pin: '', // an old 4-digit grown-up PIN (becomes a login the first time it's used)
    grownups: [], // grown-up logins: { id, name, salt, hash } (see accounts.js)
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
