import { TOPICS, GRADES } from './problems.js';
import { loadState, saveState, makeProfile } from './storage.js';
import { confetti, sounds } from './effects.js';

const QUESTIONS_PER_ROUND = 10;
const AVATARS = ['🦊', '🐼', '🐯', '🦄', '🐸', '🐙', '🦖', '🐧', '🐵', '🦁', '🐨', '🚀'];
const PRAISE = ['Awesome!', 'You got it!', 'Math wizard! 🧙', 'Nailed it!', 'Super smart!', 'Boom! 💥', 'Fantastic!'];
const ENCOURAGE = ['Almost! Try again.', 'Not quite. You can do it!', 'Hmm, check your work!'];

const app = document.getElementById('app');
let state = loadState();
let session = null; // the round being played
sounds.enabled = state.sound;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const save = () => saveState(state);
const currentProfile = () => state.profiles.find((p) => p.id === state.currentId);
const totalStars = (p) => Object.values(p.best).reduce((a, b) => a + b, 0);
const starRow = (n, max = 3) =>
  `<span class="stars">${Array.from({ length: max }, (_, i) => `<span class="${i < n ? '' : 'off'}">★</span>`).join('')}</span>`;

function show(html) {
  app.innerHTML = html;
  window.scrollTo(0, 0);
}

function on(selector, handler) {
  app.querySelectorAll(selector).forEach((el) => el.addEventListener('click', (e) => handler(el, e)));
}

function soundButton() {
  return `<button class="icon-btn" data-action="sound" aria-label="Toggle sound">${state.sound ? '🔊' : '🔇'}</button>`;
}

function bindSound() {
  on('[data-action="sound"]', (el) => {
    state.sound = sounds.enabled = !state.sound;
    el.textContent = state.sound ? '🔊' : '🔇';
    save();
  });
}

/* ---------------------------- Home ---------------------------- */

function renderHome() {
  session = null;
  const cards = state.profiles
    .map(
      (p) => `
      <div class="profile-card" data-id="${p.id}" role="button" tabindex="0">
        <button class="edit-btn" data-edit="${p.id}" aria-label="Edit ${esc(p.name)}">✏️</button>
        <div class="avatar">${p.avatar}</div>
        <div class="profile-name">${esc(p.name)}</div>
        <div class="grade-pill">Grade ${p.grade}</div>
        <div class="profile-stats">🪙 ${p.coins} &nbsp; ⭐ ${totalStars(p)}</div>
      </div>`,
    )
    .join('');

  show(`
    <div class="screen">
      <div class="topbar"><span class="spacer"></span>${soundButton()}</div>
      <h1 class="title">Math Quest</h1>
      <p class="subtitle">Who's playing today?</p>
      <div class="profiles">
        ${cards}
        <button class="profile-card add-card" data-action="add"><div class="avatar">＋</div><div>Add player</div></button>
      </div>
    </div>`);

  bindSound();
  on('[data-id]', (el, e) => {
    if (e.target.closest('[data-edit]')) return;
    state.currentId = el.dataset.id;
    save();
    sounds.tap();
    renderTopics();
  });
  on('[data-edit]', (el) => renderEdit(el.dataset.edit));
  on('[data-action="add"]', () => renderEdit(null));
}

/* ------------------------- Edit player ------------------------- */

function renderEdit(id) {
  const existing = state.profiles.find((p) => p.id === id);
  const draft = existing ? { ...existing } : { name: '', grade: GRADES[0], avatar: pick(AVATARS) };

  show(`
    <div class="screen">
      <div class="topbar"><button class="icon-btn" data-action="back" aria-label="Back">←</button></div>
      <div class="panel">
        <h2>${existing ? 'Edit player' : 'New player'}</h2>
        <label class="field-label" for="name">Name</label>
        <input id="name" class="text-input" maxlength="16" value="${esc(draft.name)}" placeholder="Type a name" autocomplete="off" />
        <div class="field-label">Pick an avatar</div>
        <div class="avatar-grid">
          ${AVATARS.map((a) => `<button class="avatar-opt ${a === draft.avatar ? 'selected' : ''}" data-avatar="${a}">${a}</button>`).join('')}
        </div>
        <div class="field-label">Grade</div>
        <div class="grade-row">
          ${GRADES.map((g) => `<button class="grade-opt ${g === draft.grade ? 'selected' : ''}" data-grade="${g}">Grade ${g}</button>`).join('')}
        </div>
        <div class="panel-actions">
          ${existing && state.profiles.length > 1 ? '<button class="btn danger" data-action="delete">Delete</button>' : ''}
          <button class="btn" data-action="save">Save</button>
        </div>
      </div>
    </div>`);

  on('[data-avatar]', (el) => {
    draft.avatar = el.dataset.avatar;
    app.querySelectorAll('[data-avatar]').forEach((b) => b.classList.toggle('selected', b === el));
  });
  on('[data-grade]', (el) => {
    draft.grade = Number(el.dataset.grade);
    app.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('selected', b === el));
  });
  on('[data-action="back"]', renderHome);
  on('[data-action="delete"]', () => {
    if (!confirm(`Delete ${existing.name}? Their stars and coins will be gone.`)) return;
    state.profiles = state.profiles.filter((p) => p.id !== id);
    save();
    renderHome();
  });
  on('[data-action="save"]', () => {
    const name = app.querySelector('#name').value.trim() || 'Player';
    if (existing) Object.assign(existing, { name, grade: draft.grade, avatar: draft.avatar });
    else state.profiles.push(makeProfile(name, draft.grade, draft.avatar));
    save();
    renderHome();
  });
}

