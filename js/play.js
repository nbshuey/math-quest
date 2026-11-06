// Playing a round: questions, hints, "How do you know?", Tell your grown-up, results,
// and the short rounds (Try these again, daily warm-up, boss battles, 📝 Unit Tests).

import { TOPICS, LEVELS, stepText } from './problems.js';
import { confetti, sounds } from './effects.js';
import { speak, choiceWords } from './speech.js';
import { QUESTIONS_PER_ROUND, GREETINGS, pick, esc, save, currentProfile, buddyOf, levelById, topicLevel, AUTO_UP, AUTO_DOWN, buddyName, shuffle, coreTopics, findTopic, FOCUS_BONUS, HISTORY_MAX, PRAISE, ENCOURAGE } from './state.js';
import { growBuddy, teamBonus, goalBonus, checkStickers, BOSS_HP, BOSS_SHIELDS, BOSS_MAX_QUESTIONS, bossFor, WARMUP_BONUS, today, warmupDone, warmupStreak, noHelp } from './rewards.js';
import { app, starRow, sayButton, show, on, growLine, grewLine, buddyRow, bindBubble, say, bindSound, stickerLine } from './ui.js';
import { playerBar, renderTopics } from './home.js';
import { renderShop } from './shopscreen.js';
import { BUDDIES, HATS, THEMES } from './shop.js';
import { finishTest } from './unittest.js';

export let session = null; // the round being played
// Other modules can't assign an imported binding, so they call this.
export function setSession(value) {
  session = value;
}

// "How do you know?" comes up on these questions (or the next one answered right on the first try).
export const WHY_AT = [2, 5, 8];

export function startRound(topicId) {
  const p = currentProfile();
  const topic = TOPICS[p.grade].find((t) => t.id === topicId);
  // Mixed Challenge and Fix the Mistake pick focus areas more often.
  const core = coreTopics(p.grade);
  const focus = core.filter((t) => p.focus.includes(t.id));
  session = {
    topic, level: topicLevel(p, topic.id), auto: p.autoLevel, total: QUESTIONS_PER_ROUND, index: 0, firstTry: 0, streak: 0, bestStreak: 0,
    points: 0, byTopic: {}, upRun: 0, downRun: 0, levelNote: '', levelCounts: { 1: 0, 2: 0, 3: 0 },
    pool: [...core, ...focus, ...focus, ...focus], focus: p.focus.includes(topic.id),
    missed: [], seen: new Set(), whyDue: false, whyAsked: 0, whyRight: 0, tellAsked: 0, told: 0, tellOff: false, hinted: 0,
  };
  loadQuestion();
}

export function loadQuestion() {
  // Avoid repeating the same question within a round.
  let q;
  let tries = 0;
  if (session.queue) session.level = session.queue[session.index].level;
  do q = session.topic.gen(session.level, session.pool);
  while (session.seen.has(q.summary ?? q.prompt) && tries++ < 25);
  session.seen.add(q.summary ?? q.prompt);
  // 📝 A test question has no hints, steps or "How do you know?".
  if (session.test) q = noHelp(q);
  q.topicId ??= session.topic.id;
  q.level = session.level;
  session.levelCounts[q.level]++;
  const name = buddyName(currentProfile());
  for (const key of ['prompt', 'hint', 'summary']) if (q[key]) q[key] = q[key].replaceAll('{buddy}', name);
  // Each step is its text, or { text, pic } with a little picture.
  q.steps = session.test ? [] : (q.steps?.length ? q.steps : [q.hint]).map((step) =>
    typeof step === 'string' ? step.replaceAll('{buddy}', name) : { ...step, text: step.text.replaceAll('{buddy}', name) });
  if (WHY_AT.includes(session.index) && !session.test) session.whyDue = true;
  Object.assign(session, { current: q, attempts: 0, locked: false, input: '', stepsShown: 0 });
  renderQuestion();
}

// 🧭 Auto: move up after a run of first-try answers, down after a run of misses.
export function trackLevel(firstTry) {
  const s = session;
  if (firstTry) [s.upRun, s.downRun] = [s.upRun + 1, 0];
  else [s.upRun, s.downRun] = [0, s.downRun + 1];
  if (!s.auto) return;
  if (s.upRun >= AUTO_UP && s.level < 3) {
    s.level++;
    s.leveledUp = true;
    s.levelNote = `Level up! ⬆️ Let's try ${levelById(s.level).emoji} ${levelById(s.level).name}.`;
  } else if (s.downRun >= AUTO_DOWN && s.level > 1) {
    s.level--;
    s.levelNote = `Let's warm up with some ${levelById(s.level).emoji} ${levelById(s.level).name} ones. ⬇️`;
  } else return;
  s.upRun = 0;
  s.downRun = 0;
}

export function nextQuestion() {
  session.index++;
  const b = session.boss;
  if (b && (b.hp <= 0 || b.shields <= 0 || session.index >= session.total)) finishBoss();
  else if (session.index >= session.total) session.mode === 'test' ? finishTest() : session.mode === 'warmup' ? finishWarmup() : session.queue ? finishReplay() : finishRound();
  else loadQuestion();
}

// Everything on the question card, as words to read aloud.
export function questionSpeech(q) {
  const name = buddyName(currentProfile());
  const parts = [q.prompt];
  const summary = q.spoken ?? (q.claim !== undefined ? q.baseSummary : q.summary);
  if (q.visual && summary) parts.push(summary);
  if (q.claim !== undefined) parts.push(`${name} says ${choiceWords(q.claim)}. Is ${name} right?`);
  else if (q.choices) parts.push(`Is it ${q.choices.map(choiceWords).join(', or ')}?`);
  return parts.join('. ').replace(/\?\./g, '?');
}

