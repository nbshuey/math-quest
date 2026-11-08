// Rewards and progress rules: growth, goals, stickers, warm-ups, bosses, birthdays and weekly reports.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { makeProfile } = await import('../js/storage.js');
const S = await import('../js/state.js');
const R = await import('../js/rewards.js');
const { coreTopics, weekStart } = S;

let kid;
beforeEach(() => {
  kid = makeProfile('Sam', 4, '🦊');
  S.state.profiles = [kid, makeProfile('Ivy', 2, '🐼')];
  S.state.currentId = kid.id;
  S.state.teamGoal = 0;
  delete S.state.teamWeek;
  delete S.state.teamWins;
});
const round = (extra = {}) => ({ t: Date.now(), topic: 'multfacts', level: 2, firstTry: 8, ...extra });

test('buddies grow through the stages and unlock special items', () => {
  let g = R.growBuddy(kid, 39);
  assert.deepEqual([g.before, g.after], [0, 0]);
  g = R.growBuddy(kid, 1);
  assert.equal(g.after, 1, '40 coins: Little');
  g = R.growBuddy(kid, 80);
  assert.equal(g.after, 2, '120 coins: Big');
  assert.ok(g.unlocked.some((i) => i.id === 'gem'), 'Big unlocks the Giant gem');
  g = R.growBuddy(kid, 1000);
  assert.equal(g.after, 4, 'Legend');
});

test('a new buddy starts small, and growth stays with each buddy', () => {
  R.growBuddy(kid, 200);
  kid.buddy = 'owl';
  assert.equal(R.buddyXp(kid), 0);
  kid.buddy = 'cat';
  assert.equal(R.buddyXp(kid), 200);
});

test('the weekly goal pays once a week', () => {
  kid.weeklyGoal = 2;
  kid.history = [round(), round()];
  const b1 = [];
  R.goalBonus(kid, b1);
  assert.equal(b1.length, 1);
  const b2 = [];
  R.goalBonus(kid, b2);
  assert.equal(b2.length, 0);
});

test('warm-ups do not count toward goals', () => {
  kid.history = [round({ topic: 'warmup' }), round()];
  assert.equal(S.questsThisWeek(kid), 1);
});

test('the team goal pays everyone once and unlocks the Family Fort', () => {
  const ivy = S.state.profiles[1];
  S.state.teamGoal = 3;
  kid.history = [round(), round()];
  ivy.history = [round({ topic: 'add100' })];
  const before = ivy.coins;
  const bonuses = [];
  R.teamBonus(kid, bonuses);
  assert.equal(bonuses.length, 1, 'the player who finished gets it as a bonus line');
  assert.equal(ivy.coins, before + R.TEAM_BONUS, 'the other player is paid directly');
  assert.equal(ivy.teamCheer, weekStart());
  assert.equal(S.state.teamWins, 1);
  const again = [];
  R.teamBonus(kid, again);
  assert.equal(again.length, 0, 'only once a week');
  const fort = S.owns(ivy, 'themes', { id: 'family', gift: 'team', price: 0 });
  assert.equal(fort, true);
});

test('the team goal is off with one player', () => {
  S.state.profiles = [kid];
  S.state.teamGoal = 1;
  kid.history = [round()];
  const b = [];
  R.teamBonus(kid, b);
  assert.equal(b.length, 0);
});

test('stickers are earned once, with coins', () => {
  const coins = kid.coins;
  const first = R.checkStickers(kid, { kind: 'quest', firstTry: 10, bestStreak: 10, level: 3, whyRight: 0, told: 0 });
  const ids = first.map((s) => s.id);
  for (const id of ['first', 'perfect', 'streak5', 'hard', 'summit']) assert.ok(ids.includes(id), id);
  assert.equal(kid.coins, coins + first.length * R.STICKER_COINS);
  assert.deepEqual(R.checkStickers(kid, { kind: 'quest', firstTry: 10, bestStreak: 10, level: 3 }).map((s) => s.id), []);
});