/* ---------------------------- Topics ---------------------------- */

function renderTopics() {
  const p = currentProfile();
  if (!p) return renderHome();
  const cards = TOPICS[p.grade]
    .map(
      (t) => `
      <button class="topic-card" data-topic="${t.id}">
        <div class="topic-emoji">${t.emoji}</div>
        <div class="topic-name">${t.name}</div>
        <div class="topic-desc">${t.desc}</div>
        ${starRow(p.best[t.id] || 0)}
      </button>`,
    )
    .join('');

  show(`
    <div class="screen">
      <div class="topbar">
        <button class="icon-btn" data-action="back" aria-label="Back">←</button>
        <div class="who">${p.avatar} <strong>${esc(p.name)}</strong> <span class="profile-stats">🪙 ${p.coins} ⭐ ${totalStars(p)}</span></div>
        ${soundButton()}
      </div>
      <h2 class="screen-title">Pick a quest!</h2>
      <div class="topics">${cards}</div>
    </div>`);

  bindSound();
  on('[data-action="back"]', renderHome);
  on('[data-topic]', (el) => startRound(el.dataset.topic));
}

/* ---------------------------- Playing ---------------------------- */

function startRound(topicId) {
  const topic = TOPICS[currentProfile().grade].find((t) => t.id === topicId);
  session = { topic, index: 0, firstTry: 0, streak: 0, bestStreak: 0, missed: [], seen: new Set() };
  loadQuestion();
}

function loadQuestion() {
  // Avoid repeating the same question within a round.
  let q;
  let tries = 0;
  do q = session.topic.gen();
  while (session.seen.has(q.summary ?? q.prompt) && tries++ < 25);
  session.seen.add(q.summary ?? q.prompt);
  Object.assign(session, { current: q, attempts: 0, locked: false, input: '' });
  renderQuestion();
}

function nextQuestion() {
  session.index++;
  if (session.index >= QUESTIONS_PER_ROUND) finishRound();
  else loadQuestion();
}