// "Ruby has 32 gems and gets 17 more. How many gems now?" → two sentences.
export const splitSentences = (text) => text.split(/(?<=[.?!])\s+(?=[A-Z0-9"])/).filter(Boolean);

export function sentencePrompt(sentences) {
  return `<div class="prompt word sentences" id="sentences">${sentences
    .map((t, i) => `<span class="sentence ${i ? 'hidden' : 'latest'}">${esc(t)}</span>`)
    .join(' ')}</div>
    <button class="btn secondary small" data-action="nextSentence" id="nextSentence">📖 Next sentence (2 of ${sentences.length})</button>
    <div class="planner hidden" id="planner"></div>`;
}

// Shows the next sentence; after the last one, a "What do we know? What are we finding?" box.
export function showSentence(sentences) {
  const n = session.shownSentences;
  if (!sentences || n >= sentences.length) return;
  const spans = app.querySelectorAll('#sentences .sentence');
  spans.forEach((el) => el.classList.remove('latest'));
  spans[n].classList.remove('hidden');
  spans[n].classList.add('latest');
  session.shownSentences++;
  if (currentProfile().autoRead) speak(sentences[n]);
  const btn = app.querySelector('#nextSentence');
  if (session.shownSentences < sentences.length) {
    btn.textContent = `📖 Next sentence (${session.shownSentences + 1} of ${sentences.length})`;
    return;
  }
  btn.remove();
  if (session.test) return; // the "What do we know?" box is help, so tests leave it out
  const asks = sentences.filter((t) => t.trim().endsWith('?'));
  const facts = sentences.filter((t) => !t.trim().endsWith('?')).join(' ');
  // Each number with the word after it: "32 gems", "17 more", "90°".
  const filler = /^ (of|and|a|an|the|to|in|on|is|then)$/i;
  const known = [...facts.matchAll(/(\d[\d,]*(?::\d\d)?(?:\/\d+)?(?: \d+\/\d+)?)(°| square [a-zA-Z]+| [a-zA-Z]+)?/g)]
    .map((m) => `${m[1]}${m[2] && !filler.test(m[2]) ? m[2] : ''}`);
  const planner = app.querySelector('#planner');
  planner.innerHTML = `
    ${known.length ? `<div><strong>🔎 What do we know?</strong> ${known.map((k) => `<span class="chip">${esc(k)}</span>`).join(' ')}</div>` : ''}
    ${asks.length ? `<div><strong>🎯 What are we finding?</strong> ${esc(asks[asks.length - 1])}</div>` : ''}`;
  planner.classList.remove('hidden');
}

export function renderQuestion() {
  const p = currentProfile();
  const q = session.current;
  // 📖 Word problems one sentence at a time (a reading-help setting).
  const split = q.word ? splitSentences(q.prompt) : [];
  const sentences = p.wordSteps && split.length > 1 ? split : null;
  session.shownSentences = 1;
  const pct = (session.index / session.total) * 100;
  const input = q.choices
    ? `<div class="choices ${q.claim !== undefined ? 'two' : ''} ${q.choices.some((c) => c.length > 6) ? 'long' : ''}">${q.choices.map((c) => `<button class="choice" data-choice="${esc(c)}">${esc(c)}</button>`).join('')}</div>`
    : `<div class="numpad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-key="${n}">${n}</button>`).join('')}
        <button data-key="back" aria-label="Delete">⌫</button>
        <button data-key="0">0</button>
        <button data-key="enter" class="go" aria-label="Check answer">✓</button>
      </div>`;
  const note = session.levelNote;
  session.levelNote = '';
  const test = session.test;
  const greeting = test ? 'No hints on a test. Do your best! 💪' : note || (q.claim !== undefined
    ? 'I tried this one. Did I get it right?'
    : session.streak >= 3 ? `${session.streak} in a row! 🔥` : pick(GREETINGS));
  const claim = q.claim !== undefined
    ? `<div class="claim">${buddyOf(p).emoji} <span>${esc(buddyName(p))} says: <strong>${esc(q.claim)}</strong></span></div>
       <div class="claim-ask">Is ${esc(buddyName(p))} right?</div>`
    : '';

  show(`
    <div class="screen play">
      <div class="topbar">
        <button class="icon-btn" data-action="quit" aria-label="Quit">✕</button>
        <div class="progress"><div style="width:${pct}%"></div></div>
        ${test ? '<div class="streak">📝</div>' : `<div class="streak" title="Streak">${session.streak >= 2 ? '🔥' : ''}${session.streak}</div>`}
      </div>
      ${buddyRow(p, greeting)}
      ${session.boss ? bossBar(session.boss) : ''}
      <div class="question" id="question">
        ${sayButton('question', 'Read the question aloud')}
        <div class="q-count">${session.topic.emoji} ${test ? 'Test question ' : session.mode === 'warmup' ? 'Warm-up ' : session.queue ? 'Try again ' : 'Question '}${session.index + 1} of ${session.total} · ${session.auto ? '🧭 ' : ''}${levelById(q.level).emoji} ${levelById(q.level).name}</div>
        ${sentences ? sentencePrompt(sentences) : `<div class="prompt ${q.word ? 'word' : ''}">${esc(q.prompt)}</div>`}
        ${q.visual ? `<div class="visual">${q.visual}</div>` : ''}
        ${claim}
        ${q.choices ? '' : '<div class="answer-display" id="answer">&nbsp;</div>'}
        <div class="feedback" id="feedback"></div>
        ${test ? '' : `<div class="hint hidden" id="hint">
          <div class="hint-head">💡 Step by step</div>
          <ol class="steps" id="steps"></ol>
        </div>`}
      </div>
      <div id="input-area">${input}</div>
      <div class="play-actions">
        ${test ? '' : '<button class="btn secondary" data-action="hint" id="hintBtn">💡 Hint</button>'}
        <button class="btn hidden" data-action="next" id="next">Next ➜</button>
      </div>
    </div>`);

  bindBubble();
  on('[data-say="question"]', () => speak(sentences && session.shownSentences < sentences.length ? sentences.slice(0, session.shownSentences).join(' ') : questionSpeech(q)));
  on('[data-action="nextSentence"]', () => showSentence(sentences));
  on('[data-key]', (el) => pressKey(el.dataset.key));
  on('[data-choice]', (el) => submit(el.dataset.choice, el));
  on('[data-action="hint"]', showHint);
  on('[data-action="next"]', nextQuestion);
  on('[data-action="quit"]', () => {
    if (confirm(test ? 'Stop the test? It won’t count.' : 'Quit this quest? Your progress in this round will be lost.')) renderTopics();
  });
  if (p.autoRead) speak(sentences ? sentences[0] : questionSpeech(q));
}

export function pressKey(key) {
  if (session.locked) return;
  if (key === 'enter') return submit(session.input);
  if (key === 'back') session.input = session.input.slice(0, -1);
  else if (session.input.length < 8) session.input = (session.input + key).replace(/^0+(?=\d)/, '');
  app.querySelector('#answer').textContent = session.input ? Number(session.input).toLocaleString('en-US') : ' ';
}

// Step-by-step hints: each tap shows one more step. The last step always
// leaves the final bit of work for the kid.
export function showHint() {
  if (session.test) return;
  const q = session.current;
  const n = session.stepsShown;
  if (n >= q.steps.length) return;
  if (n === 0) recordHint(q);
  session.stepsShown++;
  const step = stepText(q.steps[n]);
  const pic = q.steps[n].pic;
  const list = app.querySelector('#steps');
  list.querySelectorAll('li').forEach((li) => li.classList.remove('latest'));
  // Only the newest step keeps its picture, so the card doesn't get too tall.
  list.querySelectorAll('.step-pic').forEach((el) => el.remove());
  list.insertAdjacentHTML('beforeend', `<li class="latest"><span>${esc(step)}</span> ${sayButton(`step-${n}`, `Read step ${n + 1} aloud`)}${pic ? `<div class="step-pic">${pic}</div>` : ''}</li>`);
  list.querySelector(`[data-say="step-${n}"]`)?.addEventListener('click', () => speak(step));
  app.querySelector('#hint').classList.remove('hidden');

  const btn = app.querySelector('#hintBtn');
  const left = q.steps.length - session.stepsShown;
  if (left) btn.textContent = `👣 Next step (${session.stepsShown + 1} of ${q.steps.length})`;
  else btn.classList.add('hidden');
  if (currentProfile().autoRead) speak(step);
}

export function setFeedback(kind, text) {
  const el = app.querySelector('#feedback');
  el.className = `feedback ${kind}`;
  el.textContent = text;
}

// Progress for the Grown-ups page, counted under the question's own topic
// (so Mixed Challenge questions count toward Fractions, Rounding, ...).
export function topicStats(q) {
  const p = currentProfile();
  p.stats[q.topicId] ??= { asked: 0, firstTry: 0, whyAsked: 0, whyRight: 0, last: 0 };
  p.stats[q.topicId].tellAsked ??= 0;
  p.stats[q.topicId].told ??= 0;
  p.stats[q.topicId].hinted ??= 0;
  return p.stats[q.topicId];
}

export function recordHint(q) {
  topicStats(q).hinted++;
  session.hinted++;
  save();
}

export function recordAnswer(q, firstTry) {
  const s = topicStats(q);
  s.asked++;
  if (firstTry) s.firstTry++;
  s.last = Date.now();
  // Per-topic results for this round, for the weekly report.
  const t = (session.byTopic[q.topicId] ??= [0, 0]);
  t[0]++;
  if (firstTry) t[1]++;
  save();
}

export function recordWhy(q, right) {
  const s = topicStats(q);
  s.whyAsked++;
  if (right) s.whyRight++;
  save();
}

export function recordTell(q, great) {
  const s = topicStats(q);
  s.tellAsked++;
  if (great) s.told++;
  save();
}

export function submit(value, choiceEl) {
  const q = session.current;
  const buddy = buddyOf(currentProfile());
  if (session.locked || value === '') return;
  const correct = q.choices ? value === q.answer : Number(value) === Number(q.answer.replace(/,/g, ''));
  if (session.test) return submitTest(q, value, correct, choiceEl);

  if (correct) {
    session.locked = true;
    trackLevel(session.attempts === 0);
    if (session.attempts === 0) {
      if (session.boss) bossHit();
      session.firstTry++;
      session.points += q.level;
      session.streak++;
      session.bestStreak = Math.max(session.bestStreak, session.streak);
    }
    recordAnswer(q, session.attempts === 0);
    choiceEl?.classList.add('right');
    setFeedback('good', '✓ Correct!');
    say(pick([...buddy.cheer, ...PRAISE]), 'happy');
    sounds.correct();
    confetti(session.streak >= 3 ? 60 : 30);
    const s = session;
    const whyNow = session.whyDue || currentProfile().whyEvery;
    const askWhy = q.why && (q.alwaysWhy || (session.attempts === 0 && whyNow));
    if (askWhy) {
      session.whyDue = false;
      setTimeout(() => session === s && showWhy(q), 900);
    } else {
      setTimeout(() => session === s && nextQuestion(), 1300);
    }
    return;
  }

  session.attempts++;
  session.streak = 0;
  sounds.wrong();
  if (session.boss && session.attempts === 1) bossAttack();
  const card = app.querySelector('#question');
  card.classList.remove('shake');
  void card.offsetWidth; // restart the animation
  card.classList.add('shake');

  if (session.attempts < 2) {
    setFeedback('try', '✗ Try again');
    say(pick([...buddy.oops, ...ENCOURAGE]), 'sad');
    showHint();
    if (choiceEl) {
      choiceEl.classList.add('wrong');
      choiceEl.disabled = true;
    } else {
      session.input = '';
      app.querySelector('#answer').textContent = ' ';
    }
    return;
  }

  // Second miss: show the answer and let them move on.
  session.locked = true;
  const shown = q.choices ? q.answer : Number(q.answer).toLocaleString('en-US');
  session.missed.push({ question: q.summary ?? q.prompt, answer: shown, topicId: q.topicId, level: q.level });
  recordAnswer(q, false);
  trackLevel(false);
  setFeedback('reveal', `The answer is ${shown}`);
  app.querySelector('#hintBtn').classList.add('hidden');
  say("That's a tricky one. We'll get the next one!", 'sad');
  if (choiceEl) choiceEl.classList.add('wrong');
  app.querySelectorAll('[data-choice]').forEach((b) => b.dataset.choice === q.answer && b.classList.add('right'));
  app.querySelector('#next').classList.remove('hidden');
}

// 📝 On a test: one try, and no right or wrong until the end.
export function submitTest(q, value, correct, choiceEl) {
  session.locked = true;
  const answer = q.choices ? q.answer : Number(q.answer).toLocaleString('en-US');
  const given = q.choices ? value : Number(value).toLocaleString('en-US');
  const item = { question: q.summary ?? q.prompt, answer, given, right: correct, topicId: q.topicId, level: q.level };
  session.answers.push(item);
  recordAnswer(q, correct);
  if (correct) {
    session.firstTry++;
    session.points += q.level;
  } else session.missed.push(item);
  choiceEl?.classList.add('picked');
  app.querySelectorAll('[data-choice]').forEach((b) => (b.disabled = true));
  setFeedback('saved', '📝 Answer saved');
  sounds.tap();
  const s = session;
  setTimeout(() => session === s && nextQuestion(), 800);
}

// "How do you know?": pick the explanation that matches the thinking.
export function showWhy(q) {
  const p = currentProfile();
  const ask = q.whyAsk ?? 'How do you know?';
  const options = shuffle([{ text: q.why.right, right: true }, ...q.why.wrong.map((text) => ({ text }))]);
  session.whyAsked++;

  app.querySelector('#hintBtn').classList.add('hidden');
  app.querySelector('#hint').classList.add('hidden');
  app.querySelector('#input-area').innerHTML = `
    <div class="why">
      <div class="why-ask">🧠 ${esc(ask)} ${sayButton('why', 'Read the choices aloud')}</div>
      ${q.why.visual && !q.visual?.includes(q.why.visual) ? `<div class="visual why-visual">${q.why.visual}</div>` : ''}
      <div class="why-options">
        ${options.map((o, i) => `
          <div class="why-row">
            <button class="why-opt" data-why="${i}"><span class="why-letter">${'ABC'[i]}</span><span>${esc(o.text)}</span></button>
            ${sayButton(`why-${i}`, `Read choice ${'ABC'[i]} aloud`)}
          </div>`).join('')}
      </div>
    </div>`;
  say(ask, 'happy');

  const allChoices = `${ask} ${options.map((o, i) => `${'ABC'[i]}: ${o.text}`).join(' ')}`;
  on('[data-say="why"]', () => speak(allChoices));
  options.forEach((o, i) => on(`[data-say="why-${i}"]`, () => speak(o.text)));
  on('[data-why]', (el) => {
    if (session.whyDone) return;
    session.whyDone = true;
    const chosen = options[Number(el.dataset.why)];
    recordWhy(q, !!chosen.right);
    app.querySelectorAll('[data-why]').forEach((b) => {
      b.disabled = true;
      if (options[Number(b.dataset.why)].right) b.classList.add('right');
    });
    if (chosen.right) {
      session.whyRight++;
      session.points += q.level;
      sounds.correct();
      confetti(40);
      say('Great thinking! 🧠 Bonus coins!', 'happy');
    } else {
      el.classList.add('wrong');
      sounds.wrong();
      say("Here's the right thinking. Let's read it together.", 'sad');
      if (p.autoRead) speak(q.why.right);
    }
    if (tellDue()) {
      const s = session;
      setTimeout(() => session === s && showTell(q), 1400);
    } else app.querySelector('#next').classList.remove('hidden');
  });
  session.whyDone = false;
  if (p.autoRead) speak(allChoices);
}

// "Tell your grown-up": after picking an explanation, the kid says it out loud
// and a grown-up taps how it went. Twice a round at most, and easy to skip.
export const TELL_STARTERS = [
  'First I…, then I…',
  'I know it’s right because…',
  'I can check it by…',
  'The picture shows…',
  'It’s not the other answer because…',
  'The trick I used was…',
];

export const TELL_MAX = 2;

export const TELL_AFTER = [2, 6]; // the earliest question for the 1st and 2nd prompt

export function tellDue() {
  return currentProfile().tellGrownUp && !session.tellOff && session.tellAsked < TELL_MAX && session.index >= TELL_AFTER[session.tellAsked];
}

export function showTell(q) {
  const p = currentProfile();
  session.tellAsked++;
  const starters = shuffle(TELL_STARTERS).slice(0, 3);
  const words = `Tell your grown-up how you solved it. You can start with: ${starters.join(' Or: ')}`;
  app.querySelector('#input-area').insertAdjacentHTML('beforeend', `
    <div class="tell" id="tell">
      <div class="why-ask">🗣️ Tell your grown-up! ${sayButton('tell', 'Read aloud')}</div>
      <p class="tell-sub">Say out loud how you solved it. You can start with:</p>
      <div class="tell-starters">${starters.map((t) => `<span class="tell-starter">“${esc(t)}”</span>`).join('')}</div>
      <div class="tell-grownup">
        <div class="tell-label">👪 Grown-up: how did the explaining go?</div>
        <div class="tell-actions">
          <button class="btn" data-tell="great">⭐ Great explaining!</button>
          <button class="btn secondary" data-tell="practice">💪 Getting there</button>
        </div>
        <button class="link-btn" data-tell="skip">No grown-up here right now</button>
      </div>
    </div>`);
  app.querySelector('#tell').scrollIntoView({ behavior: 'smooth', block: 'center' });
  say('Tell your grown-up how you know!', 'happy');
  on('[data-say="tell"]', () => speak(words));
  on('[data-tell]', (el) => {
    const kind = el.dataset.tell;
    const card = app.querySelector('#tell');
    if (kind === 'skip') {
      // No one to listen: stop asking for the rest of this round.
      session.tellAsked--;
      session.tellOff = true;
      card.remove();
    } else {
      const great = kind === 'great';
      recordTell(q, great);
      if (great) {
        session.told++;
        session.points += q.level;
        sounds.win();
        confetti(60);
      } else sounds.tap();
      const line = great ? 'Wow, great explaining! 🗣️ Bonus coins!' : 'Thanks for explaining! Talking it out makes your brain stronger. 💪';
      card.innerHTML = `<div class="tell-done">${line}</div>`;
      say(line, 'happy');
    }
    app.querySelector('#next').classList.remove('hidden');
  });
  if (p.autoRead) speak(words);
}

export function finishRound() {
  const p = currentProfile();
  const { topic, firstTry, bestStreak, missed, whyAsked, whyRight, tellAsked, told, hinted, auto, levelCounts } = session;
  // The level most questions were at (the higher one on a tie) gets the stars.
  const level = [3, 2, 1].reduce((best, l) => (levelCounts[l] > levelCounts[best] ? l : best), 3);
  const startLevel = topicLevel(p, topic.id);
  if (auto) p.topicLevels[topic.id] = session.level;
  const stars = firstTry >= 9 ? 3 : firstTry >= 7 ? 2 : firstTry >= 5 ? 1 : 0;
  const key = `${topic.id}:${level}`;
  const newBest = stars > (p.best[key] || 0);
  if (newBest) p.best[key] = stars;
  const earned = session.points;
  const entry = { t: Date.now(), topic: topic.id, level, firstTry, whyAsked, whyRight, tellAsked, told, hinted, byTopic: session.byTopic };
  p.history.unshift(entry);
  p.history.length = Math.min(p.history.length, HISTORY_MAX);
  const bonuses = [];
  if (session.focus) bonuses.push(['⭐ Focus quest bonus', FOCUS_BONUS]);
  goalBonus(p, bonuses);
  teamBonus(p, bonuses);
  entry.coins = earned + bonuses.reduce((sum, [, n]) => sum + n, 0);
  p.coins += entry.coins;
  p.questCount++;
  if (!topic.extra) p.bossProgress[topic.id] = (p.bossProgress[topic.id] ?? 0) + 1;
  const grown = growBuddy(p, entry.coins);
  const stickers = checkStickers(p, { kind: 'quest', topicId: topic.id, level, firstTry, bestStreak, whyRight, told, levelUp: !!session.leveledUp });
  save();

  sounds.win();
  if (stars > 0 || grown.after > grown.before) confetti(grown.after > grown.before ? 200 : 120);
  const message = ["Keep practicing, you're getting stronger!", 'Good job!', 'Great work!', 'PERFECT QUEST! 🏆'][stars];
  const nextLevel = !auto && stars === 3 && level < 3 ? LEVELS[level] : null;
  const moved = auto && session.level !== startLevel;
  const cheapest = [...BUDDIES, ...HATS, ...THEMES].filter((i) => i.price > p.coins).sort((a, b) => a.price - b.price)[0];
  const buddyLine = grown.after > grown.before
    ? `Look, I grew! Thank you for practicing with me! 🎉`
    : nextLevel
    ? `Wow! Ready to try ${nextLevel.emoji} ${nextLevel.name}?`
    : moved && session.level > startLevel
      ? `You leveled up to ${levelById(session.level).emoji} ${levelById(session.level).name}! 🧭`
    : cheapest
      ? `${cheapest.price - p.coins} more coins to unlock ${cheapest.name}!`
      : 'You can shop for something new!';

  show(`
    <div class="screen">
      <div class="panel results">
        ${buddyRow(p, buddyLine)}
        <h2>${message}</h2>
        <div class="big-stars">${starRow(stars)}</div>
        ${newBest ? '<div class="badge">New best!</div>' : ''}
        <p class="result-line">You got <strong>${firstTry} of ${QUESTIONS_PER_ROUND}</strong> on the first try.</p>
        ${whyAsked ? `<p class="result-line">🧠 Great thinking: <strong>${whyRight} of ${whyAsked}</strong> explanations</p>` : ''}
        ${tellAsked ? `<p class="result-line">🗣️ Explained out loud: <strong>${told} of ${tellAsked}</strong> great</p>` : ''}
        ${grewLine(p, grown)}
        ${stickerLine(stickers)}
        <p class="result-line">🪙 +${earned} coins &nbsp; 🔥 Best streak: ${bestStreak}</p>
        ${auto ? `<p class="result-line">🧭 Level: ${moved ? `${levelById(startLevel).emoji} ${levelById(startLevel).name} → ` : ''}<strong>${levelById(session.level).emoji} ${levelById(session.level).name}</strong>${moved ? '' : ' (staying here)'}</p>` : ''}
        ${bonuses.map(([label, n]) => `<p class="result-line bonus">${label}! 🪙 +${n}</p>`).join('')}
        ${growLine(p, entry.coins)}
        ${
          missed.length
            ? `<div class="review"><h3>Let's look at these again</h3>
                ${missed.map((m) => `<div class="review-row"><span>${esc(m.question)}</span><strong>${esc(m.answer)}</strong></div>`).join('')}
              </div>`
            : ''
        }
        <div class="panel-actions">
          ${missed.length ? `<button class="btn" data-action="replay">🔁 Try these again (${Math.min(missed.length, REPLAY_MAX)})</button>` : ''}
          <button class="btn secondary" data-action="shop">🛒 Shop</button>
          <button class="btn secondary" data-action="topics">Pick another</button>
          ${nextLevel ? `<button class="btn" data-action="harder">Try ${nextLevel.name} ${nextLevel.emoji}</button>` : '<button class="btn" data-action="again">Play again</button>'}
        </div>
      </div>
    </div>`);

  bindBubble();
  say(buddyLine, 'happy');
  if (grown.after > grown.before) app.querySelector('#buddy').classList.add('growing');
  if (p.autoRead) speak(`${message} You got ${firstTry} of ${QUESTIONS_PER_ROUND} on the first try. ${buddyLine}`);
  on('[data-action="shop"]', () => renderShop());
  on('[data-action="topics"]', renderTopics);
  on('[data-action="again"]', () => startRound(topic.id));
  on('[data-action="replay"]', () => startReplay(missed));
  on('[data-action="harder"]', () => {
    p.level = nextLevel.id;
    save();
    startRound(topic.id);
  });
}

export function renderBossIntro(topicId) {
  const p = currentProfile();
  const topic = findTopic(topicId);
  const b = bossFor(topicId);
  const wins = p.bossWins[topicId] ?? 0;
  show(`
    <div class="screen">
      ${playerBar(p)}
      <div class="panel boss-intro">
        <div class="boss-big">${b.emoji}</div>
        <h2>A wild ${esc(b.name)} appeared!</h2>
        <p class="panel-note">It wants to stop your ${topic.emoji} ${esc(topic.name)} practice. Each answer you get right on the first try takes one of its ${BOSS_HP} hearts ❤️. Each first miss costs one of your ${BOSS_SHIELDS} shields 🛡️.${wins ? ` You've beaten it ${wins} time${wins > 1 ? 's' : ''}!` : ''}</p>
        <div class="panel-actions">
          <button class="btn secondary" data-action="normal">Normal quest</button>
          <button class="btn" data-action="battle">⚔️ Battle!</button>
        </div>
      </div>
    </div>`);
  bindSound();
  sounds.wrong();
  on('[data-action="back"]', renderTopics);
  on('[data-action="normal"]', () => startRound(topicId));
  on('[data-action="battle"]', () => {
    startRound(topicId);
    Object.assign(session, { boss: { ...b, hp: BOSS_HP, shields: BOSS_SHIELDS }, total: BOSS_MAX_QUESTIONS, auto: false, tellOff: true });
    renderQuestion();
    say(`Let's beat the ${b.name} together! ⚔️`, 'happy');
  });
}

