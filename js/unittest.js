// 📝 Unit Tests: pick a unit (one topic) or the Grade review (every topic).
// No hints, no second try, no "How do you know?", and no right or wrong until the end.

import { LEVELS } from './problems.js';
import { confetti, sounds } from './effects.js';
import { speak } from './speech.js';
import { esc, save, currentProfile, levelById, coreTopics, findTopic, HISTORY_MAX } from './state.js';
import { growBuddy, teamBonus, goalBonus, checkStickers, TEST_SIZE, TEST_PERFECT, GRADE_REVIEW, testQueue, testBest } from './rewards.js';
import { app, show, applyLook, on, growLine, grewLine, buddyRow, bindBubble, say, bindSound, sayButton, stickerLine } from './ui.js';
import { playerBar, renderTopics } from './home.js';
import { session, startQueue, startRound, startReplay } from './play.js';

export function testCard() {
  return `
    <button class="topic-card test-card" data-action="test">
      <div class="topic-emoji">📝</div>
      <div class="topic-name">Unit Test</div>
      <div class="topic-desc">Show what you know: no hints!</div>
      <div class="speed-best">Pick a unit or the whole grade</div>
    </button>`;
}

const unitName = (unit) => (unit === GRADE_REVIEW ? 'Grade review' : findTopic(unit)?.name ?? unit);
const unitEmoji = (unit) => (unit === GRADE_REVIEW ? '🎓' : findTopic(unit)?.emoji ?? '📝');

// The level picked on this screen (Medium unless the player has a level of their own).
let testLevel = null;

export function renderTestIntro() {
  const p = currentProfile();
  applyLook(p);
  testLevel ??= p.autoLevel ? 2 : p.level;
  const level = testLevel;
  const best = (unit) => {
    const b = testBest(p, unit, level);
    return b === undefined ? 'Not taken yet' : `🏅 Best: ${b}%`;
  };
  const units = [
    { id: GRADE_REVIEW, emoji: '🎓', name: 'Grade review', desc: `1 question from every unit (${coreTopics(p.grade).length})` },
    ...coreTopics(p.grade).map((t) => ({ id: t.id, emoji: t.emoji, name: t.name, desc: `${TEST_SIZE} questions` })),
  ];
  const intro = 'On a test there are no hints and no second tries. Answer each question once. You see your score and the answers at the end.';
  show(`
    <div class="screen">
      ${playerBar(p)}
      <div class="panel test-intro">
        ${buddyRow(p, 'You can do it! Show what you know. 📝')}
        <h2>📝 Unit Test · Grade ${p.grade}</h2>
        <p class="panel-note">${intro} ${sayButton('intro', 'Read aloud')}</p>
        <div class="levels" role="group" aria-label="Difficulty">
          ${LEVELS.map((l) => `<button class="level-opt ${l.id === level ? 'selected' : ''}" data-test-level="${l.id}">${l.emoji} ${l.name}</button>`).join('')}
        </div>
      </div>
      <div class="topics">
        ${units.map((u) => `
          <button class="topic-card ${u.id === GRADE_REVIEW ? 'test-card' : ''}" data-unit="${u.id}">
            <div class="topic-emoji">${u.emoji}</div>
            <div class="topic-name">${esc(u.name)}</div>
            <div class="topic-desc">${u.desc}</div>
            <div class="speed-best">${best(u.id)}</div>
          </button>`).join('')}
      </div>
    </div>`);
  bindSound();
  bindBubble();
  on('[data-say="intro"]', () => speak(intro));
  on('[data-action="back"]', renderTopics);
  on('[data-test-level]', (el) => {
    testLevel = Number(el.dataset.testLevel);
    sounds.tap();
    renderTestIntro();
  });
  on('[data-unit]', (el) => startTest(el.dataset.unit, level));
  if (p.autoRead) speak(intro);
}

export function startTest(unit, level) {
  const p = currentProfile();
  startQueue(testQueue(p.grade, unit, level), 'test', { test: true, unit, testLevel: level, answers: [] });
}