function renderQuestion() {
  const q = session.current;
  const pct = (session.index / QUESTIONS_PER_ROUND) * 100;
  const input = q.choices
    ? `<div class="choices">${q.choices.map((c) => `<button class="choice" data-choice="${esc(c)}">${esc(c)}</button>`).join('')}</div>`
    : `<div class="numpad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-key="${n}">${n}</button>`).join('')}
        <button data-key="back" aria-label="Delete">⌫</button>
        <button data-key="0">0</button>
        <button data-key="enter" class="go" aria-label="Check answer">✓</button>
      </div>`;

  show(`
    <div class="screen play">
      <div class="topbar">
        <button class="icon-btn" data-action="quit" aria-label="Quit">✕</button>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <div class="streak" title="Streak">${session.streak >= 2 ? '🔥' : ''}${session.streak}</div>
      </div>
      <div class="question" id="question">
        <div class="q-count">${session.topic.emoji} Question ${session.index + 1} of ${QUESTIONS_PER_ROUND}</div>
        <div class="prompt ${q.word ? 'word' : ''}">${esc(q.prompt)}</div>
        ${q.visual ? `<div class="visual">${q.visual}</div>` : ''}
        ${q.choices ? '' : '<div class="answer-display" id="answer">&nbsp;</div>'}
        <div class="feedback" id="feedback"></div>
        <div class="hint hidden" id="hint">💡 ${esc(q.hint)}</div>
      </div>
      ${input}
      <div class="play-actions">
        <button class="btn secondary" data-action="hint">💡 Hint</button>
        <button class="btn hidden" data-action="next" id="next">Next ➜</button>
      </div>
    </div>`);

  on('[data-key]', (el) => pressKey(el.dataset.key));
  on('[data-choice]', (el) => submit(el.dataset.choice, el));
  on('[data-action="hint"]', showHint);
  on('[data-action="next"]', nextQuestion);
  on('[data-action="quit"]', () => {
    if (confirm('Quit this quest? Your progress in this round will be lost.')) renderTopics();
  });
}

function pressKey(key) {
  if (session.locked) return;
  if (key === 'enter') return submit(session.input);
  if (key === 'back') session.input = session.input.slice(0, -1);
  else if (session.input.length < 7) session.input = (session.input + key).replace(/^0+(?=\d)/, '');
  app.querySelector('#answer').textContent = session.input ? Number(session.input).toLocaleString('en-US') : ' ';
}

function showHint() {
  app.querySelector('#hint').classList.remove('hidden');
}

function setFeedback(kind, text) {
  const el = app.querySelector('#feedback');
  el.className = `feedback ${kind}`;
  el.textContent = text;
}

function submit(value, choiceEl) {
  const q = session.current;
  if (session.locked || value === '') return;
  const correct = q.choices ? value === q.answer : Number(value) === Number(q.answer.replace(/,/g, ''));

  if (correct) {
    session.locked = true;
    if (session.attempts === 0) {
      session.firstTry++;
      session.streak++;
      session.bestStreak = Math.max(session.bestStreak, session.streak);
    }
    choiceEl?.classList.add('right');
    setFeedback('good', pick(PRAISE));
    sounds.correct();
    confetti(session.streak >= 3 ? 60 : 30);
    const s = session;
    setTimeout(() => session === s && nextQuestion(), 1300);
    return;
  }

  session.attempts++;
  session.streak = 0;
  sounds.wrong();
  const card = app.querySelector('#question');
  card.classList.remove('shake');
  void card.offsetWidth; // restart the animation
  card.classList.add('shake');

  if (session.attempts < 2) {
    setFeedback('try', pick(ENCOURAGE));
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
  session.missed.push({ question: q.summary ?? q.prompt, answer: shown });
  setFeedback('reveal', `The answer is ${shown}`);
  if (choiceEl) choiceEl.classList.add('wrong');
  app.querySelectorAll('[data-choice]').forEach((b) => b.dataset.choice === q.answer && b.classList.add('right'));
  app.querySelector('#next').classList.remove('hidden');
}

/* ---------------------------- Results ---------------------------- */

function finishRound() {
  const p = currentProfile();
  const { topic, firstTry, bestStreak, missed } = session;
  const stars = firstTry >= 9 ? 3 : firstTry >= 7 ? 2 : firstTry >= 5 ? 1 : 0;
  const newBest = stars > (p.best[topic.id] || 0);
  if (newBest) p.best[topic.id] = stars;
  p.coins += firstTry;
  save();

  sounds.win();
  if (stars > 0) confetti(120);
  const message = ['Keep practicing, you\'re getting stronger!', 'Good job!', 'Great work!', 'PERFECT QUEST! 🏆'][stars];

  show(`
    <div class="screen">
      <div class="panel results">
        <div class="result-emoji">${topic.emoji}</div>
        <h2>${message}</h2>
        <div class="big-stars">${starRow(stars)}</div>
        ${newBest ? '<div class="badge">New best!</div>' : ''}
        <p class="result-line">You got <strong>${firstTry} of ${QUESTIONS_PER_ROUND}</strong> on the first try.</p>
        <p class="result-line">🪙 +${firstTry} coins &nbsp; 🔥 Best streak: ${bestStreak}</p>
        ${
          missed.length
            ? `<div class="review"><h3>Let's look at these again</h3>
                ${missed.map((m) => `<div class="review-row"><span>${esc(m.question)}</span><strong>${esc(m.answer)}</strong></div>`).join('')}
              </div>`
            : ''
        }
        <div class="panel-actions">
          <button class="btn secondary" data-action="topics">Pick another</button>
          <button class="btn" data-action="again">Play again</button>
        </div>
      </div>
    </div>`);

  on('[data-action="topics"]', renderTopics);
  on('[data-action="again"]', () => startRound(topic.id));
}

/* ---------------------------- Keyboard ---------------------------- */

document.addEventListener('keydown', (e) => {
  if (!session?.current || !app.querySelector('.play')) return;
  // Stop Enter from also "clicking" whichever button has focus.
  if (e.key === 'Enter') e.preventDefault();
  if (session.locked) {
    if (e.key === 'Enter' && !app.querySelector('#next').classList.contains('hidden')) nextQuestion();
    return;
  }
  if (session.current.choices) return;
  if (/^[0-9]$/.test(e.key)) pressKey(e.key);
  else if (e.key === 'Backspace') pressKey('back');
  else if (e.key === 'Enter') pressKey('enter');
});

renderHome();