test('shopping stickers ignore free gifts', () => {
  kid.owned.themes.push('party');
  kid.owned.extras.push('present');
  assert.equal(R.ownedCount(kid), 0);
  kid.owned.hats.push('crown');
  assert.equal(R.ownedCount(kid), 1);
});

test('the daily warm-up picks 5 different topics and favors focus areas', () => {
  kid.focus = ['area'];
  let withFocus = 0;
  for (let i = 0; i < 300; i++) {
    const q = R.warmupQueue(kid);
    assert.equal(q.length, R.WARMUP_SIZE);
    assert.equal(new Set(q.map((x) => x.topicId)).size, q.length);
    assert.ok(q.every((x) => coreTopics(4).some((t) => t.id === x.topicId)));
    if (q.some((x) => x.topicId === 'area')) withFocus++;
  }
  // 5 of 15 topics at random is a third of the time; the focus area should come up much more.
  assert.ok(withFocus / 300 > 0.5, `focus area in ${withFocus} of 300 warm-ups`);
});

test('warm-up streaks only last if you come back the next day', () => {
  kid.warmup = { day: R.today() - 86400000, streak: 4 };
  assert.equal(R.warmupStreak(kid), 4);
  kid.warmup = { day: R.today() - 3 * 86400000, streak: 4 };
  assert.equal(R.warmupStreak(kid), 0);
});

test('bosses appear after 3 quests and always look the same for a topic', () => {
  assert.equal(R.bossReady(kid, 'angles'), false);
  kid.bossProgress.angles = 3;
  assert.equal(R.bossReady(kid, 'angles'), true);
  assert.deepEqual(R.bossFor('angles'), R.bossFor('angles'));
  assert.match(R.bossFor('frac3').name, /^\w+ [\w-]+/);
});

test('birthday gifts arrive once, within 3 days after the birthday', () => {
  kid.birthday = '11-5';
  assert.equal(R.birthdayGift(kid, new Date(2026, 10, 4)), false, 'not before');
  assert.equal(R.birthdayGift(kid, new Date(2026, 10, 6)), true);
  assert.ok(kid.owned.themes.includes('party') && kid.owned.extras.includes('present'));
  assert.equal(R.birthdayGift(kid, new Date(2026, 10, 7)), false, 'once a year');
  const late = makeProfile('Max', 2, '🐯');
  late.birthday = '12-30';
  assert.equal(R.birthdayGift(late, new Date(2027, 0, 1)), true, 'works across New Year');
});

test('the weekly report splits Mixed rounds into their topics', () => {
  kid.history = [
    round({ topic: 'mixed', firstTry: 7, byTopic: { decimals: [4, 3], angles: [6, 4] } }),
    round({ topic: 'warmup', firstTry: 4, total: 5, byTopic: { decimals: [5, 4] } }),
    round({ topic: 'speed', speed: 18, seconds: 60, wrong: 2 }),
    round({ t: weekStart(1) + 3600000 }), // last week (an hour after it started)
  ];
  const w = R.weekSummary(kid, 0);
  assert.equal(w.goalCount, 2, 'warm-ups are not quests');
  assert.equal(w.warmups.length, 1);
  assert.deepEqual(w.topics.decimals, { asked: 9, first: 7 });
  assert.deepEqual(w.topics.angles, { asked: 6, first: 4 });
  assert.equal(w.best1, 18);
  const last = R.weekSummary(kid, 1);
  assert.deepEqual(last.topics.multfacts, { asked: 10, first: 8 }, 'old rounds count under their own topic');
});

test('missed speed facts come back as the same fact', () => {
  for (const key of ['7 × 8', '12 − 5', '56 ÷ 7', '3 + 9']) {
    const f = R.factFromKey(key);
    assert.equal(f.key, key);
    const [a, op, b] = f.text.split(' ');
    assert.equal(f.answer, String({ '+': +a + +b, '−': a - b, '×': a * b, '÷': a / b }[op]));
  }
});