export const bossBar = (b) => `
  <div class="boss-bar" id="bossBar">
    <span class="boss-emoji" id="bossEmoji">${b.emoji}</span>
    <span class="boss-info"><strong>${esc(b.name)}</strong><span class="boss-hearts">${'❤️'.repeat(Math.max(0, b.hp))}${'🤍'.repeat(BOSS_HP - Math.max(0, b.hp))}</span></span>
    <span class="boss-shields" title="Your shields">${'🛡️'.repeat(Math.max(0, b.shields))}<span class="lost">${'🛡️'.repeat(BOSS_SHIELDS - Math.max(0, b.shields))}</span></span>
  </div>`;

export function refreshBossBar() {
  const el = app.querySelector('#bossBar');
  if (el) el.outerHTML = bossBar(session.boss);
}

export function bossHit() {
  session.boss.hp--;
  refreshBossBar();
  const e = app.querySelector('#bossEmoji');
  e?.classList.add('hit');
  if (session.boss.hp <= 0) {
    e?.classList.add('defeated');
    confetti(120);
  }
}

export function bossAttack() {
  session.boss.shields--;
  refreshBossBar();
  app.querySelector('#bossEmoji')?.classList.add('attack');
}

export function finishBoss() {
  const p = currentProfile();
  const { topic, firstTry, missed, boss, level, index } = session;
  const won = boss.hp <= 0;
  // Save the round first so it counts toward the weekly and team goals.
  const entry = { t: Date.now(), topic: topic.id, level, firstTry, total: index, boss: won ? 'won' : 'lost', whyAsked: session.whyAsked, whyRight: session.whyRight, hinted: session.hinted, byTopic: session.byTopic };
  p.history.unshift(entry);
  p.history.length = Math.min(p.history.length, HISTORY_MAX);
  const bonuses = [];
  if (won) bonuses.push([`👾 Beat the ${boss.name}`, 10 + 5 * level]);
  goalBonus(p, bonuses);
  teamBonus(p, bonuses);
  const coins = session.points + bonuses.reduce((sum, [, n]) => sum + n, 0);
  entry.coins = coins;
  p.questCount++;
  if (won) {
    p.bossProgress[topic.id] = 0;
    p.bossWins[topic.id] = (p.bossWins[topic.id] ?? 0) + 1;
  }
  p.coins += coins;
  const grown = growBuddy(p, coins);
  const stickers = checkStickers(p, { kind: 'boss', won });
  save();

  sounds.win();
  if (won) confetti(200);
  const buddyLine = grown.after > grown.before
    ? 'Look, I grew! Thank you for practicing with me! 🎉'
    : won ? `We did it! The ${boss.name} ran away! 🏆` : `The ${boss.name} got away this time. It'll be back, and we'll be ready! 💪`;

  show(`
    <div class="screen">
      <div class="panel results">
        ${buddyRow(p, buddyLine)}
        <div class="boss-big ${won ? 'defeated' : ''}">${boss.emoji}</div>
        <h2>${won ? `🏆 You beat the ${esc(boss.name)}!` : `The ${esc(boss.name)} escaped!`}</h2>
        <p class="result-line">${firstTry} of ${index} right on the first try · ${'❤️'.repeat(Math.max(0, boss.hp))}${'🤍'.repeat(BOSS_HP - Math.max(0, boss.hp))}</p>
        <p class="result-line">🪙 +${session.points} coins</p>
        ${bonuses.map(([label, n]) => `<p class="result-line bonus">${label}! 🪙 +${n}</p>`).join('')}
        ${stickerLine(stickers)}
        ${grewLine(p, grown)}
        ${growLine(p, coins)}
        ${missed.length ? `<div class="review"><h3>Let's look at these again</h3>
          ${missed.map((m) => `<div class="review-row"><span>${esc(m.question)}</span><strong>${esc(m.answer)}</strong></div>`).join('')}</div>` : ''}
        <div class="panel-actions">
          ${missed.length ? `<button class="btn secondary" data-action="replay">🔁 Try these again</button>` : ''}
          ${won ? '' : '<button class="btn" data-action="rematch">⚔️ Rematch</button>'}
          <button class="btn ${won ? '' : 'secondary'}" data-action="topics">Pick a quest</button>
        </div>
      </div>
    </div>`);
  bindBubble();
  say(buddyLine, 'happy');
  if (grown.after > grown.before) app.querySelector('#buddy').classList.add('growing');
  if (p.autoRead) speak(`${won ? `You beat the ${boss.name}!` : `The ${boss.name} escaped.`} ${buddyLine}`);
  on('[data-action="topics"]', renderTopics);
  on('[data-action="replay"]', () => startReplay(missed));
  on('[data-action="rematch"]', () => renderBossIntro(topic.id));
}

