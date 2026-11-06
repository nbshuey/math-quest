// Rewards and progress rules: buddy growth, goals, stickers, warm-ups, bosses, weekly summaries.
// No DOM here, so tests can import it.

import { CATALOG, stageFor } from './shop.js';
import { QUESTIONS_PER_ROUND, state, save, topicLevel, maxStage, coreTopics, GOAL_BONUS, startOfDay, weekStart, questsThisWeek, unlocksAt } from './state.js';

export const buddyXp = (p, id = p.buddy) => p.buddyXp[id] ?? 0;

// Adds this round's coins to the buddy's growth. Returns the stages before and after.
export function growBuddy(p, coins) {
  const before = stageFor(buddyXp(p));
  const maxBefore = maxStage(p);
  p.buddyXp[p.buddy] = buddyXp(p) + coins;
  // Special shop items unlocked for the first time by this growth.
  const unlocked = [];
  for (let st = maxBefore + 1; st <= maxStage(p); st++) unlocked.push(...unlocksAt(st));
  return { before, after: stageFor(buddyXp(p)), unlocked };
}

// On (or within 3 days after) a player's birthday, once a year: free birthday gifts.
export function birthdayGift(p, now = new Date()) {
  if (!p.birthday) return false;
  const [m, d] = p.birthday.split('-').map(Number);
  let bday = new Date(now.getFullYear(), m - 1, d);
  if (bday > now) bday = new Date(now.getFullYear() - 1, m - 1, d); // e.g. Jan 1 for a Dec 30 birthday
  const days = (startOfDay(now) - bday.getTime()) / 86400000;
  if (days < 0 || days > 3 || p.birthdayYear === bday.getFullYear()) return false;
  p.birthdayYear = bday.getFullYear();
  for (const [tab, id] of [['themes', 'party'], ['extras', 'present']]) if (!p.owned[tab].includes(id)) p.owned[tab].push(id);
  save();
  return true;
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const shortDate = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const pctOf = (n, d) => (d ? Math.round((100 * n) / d) : 0);

// Adds up one week of rounds (weeksAgo = 0 is this week).
export function weekSummary(p, weeksAgo) {
  const from = weekStart(weeksAgo);
  const to = weekStart(weeksAgo - 1);
  const rounds = p.history.filter((h) => h.t >= from && h.t < to);
  const quests = rounds.filter((h) => h.topic !== 'speed');
  const speedRounds = rounds.filter((h) => h.topic === 'speed');
  const warmups = rounds.filter((h) => h.topic === 'warmup');
  const goalCount = rounds.length - warmups.length; // what counts toward the weekly goal
  const sum = (list, key) => list.reduce((n, h) => n + (h[key] || 0), 0);
  const topics = {};
  for (const h of quests) {
    // Older rounds don't have per-topic results, so count them under the round's topic.
    const parts = h.byTopic ?? { [h.topic]: [QUESTIONS_PER_ROUND, h.firstTry] };
    for (const [id, [asked, first]] of Object.entries(parts)) {
      topics[id] ??= { asked: 0, first: 0 };
      topics[id].asked += asked;
      topics[id].first += first;
    }
  }
  const days = new Set(rounds.map((h) => new Date(h.t).getDay()));
  const perDay = DAY_NAMES.map((_, d) => rounds.filter((h) => new Date(h.t).getDay() === d).length);
  const asked = Object.values(topics).reduce((n, t) => n + t.asked, 0);
  const first = Object.values(topics).reduce((n, t) => n + t.first, 0);
  const best1 = Math.max(0, ...speedRounds.filter((h) => h.seconds === 60).map((h) => h.speed));
  return {
    from, to, rounds, quests, speedRounds, warmups, goalCount, topics, days, perDay, asked, first,
    whyAsked: sum(quests, 'whyAsked'), whyRight: sum(quests, 'whyRight'),
    tellAsked: sum(quests, 'tellAsked'), told: sum(quests, 'told'),
    hinted: sum(quests, 'hinted'), coins: sum(rounds, 'coins'),
    speedRight: sum(speedRounds, 'speed'), speedWrong: sum(speedRounds, 'wrong'), best1,
  };
}

/* Team goal: all players' quests this week added together. Reaching it pays every
   player once a week, and the first time unlocks the Family Fort theme. */
export const TEAM_BONUS = 15;

export const TEAM_GOALS = [0, 6, 10, 15, 20];

export const teamCount = () => state.profiles.reduce((n, k) => n + questsThisWeek(k), 0);

export const teamOn = () => state.profiles.length > 1 && (state.teamGoal ?? 0) > 0;

export function teamBonus(p, bonuses) {
  if (!teamOn() || state.teamWeek === weekStart() || teamCount() < state.teamGoal) return;
  state.teamWeek = weekStart();
  state.teamWins = (state.teamWins ?? 0) + 1;
  for (const k of state.profiles) {
    k.teamWins = (k.teamWins ?? 0) + 1;
    if (k === p) continue;
    k.coins += TEAM_BONUS;
    k.teamCheer = weekStart(); // they hear about it next time they open their quests
  }
  bonuses.push([`🤝 Team goal reached${state.teamWins === 1 ? ' · 🏰 Family Fort theme unlocked for everyone' : ''}`, TEAM_BONUS]);
}

// Pays the weekly goal bonus once, the first time the goal is reached each week.
export function goalBonus(p, bonuses) {
  if (p.weeklyGoal && p.goalWeek !== weekStart() && questsThisWeek(p) >= p.weeklyGoal) {
    p.goalWeek = weekStart();
    bonuses.push(['🎯 Weekly goal reached', GOAL_BONUS]);
  }
}

// Stickers for good habits as well as right answers. Each is checked after a
// round (ctx says what kind), or after buying something in the shop.
export const STICKER_COINS = 5;

export const quest = (c) => c.kind === 'quest';

export const totalTold = (p) => Object.values(p.stats).reduce((n, s) => n + (s.told || 0), 0);

export const topicsPlayed = (p) => coreTopics(p.grade).filter((t) => p.stats[t.id]?.asked).length;

export const daysThisWeek = (p) => new Set(p.history.filter((h) => h.t >= weekStart()).map((h) => new Date(h.t).getDay())).size;

// Things bought in the shop (gifts don't count).
export const giftIds = new Set(Object.values(CATALOG).flatMap((c) => c.items).filter((i) => i.gift).map((i) => i.id));

export const ownedCount = (p) => Object.values(p.owned).reduce((n, list) => n + list.filter((id) => !giftIds.has(id)).length, 0);

export const STICKERS = [
  { id: 'first', emoji: '🎉', name: 'First quest', how: 'Finish a quest.', test: (p, c) => quest(c) },
  { id: 'streak5', emoji: '🔥', name: 'On fire', how: 'Get 5 in a row on the first try.', test: (p, c) => quest(c) && c.bestStreak >= 5 },
  { id: 'perfect', emoji: '⭐', name: 'Perfect!', how: 'Get all 10 right on the first try.', test: (p, c) => quest(c) && c.firstTry === 10 },
  { id: 'hard', emoji: '🌶️', name: 'Brave brain', how: 'Finish a 🔥 Hard quest.', test: (p, c) => quest(c) && c.level === 3 },
  { id: 'summit', emoji: '🏔️', name: 'Mountain top', how: 'Get a perfect 🔥 Hard quest.', test: (p, c) => quest(c) && c.level === 3 && c.firstTry === 10 },
  { id: 'boss', emoji: '👾', name: 'Boss beater', how: 'Win a boss battle.', test: (p, c) => c.kind === 'boss' && c.won },
  { id: 'boss5', emoji: '🏆', name: 'Boss hunter', how: 'Win 5 boss battles.', test: (p) => Object.values(p.bossWins).reduce((n, w) => n + w, 0) >= 5 },
  { id: 'levelup', emoji: '🧭', name: 'Level up', how: 'Move up a level with 🧭 Auto.', test: (p, c) => c.levelUp },
  { id: 'thinker', emoji: '🧠', name: 'Big thinker', how: 'Pick 3 right explanations in one quest.', test: (p, c) => quest(c) && c.whyRight >= 3 },
  { id: 'teacher', emoji: '🗣️', name: 'Little teacher', how: 'Get a ⭐ Great explaining from your grown-up.', test: (p, c) => quest(c) && c.told >= 1 },
  { id: 'teacher10', emoji: '🎤', name: 'Explainer pro', how: 'Get 10 ⭐ Great explaining taps in all.', test: (p) => totalTold(p) >= 10 },
  { id: 'detective', emoji: '🕵️', name: 'Detective', how: 'Get 8 or more in Fix the Mistake.', test: (p, c) => quest(c) && c.topicId === 'mistake' && c.firstTry >= 8 },
  { id: 'mixmaster', emoji: '🎲', name: 'Mix master', how: 'Get 8 or more in Mixed Challenge.', test: (p, c) => quest(c) && c.topicId === 'mixed' && c.firstTry >= 8 },
  { id: 'comeback', emoji: '🔁', name: 'Comeback kid', how: 'Fix every one in a “Try these again” round.', test: (p, c) => c.kind === 'replay' && c.firstTry === c.total },
  { id: 'earlybird', emoji: '☀️', name: 'Early bird', how: 'Finish a daily warm-up.', test: (p, c) => c.kind === 'warmup' },
  { id: 'warm3', emoji: '🌤️', name: 'Warm streak', how: 'Do the daily warm-up 3 days in a row.', test: (p) => (p.warmup?.streak ?? 0) >= 3 },
  { id: 'warm7', emoji: '🌞', name: 'Sunny week', how: 'Do the daily warm-up 7 days in a row.', test: (p) => (p.warmup?.streak ?? 0) >= 7 },
  { id: 'quick', emoji: '⚡', name: 'Quick', how: 'Get 10 or more in a 1-minute Speed Round.', test: (p, c) => c.kind === 'speed' && c.seconds === 60 && c.score >= 10 },
  { id: 'rocket', emoji: '🚀', name: 'Rocket', how: 'Get 20 or more in a 1-minute Speed Round.', test: (p, c) => c.kind === 'speed' && c.seconds === 60 && c.score >= 20 },
  { id: 'sharp', emoji: '🎯', name: 'Sharpshooter', how: 'Get 10 or more in a Speed Round with no misses.', test: (p, c) => c.kind === 'speed' && c.score >= 10 && c.wrong === 0 },
  { id: 'q10', emoji: '📚', name: 'Ten quests', how: 'Finish 10 quests.', test: (p) => p.questCount >= 10 },
  { id: 'q50', emoji: '🏰', name: 'Fifty quests', how: 'Finish 50 quests.', test: (p) => p.questCount >= 50 },
  { id: 'q100', emoji: '💯', name: 'Hundred club', how: 'Finish 100 quests.', test: (p) => p.questCount >= 100 },
  { id: 'days3', emoji: '📅', name: '3-day week', how: 'Practice on 3 different days in one week.', test: (p) => daysThisWeek(p) >= 3 },
  { id: 'days5', emoji: '🗓️', name: '5-day week', how: 'Practice on 5 different days in one week.', test: (p) => daysThisWeek(p) >= 5 },
  { id: 'team', emoji: '🤝', name: 'Team player', how: 'Reach a team goal with your family.', test: (p) => (p.teamWins ?? 0) >= 1 },
  { id: 'goal', emoji: '🥅', name: 'Goal getter', how: 'Reach your weekly goal.', test: (p) => p.weeklyGoal > 0 && questsThisWeek(p) >= p.weeklyGoal },
  { id: 'explorer', emoji: '🗺️', name: 'Explorer', how: 'Play 5 different topics.', test: (p) => topicsPlayed(p) >= 5 },
  { id: 'traveler', emoji: '🌍', name: 'World traveler', how: 'Play every topic in your grade.', test: (p) => topicsPlayed(p) >= coreTopics(p.grade).length },
  { id: 'growing', emoji: '🌿', name: 'Growing up', how: 'Grow a buddy to 🌿 Big.', test: (p) => maxStage(p) >= 2 },
  { id: 'legend', emoji: '👑', name: 'Legend keeper', how: 'Grow a buddy to 🌟 Legend.', test: (p) => maxStage(p) >= 4 },
  { id: 'snack', emoji: '🍎', name: 'Snack time', how: 'Share a treat with your buddy.', test: (p) => (p.treatsFed ?? 0) >= 1 },
  { id: 'shopper', emoji: '🛍️', name: 'First buy', how: 'Buy something in the shop.', test: (p) => ownedCount(p) >= 1 },
  { id: 'collector', emoji: '🎒', name: 'Collector', how: 'Own 10 things from the shop.', test: (p) => ownedCount(p) >= 10 },
];

// Awards any new stickers (with coins) and returns them.
export function checkStickers(p, ctx) {
  const earned = STICKERS.filter((st) => !p.stickers[st.id] && st.test(p, ctx));
  for (const st of earned) p.stickers[st.id] = Date.now();
  p.coins += earned.length * STICKER_COINS;
  return earned;
}

// After every 3 quests in a topic, that topic's boss shows up. Each first-try answer
// takes a heart; each first miss costs one of your 3 shields.
export const BOSS_EVERY = 3;

export const BOSS_HP = 6;

export const BOSS_SHIELDS = 3;

export const BOSS_MAX_QUESTIONS = 12;

export const BOSS_LOOKS = [['👾', 'Math Monster'], ['🐲', 'Digit Dragon'], ['🧌', 'Puzzle Troll'], ['🦑', 'Sum Squid'], ['👻', 'Number Ghost'], ['👹', 'Grumble Goblin'], ['🦖', 'Count-a-saurus'], ['🤖', 'Robo-Riddler']];

export const BOSS_MOODS = ['Grumpy', 'Sneaky', 'Mega', 'Wobbly', 'Spiky', 'Giant', 'Tricky', 'Sleepy'];

export const bossReady = (p, topicId) => (p.bossProgress[topicId] ?? 0) >= BOSS_EVERY;

export function bossFor(topicId) {
  const h = [...topicId].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  const [emoji, name] = BOSS_LOOKS[h % BOSS_LOOKS.length];
  return { emoji, name: `${BOSS_MOODS[(h >> 3) % BOSS_MOODS.length]} ${name}` };
}

// 5 quick questions a day, mostly from focus areas, recent misses and tricky topics.
export const WARMUP_SIZE = 5;

export const WARMUP_BONUS = 5;

export const today = () => startOfDay(Date.now());

export const warmupDone = (p) => p.warmup?.day === today();

// The streak only counts if the last warm-up was today or yesterday.
export const warmupStreak = (p) => (p.warmup && today() - p.warmup.day <= 86400000 * 1.5 ? p.warmup.streak : 0);

export function warmupQueue(p) {
  const core = coreTopics(p.grade);
  const weekAgo = Date.now() - 7 * 86400000;
  const missedLately = new Set(
    p.history.filter((h) => h.t >= weekAgo && h.byTopic).flatMap((h) => Object.entries(h.byTopic).filter(([, [asked, first]]) => first < asked).map(([id]) => id)),
  );
  const tricky = (id) => p.stats[id]?.asked >= 3 && p.stats[id].firstTry / p.stats[id].asked < 0.7;
  const weight = (t) => 1 + (p.focus.includes(t.id) ? 3 : 0) + (missedLately.has(t.id) ? 2 : 0) + (tricky(t.id) ? 2 : 0);
  // Weighted picks, each topic at most once.
  const pool = [...core];
  const picks = [];
  while (picks.length < WARMUP_SIZE && pool.length) {
    let r = Math.random() * pool.reduce((n, t) => n + weight(t), 0);
    const i = pool.findIndex((t) => (r -= weight(t)) < 0);
    picks.push(pool.splice(i < 0 ? 0 : i, 1)[0]);
  }
  return picks.map((t) => ({ topicId: t.id, level: topicLevel(p, t.id) }));
}

// Turn a saved fact ("7 × 8") back into a question, in either order for + and ×.
export function factFromKey(key) {
  let [a, op, b] = key.split(' ');
  if ((op === '+' || op === '×') && Math.random() < 0.5) [a, b] = [b, a];
  const [x, y] = [Number(a), Number(b)];
  return { text: `${x} ${op} ${y}`, key, answer: String({ '+': x + y, '−': x - y, '×': x * y, '÷': x / y }[op]) };
}