test('a unit test is 10 questions from one unit; the Grade review asks 1 from every unit', () => {
  const unit = R.testQueue(4, 'angles', 2);
  assert.equal(unit.length, R.TEST_SIZE);
  assert.ok(unit.every((q) => q.topicId === 'angles' && q.level === 2));
  for (const grade of [2, 3, 4]) {
    const review = R.testQueue(grade, R.GRADE_REVIEW, 3);
    assert.deepEqual(review.map((q) => q.topicId).sort(), coreTopics(grade).map((t) => t.id).sort());
    assert.ok(review.every((q) => q.level === 3));
  }
});

test('test questions have no hints, steps or explanations, but keep the question', () => {
  for (const grade of [2, 3, 4]) {
    for (const t of coreTopics(grade)) {
      for (const level of [1, 2, 3]) {
        const q = R.noHelp(t.gen(level));
        for (const help of ['hint', 'steps', 'why', 'whyAsk', 'alwaysWhy', 'mistake']) assert.equal(q[help], undefined, `${t.id}: ${help}`);
        assert.ok(q.prompt && q.answer, t.id);
      }
    }
  }
});

test('a perfect unit test earns the Test star sticker', () => {
  assert.equal(R.checkStickers(kid, { kind: 'test', firstTry: 9, total: 10 }).some((s) => s.id === 'test100'), false);
  assert.ok(R.checkStickers(kid, { kind: 'test', firstTry: 10, total: 10 }).some((s) => s.id === 'test100'));
});

test('How it’s going: struggling topics with reasons, strong topics, and topics not tried', () => {
  const now = Date.now();
  const day = 86400000;
  kid.stats.multfacts = { asked: 40, firstTry: 36, hinted: 2, whyAsked: 4, whyRight: 4, last: now };
  kid.stats.division = { asked: 20, firstTry: 10, hinted: 12, whyAsked: 0, whyRight: 0, last: now };
  kid.stats.rounding = { asked: 20, firstTry: 17, hinted: 0, whyAsked: 0, whyRight: 0, last: now };
  kid.stats.angles = { asked: 20, firstTry: 12, hinted: 0, whyAsked: 0, whyRight: 0, last: now };
  kid.history = [
    // Rounding is fine with hints but not on a test.
    { t: now - day, topic: 'test', unit: 'rounding', level: 2, firstTry: 4, total: 10, byTopic: { rounding: [10, 4] } },
    // Angles was hard before and is better lately.
    { t: now - 2 * day, topic: 'angles', level: 2, firstTry: 9, byTopic: { angles: [10, 9] } },
    { t: now - 30 * day, topic: 'angles', level: 2, firstTry: 3, byTopic: { angles: [10, 3] } },
  ];
  const g = R.progressSummary(kid, now);
  const ids = (rows) => rows.map((r) => r.topic.id);
  assert.deepEqual(ids(g.struggling), ['rounding', 'division']);
  const division = g.struggling.find((r) => r.topic.id === 'division');
  assert.deepEqual(division.reasons.map((r) => r.kind), ['tricky', 'hints']);
  const rounding = g.struggling.find((r) => r.topic.id === 'rounding');
  assert.deepEqual(rounding.reasons.map((r) => r.kind), ['recent', 'test']);
  assert.match(rounding.tip, /without/);
  assert.deepEqual(ids(g.improving), ['angles'], 'angles was hard before but is fine lately');
  assert.deepEqual(ids(g.strong), ['multfacts']);
  assert.equal(g.notTried.length, coreTopics(4).length - 4);
  assert.equal(g.overall.pct, 75);
  assert.equal(g.lastTest.pct, 40);
});

test('How it’s going is empty for a new player', () => {
  const g = R.progressSummary(kid);
  assert.equal(g.overall.asked, 0);
  assert.equal(g.struggling.length, 0);
  assert.equal(g.judged, 0);
  assert.equal(g.notTried.length, coreTopics(4).length);
});