export function finishWarmup() {
  const p = currentProfile();
  const { firstTry, total, missed } = session;
  const first = !warmupDone(p);
  const bonuses = [];
  if (first) {
    const streak = warmupStreak(p) + 1;
    p.warmup = { day: today(), streak };
    bonuses.push([`☀️ Daily warm-up${streak > 1 ? ` · ${streak}-day streak` : ''}`, WARMUP_BONUS + Math.min(streak - 1, 5)]);
  }
  const coins = session.points + bonuses.reduce((sum, [, n]) => sum + n, 0);
  const level = [3, 2, 1].reduce((best, l) => (session.levelCounts[l] > session.levelCounts[best] ? l : best), 3);
  p.history.unshift({ t: Date.now(), topic: 'warmup', level, firstTry, total, whyAsked: session.whyAsked, whyRight: session.whyRight, hinted: session.hinted, byTopic: session.byTopic, coins });
  p.history.length = Math.min(p.history.length, HISTORY_MAX);
  p.coins += coins;
  const grown = growBuddy(p, coins);
  const stickers = checkStickers(p, { kind: 'warmup', firstTry, total });
  save();

  sounds.win();
  confetti(first ? 100 : 40);
  const streak = warmupStreak(p);
  const buddyLine = grown.after > grown.before
    ? 'Look, I grew! Thank you for practicing with me! 🎉'
    : first ? (streak > 1 ? `${streak} days in a row! Your brain is warmed up! 🔥` : 'Brain warmed up! See you tomorrow! ☀️') : 'Extra practice makes extra strong! 💪';

  show(`
    <div class="screen">
      <div class="panel results">
        ${buddyRow(p, buddyLine)}
        <h2>☀️ Warm-up done! ${firstTry} of ${total}</h2>
        ${first ? `<p class="result-line">🔥 Warm-up streak: <strong>${streak} day${streak > 1 ? 's' : ''}</strong></p>` : ''}
        <p class="result-line">🪙 +${session.points} coins</p>
        ${bonuses.map(([label, n]) => `<p class="result-line bonus">${label}! 🪙 +${n}</p>`).join('')}
        ${stickerLine(stickers)}
        ${grewLine(p, grown)}
        ${growLine(p, coins)}
        ${missed.length ? `<div class="review"><h3>Let's look at these again</h3>
          ${missed.map((m) => `<div class="review-row"><span>${esc(m.question)}</span><strong>${esc(m.answer)}</strong></div>`).join('')}</div>` : ''}
        <div class="panel-actions">
          ${missed.length ? `<button class="btn" data-action="replay">🔁 Try these again (${missed.length})</button>` : ''}
          <button class="btn ${missed.length ? 'secondary' : ''}" data-action="topics">Pick a quest</button>
        </div>
      </div>
    </div>`);
  bindBubble();
  say(buddyLine, 'happy');
  if (grown.after > grown.before) app.querySelector('#buddy').classList.add('growing');
  if (p.autoRead) speak(`Warm-up done! ${firstTry} of ${total}. ${buddyLine}`);
  on('[data-action="topics"]', renderTopics);
  on('[data-action="replay"]', () => startReplay(missed));
}

