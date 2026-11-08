// Shared state (the saved players), constants and small helpers. No DOM here, so tests can import it.

import { TOPICS, LEVELS } from './problems.js';
import { BUDDIES, CATALOG, stageFor } from './shop.js';
import { loadState, saveState } from './storage.js';

export const QUESTIONS_PER_ROUND = 10;

export const AVATARS = ['🦊', '🐼', '🐯', '🦄', '🐸', '🐙', '🦖', '🐧', '🐵', '🦁', '🐨', '🚀'];

export const PRAISE = ['Awesome!', 'You got it!', 'Nailed it!', 'Super smart!', 'Boom! 💥', 'Fantastic!'];

export const ENCOURAGE = ['Almost! Try again.', 'Not quite. You can do it!', 'Hmm, check your work!'];

export const GREETINGS = ["Let's do this!", 'You can do it!', 'Ready for a quest?', 'I believe in you!'];

export let state = loadState();
// Re-reads the saved data (after restoring a backup).
export function reloadState() {
  state = loadState();
}

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Called after every save (family accounts use it to save online too).
export const afterSave = [];

export const save = () => {
  saveState(state);
  for (const fn of afterSave) fn();
};

export const currentProfile = () => state.profiles.find((p) => p.id === state.currentId);

export const totalStars = (p) => Object.values(p.best).reduce((a, b) => a + b, 0);

export const buddyOf = (p) => BUDDIES.find((b) => b.id === p.buddy) ?? BUDDIES[0];

export const levelById = (id) => LEVELS.find((l) => l.id === id) ?? LEVELS[1];

// With 🧭 Auto, each topic (and the Speed Round) keeps its own level.
export const topicLevel = (p, topicId) => (p.autoLevel ? p.topicLevels[topicId] ?? p.level : p.level);

export const AUTO_UP = 3; // right on the first try this many times in a row → a level up

export const AUTO_DOWN = 2; // missed the first try this many times in a row → a level down

// Special items (with `needs`) unlock once any buddy grows to that stage.
export const maxStage = (p) => Math.max(0, ...Object.values(p.buddyXp ?? {}).map(stageFor));

// Gifts can't be bought: birthday gifts are added on the birthday, the team gift after a team goal.
export const owns = (p, tab, item) =>
  (item.needs ? maxStage(p) >= item.needs : item.gift ? item.gift === 'team' && (state.teamWins ?? 0) > 0 : item.price === 0) || p.owned[tab].includes(item.id);

export const unlocksAt = (stage) => Object.values(CATALOG).flatMap((c) => c.items).filter((i) => i.needs === stage);

export const buddyName = (p) => buddyOf(p).name.split(' ')[0];

export const shuffle = (arr) => [...arr].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

export const coreTopics = (grade) => TOPICS[grade].filter((t) => !t.extra);

export const findTopic = (id) => Object.values(TOPICS).flat().find((t) => t.id === id);

export const FOCUS_BONUS = 5;

export const GOAL_BONUS = 20;

export const startOfDay = (t) => new Date(t).setHours(0, 0, 0, 0);

// Weeks start on Sunday.
export function weekStart(weeksAgo = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.setDate(d.getDate() - d.getDay() - 7 * weeksAgo);
}

export const HISTORY_MAX = 200; // rounds kept, for Recent quests and weekly reports

// Warm-ups are extra practice, so they don't count toward the weekly goal.
export const questsThisWeek = (p) => p.history.filter((h) => h.t >= weekStart() && h.topic !== 'warmup').length;
