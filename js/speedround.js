// The timed Speed Round.

import { speedFact } from './problems.js';
import { confetti, sounds } from './effects.js';
import { speak } from './speech.js';
import { pick, esc, save, currentProfile, levelById, topicLevel, HISTORY_MAX } from './state.js';
import { growBuddy, teamBonus, goalBonus, checkStickers, factFromKey } from './rewards.js';
import { app, sayButton, show, applyLook, on, growLine, grewLine, buddyRow, bindBubble, say, bindSound, stickerLine } from './ui.js';
import { playerBar, renderTopics } from './home.js';

export let speed = null; // the Speed Round being played

// A timed round of quick facts: as many as you can before the time runs out.
// Facts the kid missed before come up more often, and the Grown-ups page lists them.
export const SPEED_TIMES = [60, 120];

export const SPEED_NEW_BEST = 5; // bonus coins for beating your best

export const SPEED_UP_PACE = 15; // right answers a minute (at 90%+ right) to level up in Auto

export const speedKeyOf = (p, seconds) => `${p.grade}:${topicLevel(p, 'speed')}:${seconds}`;

export const speedBest = (p, seconds) => p.speed.best[speedKeyOf(p, seconds)] ?? 0;

export const minutes = (seconds) => `${seconds / 60} min`;

export function speedCard(p) {
  if (!p.speedOn) return '';
  const best = speedBest(p, 60);
  return `
    <button class="topic-card speed-card" data-action="speed">
      ${p.autoLevel ? `<span class="lvl-tag">${levelById(topicLevel(p, 'speed')).emoji}</span>` : ''}
      <div class="topic-emoji">⚡</div>
      <div class="topic-name">Speed Round</div>
      <div class="topic-desc">${p.grade === 2 ? 'Quick add & subtract facts' : 'Quick times & division facts'}</div>
      <div class="speed-best">${best ? `🏅 Best: ${best} in 1 min` : 'Beat the clock!'}</div>
    </button>`;
}

export function nextFact() {
  const p = currentProfile();
  const practice = Object.keys(p.speed.missed);
  let f;
  let tries = 0;
  // About 1 in 12 facts per practice fact, up to 1 in 4.
  const chance = Math.min(0.25, 0.08 * practice.length);
  do f = Math.random() < chance ? factFromKey(pick(practice)) : speedFact(p.grade, topicLevel(p, 'speed'));
  while (speed.recent.includes(f.key) && tries++ < 20);
  speed.recent = [f.key, ...speed.recent].slice(0, 4);
  return f;
}

export function renderSpeedIntro() {
  const p = currentProfile();
  applyLook(p);
  const times = SPEED_TIMES.map((sec) => {
    const best = speedBest(p, sec);
    return `<button class="level-opt" data-seconds="${sec}">⏱️ ${minutes(sec)}<small>${best ? `🏅 Best: ${best}` : 'No best yet'}</small></button>`;
  }).join('');
  const intro = `Answer as many as you can before time runs out! Type the answer. It checks by itself.`;
  show(`
    <div class="screen">
      ${playerBar(p)}
      <div class="panel speed-intro">
        ${buddyRow(p, 'Ready, set, go! ⚡')}
        <h2>⚡ Speed Round · ${p.autoLevel ? '🧭 ' : ''}${levelById(topicLevel(p, 'speed')).emoji} ${levelById(topicLevel(p, 'speed')).name}</h2>
        <p class="panel-note">${intro} ${sayButton('intro', 'Read aloud')}</p>
        <p class="panel-note">A wrong answer just shows the right one and keeps going. Facts you miss come back for practice.</p>
        <div class="levels" role="group" aria-label="How long">${times}</div>
        <p class="panel-note">🪙 1 coin for every right answer, plus ${SPEED_NEW_BEST} for a new best.</p>
      </div>
    </div>`);
  bindSound();
  bindBubble();
  on('[data-say="intro"]', () => speak(intro));
  on('[data-action="back"]', renderTopics);
  on('[data-seconds]', (el) => startSpeed(Number(el.dataset.seconds)));
}