// A short round with fresh questions of the same kinds the kid just missed.
export const REPLAY_MAX = 5;

export const REPLAY_BONUS = 5; // for fixing every one

export function startReplay(missed) {
  startQueue(missed.slice(0, REPLAY_MAX).map((m) => ({ topicId: m.topicId, level: m.level })), 'replay');
  say(`New numbers, same kind of problem. You've got this! 🔁`, 'happy');
}

// A short round from a list of { topicId, level }: Try these again, or the daily warm-up.
export function startQueue(queue, mode, extra = {}) {
  const p = currentProfile();
  session = {
    mode,
    topic: {
      id: mode, name: { warmup: 'Warm-up', test: 'Unit Test' }[mode] ?? 'Try again', emoji: { warmup: '☀️', test: '📝' }[mode] ?? '🔁',
      gen: (level) => {
        const m = session.queue[session.index];
        return { topicId: m.topicId, ...findTopic(m.topicId).gen(level) };
      },
    },
    queue, total: queue.length, level: queue[0].level, auto: false, index: 0, firstTry: 0, streak: 0, bestStreak: 0,
    points: 0, byTopic: {}, upRun: 0, downRun: 0, levelNote: '', levelCounts: { 1: 0, 2: 0, 3: 0 },
    pool: coreTopics(p.grade), focus: false,
    missed: [], seen: new Set(), whyDue: false, whyAsked: 0, whyRight: 0, tellAsked: 0, told: 0, tellOff: true, hinted: 0,
    ...extra,
  };
  loadQuestion();
}