export function finishTest() {
  const p = currentProfile();
  const { firstTry: right, total, answers, missed, unit, testLevel: level } = session;
  const pct = Math.round((right / total) * 100);
  p.testBest ??= {};
  const key = `${unit}:${level}`;
  const oldBest = p.testBest[key];
  const newBest = oldBest === undefined || pct > oldBest;
  if (newBest) p.testBest[key] = pct;
  const entry = { t: Date.now(), topic: 'test', unit, level, firstTry: right, total, byTopic: session.byTopic };
  p.history.unshift(entry);
  p.history.length = Math.min(p.history.length, HISTORY_MAX);
  const bonuses = [];
  if (right === total) bonuses.push(['💯 Perfect test', TEST_PERFECT]);
  goalBonus(p, bonuses);
  teamBonus(p, bonuses);
  entry.coins = session.points + bonuses.reduce((sum, [, n]) => sum + n, 0);
  p.coins += entry.coins;
  p.questCount++;
  const grown = growBuddy(p, entry.coins);
  const stickers = checkStickers(p, { kind: 'test', firstTry: right, total, level });
  save();

  sounds.win();
  if (pct >= 80 || grown.after > grown.before) confetti(pct === 100 ? 200 : 100);
  const message = pct === 100 ? 'Perfect score! 💯' : pct >= 80 ? 'Great job!' : pct >= 60 ? 'Good work!' : 'Nice try! Practice makes you stronger.';
  const buddyLine = grown.after > grown.before
    ? 'Look, I grew! Thank you for practicing with me! 🎉'
    : missed.length ? 'Let’s look at the ones to practice. Mistakes help our brains grow! 💪' : 'You knew every one! 🌟';
  const rows = answers.map((a) => `
    <div class="review-row test-row ${a.right ? 'ok' : 'no'}">
      <span>${a.right ? '✅' : '❌'} ${esc(a.question)}</span>
      <strong>${a.right ? esc(a.answer) : `<s>${esc(a.given)}</s> → ${esc(a.answer)}`}</strong>
    </div>`).join('');

  show(`
    <div class="screen">
      <div class="panel results">
        ${buddyRow(p, buddyLine)}
        <h2>📝 ${message}</h2>
        <div class="speed-big">${right} / ${total}</div>
        <p class="result-line"><strong>${pct}%</strong> · ${unitEmoji(unit)} ${esc(unitName(unit))} · ${levelById(level).emoji} ${levelById(level).name}</p>
        ${newBest && oldBest !== undefined ? `<div class="badge">New best! (was ${oldBest}%)</div>` : ''}
        <p class="result-line">🪙 +${session.points} coins</p>
        ${bonuses.map(([label, n]) => `<p class="result-line bonus">${label}! 🪙 +${n}</p>`).join('')}
        ${grewLine(p, grown)}
        ${stickerLine(stickers)}
        ${growLine(p, entry.coins)}
        <div class="review"><h3>Your answers</h3>${rows}</div>
        <div class="panel-actions">
          ${missed.length ? `<button class="btn" data-action="practice">💡 Practice with hints</button>` : ''}
          <button class="btn secondary" data-action="tests">Another test</button>
          <button class="btn secondary" data-action="topics">Pick a quest</button>
        </div>
      </div>
    </div>`);

  bindBubble();
  say(buddyLine, 'happy');
  if (grown.after > grown.before) app.querySelector('#buddy').classList.add('growing');
  if (p.autoRead) speak(`${message} You got ${right} of ${total}. ${buddyLine}`);
  on('[data-action="topics"]', renderTopics);
  on('[data-action="tests"]', renderTestIntro);
  // Practice is a normal quest (with hints) on the unit, or the missed kinds from a Grade review.
  on('[data-action="practice"]', () => (unit === GRADE_REVIEW ? startReplay(missed) : startRound(unit)));
}