export function startSpeed(seconds) {
  const p = currentProfile();
  speed = { seconds, score: 0, streak: 0, bestStreak: 0, missed: [], right: [], recent: [], input: '', running: false, locked: false, timer: null };
  const s = speed;
  show(`<div class="screen speed-count"><div class="countdown" id="count">3</div></div>`);
  sounds.tap();
  let n = 3;
  const tick = setInterval(() => {
    if (speed !== s) return clearInterval(tick);
    n--;
    if (n > 0) {
      const el = app.querySelector('#count');
      el.textContent = n;
      el.style.animation = 'none';
      void el.offsetWidth; // restart the pop
      el.style.animation = '';
      sounds.tap();
    } else {
      clearInterval(tick);
      playSpeed(p);
    }
  }, 700);
}

export function playSpeed(p) {
  const s = speed;
  s.current = nextFact();
  show(`
    <div class="screen speed-play">
      <div class="topbar">
        <button class="icon-btn" data-action="quit" aria-label="Quit">✕</button>
        <div class="progress timer"><div id="timeBar" style="width:100%"></div></div>
        <div class="streak" id="timeLeft">${s.seconds}</div>
      </div>
      <div class="question speed-q" id="question">
        <div class="speed-score">✅ <strong id="score">0</strong></div>
        <div class="prompt speed-fact" id="fact">${esc(s.current.text)} = ?</div>
        <div class="answer-display" id="answer">&nbsp;</div>
        <div class="feedback" id="feedback"></div>
      </div>
      <div class="numpad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-key="${n}">${n}</button>`).join('')}
        <button data-key="back" aria-label="Delete">⌫</button>
        <button data-key="0">0</button>
        <button data-key="enter" class="go" aria-label="Check answer">✓</button>
      </div>
    </div>`);
  on('[data-key]', (el) => speedKey(el.dataset.key));
  on('[data-action="quit"]', () => {
    if (!confirm('Stop the Speed Round? This round won’t count.')) return;
    stopSpeed();
    renderTopics();
  });
  s.running = true;
  s.end = Date.now() + s.seconds * 1000;
  s.timer = setInterval(() => {
    const left = Math.max(0, s.end - Date.now());
    const bar = app.querySelector('#timeBar');
    if (!bar || speed !== s) return clearInterval(s.timer);
    bar.style.width = `${(left / (s.seconds * 1000)) * 100}%`;
    bar.classList.toggle('low', left < 10000);
    app.querySelector('#timeLeft').textContent = Math.ceil(left / 1000);
    if (!left) finishSpeed();
  }, 100);
}

export function stopSpeed() {
  if (!speed) return;
  clearInterval(speed.timer);
  speed.running = false;
}

export function speedKey(key) {
  const s = speed;
  if (!s?.running || s.locked) return;
  const answer = s.current.answer;
  if (key === 'enter') {
    if (s.input) checkSpeed();
    return;
  }
  if (key === 'back') s.input = s.input.slice(0, -1);
  else if (s.input.length < 4) s.input = (s.input + key).replace(/^0+(?=\d)/, '');
  app.querySelector('#answer').textContent = s.input || ' ';
  // Check by itself once there are as many digits as the answer.
  if (s.input.length >= answer.length) checkSpeed();
}

export function checkSpeed() {
  const s = speed;
  const f = s.current;
  const fb = app.querySelector('#feedback');
  if (s.input === f.answer) {
    s.score++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    s.right.push(f.key);
    sounds.tap();
    app.querySelector('#score').textContent = s.score;
    fb.className = 'feedback good';
    fb.textContent = s.streak >= 5 ? `🔥 ${s.streak} in a row!` : '✓';
    showFact();
    return;
  }
  s.streak = 0;
  s.missed.push(f);
  s.locked = true;
  sounds.wrong();
  fb.className = 'feedback reveal';
  fb.textContent = '✗ Remember this one!';
  const el = app.querySelector('#fact');
  el.textContent = `${f.text} = ${f.answer}`;
  el.classList.add('missed');
  setTimeout(() => {
    if (speed !== s || !s.running) return;
    s.locked = false;
    fb.textContent = '';
    showFact();
  }, 1400);
}

export function showFact() {
  const s = speed;
  s.current = nextFact();
  s.input = '';
  const el = app.querySelector('#fact');
  el.textContent = `${s.current.text} = ?`;
  el.classList.remove('pop', 'missed');
  void el.offsetWidth; // restart the animation
  el.classList.add('pop');
  app.querySelector('#answer').textContent = ' ';
}

export function finishSpeed() {
  const p = currentProfile();
  const s = speed;
  stopSpeed();
  const { seconds, score, bestStreak } = s;
  const key = speedKeyOf(p, seconds);
  const oldBest = p.speed.best[key] ?? 0;
  const newBest = score > oldBest;
  if (newBest) p.speed.best[key] = score;

  // Practice list: right answers count down, then misses count up
  // (so a fact missed in this round always stays on the list).
  for (const k of s.right) {
    if (!p.speed.missed[k]) continue;
    if (--p.speed.missed[k] <= 0) delete p.speed.missed[k];
  }
  for (const f of s.missed) p.speed.missed[f.key] = (p.speed.missed[f.key] ?? 0) + 1;
  const level = topicLevel(p, 'speed');
  p.history.unshift({ t: Date.now(), topic: 'speed', level, speed: score, seconds, wrong: s.missed.length });
  // 🧭 Auto: the next Speed Round gets harder after a fast, accurate one, easier after a bumpy one.
  const tries = score + s.missed.length;
  const perMinute = score / (seconds / 60);
  let newLevel = level;
  if (p.autoLevel && tries >= 5) {
    if (level < 3 && score / tries >= 0.9 && perMinute >= SPEED_UP_PACE) newLevel = level + 1;
    else if (level > 1 && score / tries < 0.7) newLevel = level - 1;
    p.topicLevels.speed = newLevel;
  }
  p.history.length = Math.min(p.history.length, HISTORY_MAX);
  const bonuses = [];
  if (newBest && oldBest) bonuses.push(['🏅 New best', SPEED_NEW_BEST]);
  goalBonus(p, bonuses);
  teamBonus(p, bonuses);
  p.history[0].coins = score + bonuses.reduce((sum, [, n]) => sum + n, 0);
  p.coins += p.history[0].coins;
  p.questCount++;
  const grown = growBuddy(p, p.history[0].coins);
  const stickers = checkStickers(p, { kind: 'speed', score, seconds, wrong: s.missed.length, levelUp: newLevel > level });
  save();

  sounds.win();
  if (newBest || grown.after > grown.before) confetti(grown.after > grown.before ? 200 : 120);
  const toPractice = [...new Map(s.missed.map((f) => [f.key, f])).values()];
  const message = newBest ? (oldBest ? 'NEW BEST! 🏅' : 'Your first score! 🏅') : score >= oldBest - 2 ? 'So close to your best!' : 'Nice work!';
  const buddyLine = grown.after > grown.before
    ? 'Look, I grew! Thank you for practicing with me! 🎉'
    : newBest ? `${score}! You beat ${oldBest || 'the clock'}!` : `Your best is ${oldBest}. Let's try again!`;

  show(`
    <div class="screen">
      <div class="panel results">
        ${buddyRow(p, buddyLine)}
        <h2>⏰ Time's up! ${message}</h2>
        <div class="speed-big">${score}</div>
        <p class="result-line">right answers in ${minutes(seconds)} · ${levelById(level).emoji} ${levelById(level).name}</p>
        ${newLevel !== level ? `<p class="result-line">🧭 Next time: <strong>${levelById(newLevel).emoji} ${levelById(newLevel).name}</strong>${newLevel > level ? ' ⬆️ You were fast!' : ''}</p>` : ''}
        <p class="result-line">🪙 +${score} coins &nbsp; 🔥 Best streak: ${bestStreak}</p>
        ${bonuses.map(([label, n]) => `<p class="result-line bonus">${label}! 🪙 +${n}</p>`).join('')}
        ${grewLine(p, grown)}
        ${stickerLine(stickers)}
        ${growLine(p, p.history[0].coins)}
        ${
          toPractice.length
            ? `<div class="review"><h3>Facts to practice</h3>
                ${toPractice.map((f) => `<div class="review-row"><span>${esc(f.text)}</span><strong>${esc(f.answer)}</strong></div>`).join('')}
              </div>`
            : ''
        }
        <div class="panel-actions">
          <button class="btn secondary" data-action="topics">Pick another</button>
          <button class="btn" data-action="again">Go again ⚡</button>
        </div>
      </div>
    </div>`);

  bindBubble();
  say(buddyLine, 'happy');
  if (grown.after > grown.before) app.querySelector('#buddy').classList.add('growing');
  if (p.autoRead) speak(`Time's up! ${score} right answers. ${buddyLine}`);
  on('[data-action="topics"]', renderTopics);
  on('[data-action="again"]', () => startSpeed(seconds));
}