export function finishReplay() {
  const p = currentProfile();
  const { firstTry, total, missed } = session;
  const allFixed = firstTry === total;
  const bonuses = allFixed ? [['🔁 Fixed them all', REPLAY_BONUS]] : [];
  const coins = session.points + bonuses.reduce((sum, [, n]) => sum + n, 0);
  p.coins += coins;
  const grown = growBuddy(p, coins);
  const stickers = checkStickers(p, { kind: 'replay', firstTry, total });
  save();

  sounds.win();
  confetti(allFixed ? 120 : 50);
  const buddyLine = grown.after > grown.before
    ? 'Look, I grew! Thank you for practicing with me! 🎉'
    : allFixed ? 'You fixed every one! That’s how brains grow! 💪' : 'Great try! Mistakes help us learn.';

  show(`
    <div class="screen">
      <div class="panel results">
        ${buddyRow(p, buddyLine)}
        <h2>🔁 You fixed ${firstTry} of ${total}!</h2>
        <p class="result-line">🪙 +${session.points} coins</p>
        ${bonuses.map(([label, n]) => `<p class="result-line bonus">${label}! 🪙 +${n}</p>`).join('')}
        ${stickerLine(stickers)}
        ${grewLine(p, grown)}
        ${growLine(p, coins)}
        ${missed.length ? `<div class="review"><h3>Still tricky</h3>
          ${missed.map((m) => `<div class="review-row"><span>${esc(m.question)}</span><strong>${esc(m.answer)}</strong></div>`).join('')}</div>` : ''}
        <div class="panel-actions">
          ${missed.length ? '<button class="btn" data-action="replay">🔁 Try those again</button>' : ''}
          <button class="btn secondary" data-action="topics">Pick another</button>
        </div>
      </div>
    </div>`);
  bindBubble();
  say(buddyLine, 'happy');
  if (grown.after > grown.before) app.querySelector('#buddy').classList.add('growing');
  if (p.autoRead) speak(`You fixed ${firstTry} of ${total}. ${buddyLine}`);
  on('[data-action="topics"]', renderTopics);
  on('[data-action="replay"]', () => startReplay(missed));
}
