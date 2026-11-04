import { TOPICS, GRADES, LEVELS } from './problems.js';
import { BUDDIES, HATS, THEMES, CATALOG } from './shop.js';
import { loadState, saveState, makeProfile } from './storage.js';
import { confetti, sounds } from './effects.js';
import { speak, stopSpeaking, choiceWords, canSpeak } from './speech.js';

const QUESTIONS_PER_ROUND = 10;
const AVATARS = ['🦊', '🐼', '🐯', '🦄', '🐸', '🐙', '🦖', '🐧', '🐵', '🦁', '🐨', '🚀'];
const PRAISE = ['Awesome!', 'You got it!', 'Nailed it!', 'Super smart!', 'Boom! 💥', 'Fantastic!'];
const ENCOURAGE = ['Almost! Try again.', 'Not quite. You can do it!', 'Hmm, check your work!'];
const GREETINGS = ["Let's do this!", 'You can do it!', 'Ready for a quest?', 'I believe in you!'];
// Where the background decorations sit, as [left %, top %].
const DECOR_SPOTS = [[4, 8], [88, 5], [14, 46], [93, 38], [3, 82], [82, 86], [50, 94], [36, 12], [66, 62], [24, 70]];

const app = document.getElementById('app');
const decor = document.getElementById('decor');
let state = loadState();
let session = null; // the round being played
sounds.enabled = state.sound;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const save = () => saveState(state);
const currentProfile = () => state.profiles.find((p) => p.id === state.currentId);
const totalStars = (p) => Object.values(p.best).reduce((a, b) => a + b, 0);
const buddyOf = (p) => BUDDIES.find((b) => b.id === p.buddy) ?? BUDDIES[0];
const levelOf = (p) => LEVELS.find((l) => l.id === p.level) ?? LEVELS[1];
const owns = (p, tab, item) => item.price === 0 || p.owned[tab].includes(item.id);
const starRow = (n, max = 3) =>
  `<span class="stars">${Array.from({ length: max }, (_, i) => `<span class="${i < n ? '' : 'off'}">★</span>`).join('')}</span>`;
const buddyName = (p) => buddyOf(p).name.split(' ')[0];
const sayButton = (id, label = 'Read aloud') => (canSpeak ? `<button class="say-btn" data-say="${id}" aria-label="${label}">🔊</button>` : '');
const shuffle = (arr) => [...arr].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const coreTopics = (grade) => TOPICS[grade].filter((t) => !t.extra);
const findTopic = (id) => Object.values(TOPICS).flat().find((t) => t.id === id);
const FOCUS_BONUS = 5;
const GOAL_BONUS = 20;

const startOfDay = (t) => new Date(t).setHours(0, 0, 0, 0);
// Weeks start on Sunday.
function weekStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.setDate(d.getDate() - d.getDay());
}
const questsThisWeek = (p) => p.history.filter((h) => h.t >= weekStart()).length;

function show(html) {
  stopSpeaking();
  app.innerHTML = html;
  window.scrollTo(0, 0);
}

// The player's theme and reading settings (or the defaults on the home screen).
function applyLook(p) {
  applyTheme(p?.theme ?? 'sunny');
  document.body.classList.toggle('easy-read', !!p?.easyRead);
}

function on(selector, handler) {
  app.querySelectorAll(selector).forEach((el) => el.addEventListener('click', (e) => handler(el, e)));
}

function applyTheme(themeId) {
  if (document.body.dataset.theme === themeId) return;
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  document.body.dataset.theme = theme.id;
  decor.innerHTML = DECOR_SPOTS.map(
    ([left, top], i) => `<span style="left:${left}%;top:${top}%;animation-delay:${-i * 0.7}s">${theme.decor[i % theme.decor.length]}</span>`,
  ).join('');
}

function buddyHtml(p, size = '') {
  const hat = HATS.find((h) => h.id === p.hat);
  return `<div class="buddy ${size}" id="buddy">
    <span class="buddy-hat">${hat && hat.id !== 'none' ? hat.emoji : ''}</span>
    <span class="buddy-body">${buddyOf(p).emoji}</span>
  </div>`;
}

function buddyRow(p, text) {
  return `<div class="buddy-row">${buddyHtml(p)}<button class="bubble" id="bubble" title="Tap to hear">${esc(text)}</button></div>`;
}

// Tapping the buddy's speech bubble reads it aloud.
function bindBubble() {
  on('#bubble', (el) => speak(el.textContent));
}

// Make the buddy say something, with a little hop (happy) or wobble (sad).
function say(text, mood) {
  const bubble = app.querySelector('#bubble');
  const buddy = app.querySelector('#buddy');
  if (bubble) bubble.textContent = text;
  if (buddy && mood) {
    buddy.classList.remove('happy', 'sad');
    void buddy.offsetWidth; // restart the animation
    buddy.classList.add(mood);
  }
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
  applyLook(null);
  const cards = state.profiles
    .map(
      (p) => `
      <div class="profile-card" data-id="${p.id}" role="button" tabindex="0">
        <button class="edit-btn" data-edit="${p.id}" aria-label="Edit ${esc(p.name)}">✏️</button>
        <div class="avatar">${p.avatar}</div>
        <div class="profile-name">${esc(p.name)}</div>
        <div class="grade-pill">Grade ${p.grade}</div>
        <div class="profile-stats">🪙 ${p.coins} &nbsp; ⭐ ${totalStars(p)} &nbsp; ${buddyOf(p).emoji}</div>
      </div>`,
    )
    .join('');

  show(`
    <div class="screen">
      <div class="topbar"><span class="spacer"></span><button class="btn secondary small" data-action="parents">👪 Grown-ups</button>${soundButton()}</div>
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
  on('[data-action="parents"]', renderParentGate);
}

/* ------------------------- Edit player ------------------------- */

function renderEdit(id) {
  const existing = state.profiles.find((p) => p.id === id);
  const draft = existing ? { ...existing } : { name: '', grade: GRADES[0], avatar: pick(AVATARS), autoRead: false, easyRead: false };

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
        <div class="field-label">Reading help</div>
        <div class="toggle-list">
          ${canSpeak ? `<button class="toggle-opt ${draft.autoRead ? 'selected' : ''}" data-toggle="autoRead"><span class="check"></span>🔊 Read questions out loud</button>` : ''}
          <button class="toggle-opt ${draft.easyRead ? 'selected' : ''}" data-toggle="easyRead"><span class="check"></span>🔤 Easy-reading text (bigger, spaced out, calmer)</button>
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
  on('[data-toggle]', (el) => {
    const key = el.dataset.toggle;
    draft[key] = !draft[key];
    el.classList.toggle('selected', draft[key]);
  });
  on('[data-action="back"]', renderHome);
  on('[data-action="delete"]', () => {
    if (!confirm(`Delete ${existing.name}? Their stars, coins and shop items will be gone.`)) return;
    state.profiles = state.profiles.filter((p) => p.id !== id);
    save();
    renderHome();
  });
  on('[data-action="save"]', () => {
    const name = app.querySelector('#name').value.trim() || 'Player';
    const reading = { autoRead: !!draft.autoRead, easyRead: !!draft.easyRead };
    if (existing) Object.assign(existing, { name, grade: draft.grade, avatar: draft.avatar, ...reading });
    else state.profiles.push({ ...makeProfile(name, draft.grade, draft.avatar), ...reading });
    save();
    renderHome();
  });
}

/* ---------------------------- Topics ---------------------------- */

function playerBar(p, backAction = 'back') {
  return `
    <div class="topbar">
      <button class="icon-btn" data-action="${backAction}" aria-label="Back">←</button>
      <div class="who">${p.avatar} <strong>${esc(p.name)}</strong></div>
      <div class="coin-pill">🪙 ${p.coins}</div>
      ${soundButton()}
    </div>`;
}

function renderTopics() {
  const p = currentProfile();
  if (!p) return renderHome();
  applyLook(p);
  // Focus areas (picked by a grown-up) come first.
  const focused = (t) => !t.extra && p.focus.includes(t.id);
  const ordered = [...TOPICS[p.grade].filter(focused), ...TOPICS[p.grade].filter((t) => !focused(t))];
  const cards = ordered
    .map(
      (t) => `
      <button class="topic-card ${focused(t) ? 'focus' : ''}" data-topic="${t.id}">
        ${focused(t) ? `<span class="focus-tag">⭐ Focus +${FOCUS_BONUS}🪙</span>` : ''}
        <div class="topic-emoji">${t.emoji}</div>
        <div class="topic-name">${t.name}</div>
        <div class="topic-desc">${t.desc}</div>
        ${starRow(p.best[`${t.id}:${p.level}`] || 0)}
      </button>`,
    )
    .join('');
  const levels = LEVELS.map(
    (l) => `<button class="level-opt ${l.id === p.level ? 'selected' : ''}" data-level="${l.id}">
      ${l.emoji} ${l.name}<small>🪙 ×${l.id} coins</small></button>`,
  ).join('');
  const done = questsThisWeek(p);
  const goal = p.weeklyGoal
    ? `<div class="goal"><span>🎯 This week: <strong>${Math.min(done, p.weeklyGoal)} of ${p.weeklyGoal}</strong> quests${done >= p.weeklyGoal ? ' ✅' : ''}</span>
        <div class="progress"><div style="width:${Math.min(100, (done / p.weeklyGoal) * 100)}%"></div></div></div>`
    : '';
  const greeting = p.message ? `Hi ${p.name}! A note from your grown-up: “${p.message}”` : `Hi ${p.name}! Pick a quest!`;

  show(`
    <div class="screen">
      ${playerBar(p)}
      <div class="topics-head">
        ${buddyRow(p, greeting)}
        <button class="btn shop-btn" data-action="shop">🛒 Shop</button>
      </div>
      <div class="levels" role="group" aria-label="Difficulty">${levels}</div>
      ${goal}
      <div class="topics">${cards}</div>
    </div>`);

  bindSound();
  bindBubble();
  on('[data-action="back"]', renderHome);
  on('[data-action="shop"]', () => renderShop());
  on('[data-level]', (el) => {
    p.level = Number(el.dataset.level);
    save();
    sounds.tap();
    renderTopics();
  });
  on('[data-topic]', (el) => startRound(el.dataset.topic));
}

/* ---------------------------- Shop ---------------------------- */

function renderShop(tab = 'buddies', message = 'Welcome to the shop! What should we get?') {
  const p = currentProfile();
  applyLook(p);
  const { items, slot } = CATALOG[tab];

  const cards = items
    .map((item) => {
      const owned = owns(p, tab, item);
      const using = p[slot] === item.id;
      let button;
      if (using) button = '<button class="buy-btn using" disabled>✓ Using</button>';
      else if (owned) button = `<button class="buy-btn owned" data-use="${item.id}">Use</button>`;
      else if (p.coins >= item.price) button = `<button class="buy-btn" data-buy="${item.id}">🪙 ${item.price}</button>`;
      else button = `<button class="buy-btn locked" disabled>🔒 🪙 ${item.price}</button>`;
      const art = tab === 'themes'
        ? `<div class="theme-swatch" style="background:${item.swatch}">${item.emoji}</div>`
        : tab === 'hats'
          ? `<div class="shop-emoji hat-preview"><span>${item.id === 'none' ? '' : item.emoji}</span><span>${buddyOf(p).emoji}</span></div>`
          : `<div class="shop-emoji">${item.emoji}</div>`;
      return `<div class="shop-item ${using ? 'equipped' : ''}">${art}<div class="shop-name">${esc(item.name)}</div>${button}</div>`;
    })
    .join('');

  show(`
    <div class="screen">
      ${playerBar(p)}
      <div class="topics-head">${buddyRow(p, message)}</div>
      <div class="tabs" role="tablist">
        ${Object.entries(CATALOG).map(([key, c]) => `<button class="tab ${key === tab ? 'selected' : ''}" data-tab="${key}" role="tab">${c.label}</button>`).join('')}
      </div>
      <div class="shop-grid">${cards}</div>
      <p class="shop-tip">Earn coins by answering on the first try. Hard quests pay 🪙 ×3!</p>
    </div>`);

  bindSound();
  bindBubble();
  on('[data-action="back"]', renderTopics);
  on('[data-tab]', (el) => renderShop(el.dataset.tab));
  on('[data-use]', (el) => {
    p[slot] = el.dataset.use;
    save();
    sounds.tap();
    renderShop(tab, pick(['Looking good!', 'Great choice!', 'Ooh, nice!']));
  });
  on('[data-buy]', (el) => {
    const item = items.find((i) => i.id === el.dataset.buy);
    // Tap once to ask, tap again to buy, so little fingers don't spend by accident.
    if (!el.classList.contains('confirm')) {
      el.classList.add('confirm');
      el.textContent = 'Tap to buy!';
      setTimeout(() => {
        if (!el.isConnected) return;
        el.classList.remove('confirm');
        el.textContent = `🪙 ${item.price}`;
      }, 3000);
      return;
    }
    p.coins -= item.price;
    p.owned[tab].push(item.id);
    p[slot] = item.id;
    save();
    sounds.win();
    confetti(80);
    renderShop(tab, `Yay! You got ${item.name}!`);
    say(`Yay! You got ${item.name}!`, 'happy');
  });
}

/* --------------------------- Grown-ups --------------------------- */

function renderParentGate() {
  if (!state.pin) return renderParents();
  show(`
    <div class="screen">
      <div class="topbar"><button class="icon-btn" data-action="back" aria-label="Back">←</button></div>
      <div class="panel">
        <h2>👪 Grown-ups only</h2>
        <label class="field-label" for="pin">Enter your PIN</label>
        <input id="pin" class="text-input pin-input" type="password" inputmode="numeric" maxlength="4" autocomplete="off" />
        <div class="feedback" id="feedback"></div>
        <div class="panel-actions"><button class="btn" data-action="open">Open</button></div>
      </div>
    </div>`);
  const input = app.querySelector('#pin');
  const tryPin = () => {
    if (input.value === state.pin) return renderParents();
    setFeedback('try', "That PIN doesn't match.");
    input.value = '';
  };
  input.focus();
  input.addEventListener('keydown', (e) => e.key === 'Enter' && tryPin());
  on('[data-action="back"]', renderHome);
  on('[data-action="open"]', tryPin);
}

function ago(t) {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(t)) / 86400000);
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

const GOALS = [0, 3, 5, 7, 10];

function renderParents(childId = state.currentId) {
  applyLook(null);
  const p = state.profiles.find((k) => k.id === childId) ?? state.profiles[0];
  const first = p.name;

  const topicRows = coreTopics(p.grade)
    .map((t) => {
      const s = p.stats[t.id];
      const pct = s?.asked ? Math.round((100 * s.firstTry) / s.asked) : null;
      const flags = [];
      if (s?.asked >= 8 && pct < 70) flags.push('<span class="flag">🔎 Tricky</span>');
      if (s?.whyAsked >= 3 && s.whyRight / s.whyAsked < 0.6) flags.push('<span class="flag">🧠 Explaining is tricky</span>');
      const detail = s?.asked
        ? `${pct}% right the first time (${s.firstTry} of ${s.asked})${s.whyAsked ? ` · 🧠 ${s.whyRight} of ${s.whyAsked} explained` : ''}${s.tellAsked ? ` · 🗣️ ${s.told} of ${s.tellAsked} out loud` : ''} · ${ago(s.last)}`
        : 'Not played yet';
      return `
        <button class="toggle-opt topic-opt ${p.focus.includes(t.id) ? 'selected' : ''}" data-focus="${t.id}">
          <span class="check"></span><span class="topic-opt-emoji">${t.emoji}</span>
          <span class="topic-opt-text"><strong>${t.name}</strong>${flags.join('')}<small>${detail}</small></span>
        </button>`;
    })
    .join('');

  const recent = p.history.slice(0, 10).map((h) => {
    const t = findTopic(h.topic);
    const lvl = LEVELS.find((l) => l.id === h.level);
    const date = new Date(h.t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return `<div class="review-row"><span>${date} · ${t?.emoji ?? ''} ${esc(t?.name ?? h.topic)} · ${lvl?.emoji ?? ''}</span>
      <strong>${h.firstTry}/${QUESTIONS_PER_ROUND}${h.whyAsked ? ` · 🧠 ${h.whyRight}/${h.whyAsked}` : ''}${h.tellAsked ? ` · 🗣️ ${h.told}/${h.tellAsked}` : ''}</strong></div>`;
  }).join('');

  show(`
    <div class="screen parents">
      <div class="topbar">
        <button class="icon-btn" data-action="back" aria-label="Back">←</button>
        <div class="who"><strong>👪 Grown-ups</strong></div>
      </div>
      <div class="tabs" role="tablist">
        ${state.profiles.map((k) => `<button class="tab ${k.id === p.id ? 'selected' : ''}" data-child="${k.id}" role="tab">${k.avatar} ${esc(k.name)}</button>`).join('')}
      </div>

      <div class="panel">
        <h2>⭐ Focus areas</h2>
        <p class="panel-note">Tick what ${esc(first)} is working on. Focus quests show first on ${esc(first)}'s screen, pay ${FOCUS_BONUS} bonus coins, and come up more often in Mixed Challenge and Fix the Mistake.
          🔎 marks topics where ${esc(first)} gets less than 70% right the first time.</p>
        <div class="toggle-list">${topicRows}</div>
      </div>

      <div class="panel">
        <h2>🧠 Explaining</h2>
        <div class="toggle-list">
          <button class="toggle-opt ${p.whyEvery ? 'selected' : ''}" data-toggle="whyEvery"><span class="check"></span>
            <span>Ask “How do you know?” after <strong>every</strong> right answer <small class="block">Normally it's asked 3 times a round.</small></span></button>
          <button class="toggle-opt ${p.tellGrownUp ? 'selected' : ''}" data-toggle="tellGrownUp"><span class="check"></span>
            <span>🗣️ “Tell your grown-up” prompts <small class="block">Up to twice a round, ${esc(first)} explains out loud and you tap how it went. A great explanation earns coins. There's a skip button for when no one is around.</small></span></button>
        </div>
        <div class="tips">
          <strong>When ${esc(first)} explains to you:</strong>
          <ul>
            <li>Listen to the whole thing before helping.</li>
            <li>Ask “How do you know?” or “Can you show me on the picture?”</li>
            <li>If ${esc(first)} gets stuck, read a sentence starter together.</li>
            <li>Tap <strong>Great explaining</strong> for clear steps, even short ones. Effort counts!</li>
          </ul>
        </div>
      </div>

      <div class="panel">
        <h2>🎯 Weekly goal</h2>
        <p class="panel-note">Quests to finish each week (Sunday to Saturday). Reaching it pays ${GOAL_BONUS} bonus coins. This week: <strong>${questsThisWeek(p)}</strong> so far.</p>
        <div class="grade-row">
          ${GOALS.map((g) => `<button class="grade-opt ${g === p.weeklyGoal ? 'selected' : ''}" data-goal="${g}">${g ? `${g} quests` : 'Off'}</button>`).join('')}
        </div>
      </div>

      <div class="panel">
        <h2>📝 Note for ${esc(first)}</h2>
        <p class="panel-note">${esc(buddyName(p))} shows this on the quest screen. Try a tip from class, like “Line up the places!”</p>
        <textarea id="note" class="text-input note-input" maxlength="120" rows="2" placeholder="Write a short note">${esc(p.message)}</textarea>
        <div class="saved-note hidden" id="noteSaved">✓ Saved</div>
      </div>

      <div class="panel">
        <h2>📅 Recent quests</h2>
        ${recent ? `<div class="review">${recent}</div>` : `<p class="panel-note">No quests yet.</p>`}
      </div>

      <div class="panel">
        <h2>🔒 Grown-up PIN</h2>
        <p class="panel-note">${state.pin ? 'A PIN is set, so kids need it to open this page.' : 'Add a 4-digit PIN so kids can’t open this page.'}</p>
        <div class="pin-row">
          <input id="newPin" class="text-input pin-input" type="password" inputmode="numeric" maxlength="4" placeholder="4 digits" autocomplete="off" />
          <button class="btn" data-action="setPin">${state.pin ? 'Change PIN' : 'Set PIN'}</button>
          ${state.pin ? '<button class="btn danger" data-action="clearPin">Remove</button>' : ''}
        </div>
        <div class="feedback" id="feedback"></div>
      </div>
    </div>`);

  on('[data-action="back"]', renderHome);
  on('[data-child]', (el) => renderParents(el.dataset.child));
  on('[data-focus]', (el) => {
    const id = el.dataset.focus;
    p.focus = p.focus.includes(id) ? p.focus.filter((x) => x !== id) : [...p.focus, id];
    el.classList.toggle('selected', p.focus.includes(id));
    save();
  });
  on('[data-toggle]', (el) => {
    p[el.dataset.toggle] = !p[el.dataset.toggle];
    el.classList.toggle('selected', p[el.dataset.toggle]);
    save();
  });
  on('[data-goal]', (el) => {
    p.weeklyGoal = Number(el.dataset.goal);
    app.querySelectorAll('[data-goal]').forEach((b) => b.classList.toggle('selected', b === el));
    save();
  });
  const note = app.querySelector('#note');
  note.addEventListener('input', () => {
    p.message = note.value.trim();
    save();
    app.querySelector('#noteSaved').classList.remove('hidden');
  });
  on('[data-action="setPin"]', () => {
    const value = app.querySelector('#newPin').value;
    if (!/^\d{4}$/.test(value)) return setFeedback('try', 'Use exactly 4 digits.');
    state.pin = value;
    save();
    renderParents(p.id);
    setFeedback('good', '✓ PIN saved');
  });
  on('[data-action="clearPin"]', () => {
    state.pin = '';
    save();
    renderParents(p.id);
  });
}

/* ---------------------------- Playing ---------------------------- */

// "How do you know?" comes up on these questions (or the next one answered right on the first try).
const WHY_AT = [2, 5, 8];

function startRound(topicId) {
  const p = currentProfile();
  const topic = TOPICS[p.grade].find((t) => t.id === topicId);
  // Mixed Challenge and Fix the Mistake pick focus areas more often.
  const core = coreTopics(p.grade);
  const focus = core.filter((t) => p.focus.includes(t.id));
  session = {
    topic, level: p.level, index: 0, firstTry: 0, streak: 0, bestStreak: 0,
    pool: [...core, ...focus, ...focus, ...focus], focus: p.focus.includes(topic.id),
    missed: [], seen: new Set(), whyDue: false, whyAsked: 0, whyRight: 0, tellAsked: 0, told: 0, tellOff: false,
  };
  loadQuestion();
}

function loadQuestion() {
  // Avoid repeating the same question within a round.
  let q;
  let tries = 0;
  do q = session.topic.gen(session.level, session.pool);
  while (session.seen.has(q.summary ?? q.prompt) && tries++ < 25);
  session.seen.add(q.summary ?? q.prompt);
  q.topicId ??= session.topic.id;
  const name = buddyName(currentProfile());
  for (const key of ['prompt', 'hint', 'summary']) if (q[key]) q[key] = q[key].replaceAll('{buddy}', name);
  if (WHY_AT.includes(session.index)) session.whyDue = true;
  Object.assign(session, { current: q, attempts: 0, locked: false, input: '' });
  renderQuestion();
}

function nextQuestion() {
  session.index++;
  if (session.index >= QUESTIONS_PER_ROUND) finishRound();
  else loadQuestion();
}

// Everything on the question card, as words to read aloud.
function questionSpeech(q) {
  const name = buddyName(currentProfile());
  const parts = [q.prompt];
  const summary = q.spoken ?? (q.claim !== undefined ? q.baseSummary : q.summary);
  if (q.visual && summary) parts.push(summary);
  if (q.claim !== undefined) parts.push(`${name} says ${choiceWords(q.claim)}. Is ${name} right?`);
  else if (q.choices) parts.push(`Is it ${q.choices.map(choiceWords).join(', or ')}?`);
  return parts.join('. ').replace(/\?\./g, '?');
}

function renderQuestion() {
  const p = currentProfile();
  const q = session.current;
  const pct = (session.index / QUESTIONS_PER_ROUND) * 100;
  const input = q.choices
    ? `<div class="choices ${q.claim !== undefined ? 'two' : ''} ${q.choices.some((c) => c.length > 6) ? 'long' : ''}">${q.choices.map((c) => `<button class="choice" data-choice="${esc(c)}">${esc(c)}</button>`).join('')}</div>`
    : `<div class="numpad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-key="${n}">${n}</button>`).join('')}
        <button data-key="back" aria-label="Delete">⌫</button>
        <button data-key="0">0</button>
        <button data-key="enter" class="go" aria-label="Check answer">✓</button>
      </div>`;
  const greeting = q.claim !== undefined
    ? 'I tried this one. Did I get it right?'
    : session.streak >= 3 ? `${session.streak} in a row! 🔥` : pick(GREETINGS);
  const claim = q.claim !== undefined
    ? `<div class="claim">${buddyOf(p).emoji} <span>${esc(buddyName(p))} says: <strong>${esc(q.claim)}</strong></span></div>
       <div class="claim-ask">Is ${esc(buddyName(p))} right?</div>`
    : '';

  show(`
    <div class="screen play">
      <div class="topbar">
        <button class="icon-btn" data-action="quit" aria-label="Quit">✕</button>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <div class="streak" title="Streak">${session.streak >= 2 ? '🔥' : ''}${session.streak}</div>
      </div>
      ${buddyRow(p, greeting)}
      <div class="question" id="question">
        ${sayButton('question', 'Read the question aloud')}
        <div class="q-count">${session.topic.emoji} Question ${session.index + 1} of ${QUESTIONS_PER_ROUND} · ${levelOf(p).emoji} ${levelOf(p).name}</div>
        <div class="prompt ${q.word ? 'word' : ''}">${esc(q.prompt)}</div>
        ${q.visual ? `<div class="visual">${q.visual}</div>` : ''}
        ${claim}
        ${q.choices ? '' : '<div class="answer-display" id="answer">&nbsp;</div>'}
        <div class="feedback" id="feedback"></div>
        <div class="hint hidden" id="hint">💡 <span>${esc(q.hint)}</span> ${sayButton('hint', 'Read the hint aloud')}</div>
      </div>
      <div id="input-area">${input}</div>
      <div class="play-actions">
        <button class="btn secondary" data-action="hint" id="hintBtn">💡 Hint</button>
        <button class="btn hidden" data-action="next" id="next">Next ➜</button>
      </div>
    </div>`);

  bindBubble();
  on('[data-say="question"]', () => speak(questionSpeech(q)));
  on('[data-say="hint"]', () => speak(q.hint));
  on('[data-key]', (el) => pressKey(el.dataset.key));
  on('[data-choice]', (el) => submit(el.dataset.choice, el));
  on('[data-action="hint"]', showHint);
  on('[data-action="next"]', nextQuestion);
  on('[data-action="quit"]', () => {
    if (confirm('Quit this quest? Your progress in this round will be lost.')) renderTopics();
  });
  if (p.autoRead) speak(questionSpeech(q));
}

function pressKey(key) {
  if (session.locked) return;
  if (key === 'enter') return submit(session.input);
  if (key === 'back') session.input = session.input.slice(0, -1);
  else if (session.input.length < 8) session.input = (session.input + key).replace(/^0+(?=\d)/, '');
  app.querySelector('#answer').textContent = session.input ? Number(session.input).toLocaleString('en-US') : ' ';
}

function showHint() {
  const hint = app.querySelector('#hint');
  if (!hint.classList.contains('hidden')) return;
  hint.classList.remove('hidden');
  if (currentProfile().autoRead) speak(session.current.hint);
}

function setFeedback(kind, text) {
  const el = app.querySelector('#feedback');
  el.className = `feedback ${kind}`;
  el.textContent = text;
}

// Progress for the Grown-ups page, counted under the question's own topic
// (so Mixed Challenge questions count toward Fractions, Rounding, ...).
function topicStats(q) {
  const p = currentProfile();
  p.stats[q.topicId] ??= { asked: 0, firstTry: 0, whyAsked: 0, whyRight: 0, last: 0 };
  p.stats[q.topicId].tellAsked ??= 0;
  p.stats[q.topicId].told ??= 0;
  return p.stats[q.topicId];
}

function recordAnswer(q, firstTry) {
  const s = topicStats(q);
  s.asked++;
  if (firstTry) s.firstTry++;
  s.last = Date.now();
  save();
}

function recordWhy(q, right) {
  const s = topicStats(q);
  s.whyAsked++;
  if (right) s.whyRight++;
  save();
}

function recordTell(q, great) {
  const s = topicStats(q);
  s.tellAsked++;
  if (great) s.told++;
  save();
}

function submit(value, choiceEl) {
  const q = session.current;
  const buddy = buddyOf(currentProfile());
  if (session.locked || value === '') return;
  const correct = q.choices ? value === q.answer : Number(value) === Number(q.answer.replace(/,/g, ''));

  if (correct) {
    session.locked = true;
    if (session.attempts === 0) {
      session.firstTry++;
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
  session.missed.push({ question: q.summary ?? q.prompt, answer: shown });
  recordAnswer(q, false);
  setFeedback('reveal', `The answer is ${shown}`);
  say("That's a tricky one. We'll get the next one!", 'sad');
  if (choiceEl) choiceEl.classList.add('wrong');
  app.querySelectorAll('[data-choice]').forEach((b) => b.dataset.choice === q.answer && b.classList.add('right'));
  app.querySelector('#next').classList.remove('hidden');
}

// "How do you know?": pick the explanation that matches the thinking.
function showWhy(q) {
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
const TELL_STARTERS = [
  'First I…, then I…',
  'I know it’s right because…',
  'I can check it by…',
  'The picture shows…',
  'It’s not the other answer because…',
  'The trick I used was…',
];
const TELL_MAX = 2;
const TELL_AFTER = [2, 6]; // the earliest question for the 1st and 2nd prompt

function tellDue() {
  return currentProfile().tellGrownUp && !session.tellOff && session.tellAsked < TELL_MAX && session.index >= TELL_AFTER[session.tellAsked];
}

function showTell(q) {
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

/* ---------------------------- Results ---------------------------- */

function finishRound() {
  const p = currentProfile();
  const { topic, level, firstTry, bestStreak, missed, whyAsked, whyRight, tellAsked, told } = session;
  const stars = firstTry >= 9 ? 3 : firstTry >= 7 ? 2 : firstTry >= 5 ? 1 : 0;
  const key = `${topic.id}:${level}`;
  const newBest = stars > (p.best[key] || 0);
  if (newBest) p.best[key] = stars;
  const earned = (firstTry + whyRight + told) * level;
  p.history.unshift({ t: Date.now(), topic: topic.id, level, firstTry, whyAsked, whyRight, tellAsked, told });
  p.history.length = Math.min(p.history.length, 60);
  const bonuses = [];
  if (session.focus) bonuses.push(['⭐ Focus quest bonus', FOCUS_BONUS]);
  if (p.weeklyGoal && p.goalWeek !== weekStart() && questsThisWeek(p) >= p.weeklyGoal) {
    p.goalWeek = weekStart();
    bonuses.push(['🎯 Weekly goal reached', GOAL_BONUS]);
  }
  p.coins += earned + bonuses.reduce((sum, [, n]) => sum + n, 0);
  save();

  sounds.win();
  if (stars > 0) confetti(120);
  const message = ["Keep practicing, you're getting stronger!", 'Good job!', 'Great work!', 'PERFECT QUEST! 🏆'][stars];
  const nextLevel = stars === 3 && level < 3 ? LEVELS[level] : null;
  const cheapest = [...BUDDIES, ...HATS, ...THEMES].filter((i) => i.price > p.coins).sort((a, b) => a.price - b.price)[0];
  const buddyLine = nextLevel
    ? `Wow! Ready to try ${nextLevel.emoji} ${nextLevel.name}?`
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
        <p class="result-line">🪙 +${earned} coins &nbsp; 🔥 Best streak: ${bestStreak}</p>
        ${bonuses.map(([label, n]) => `<p class="result-line bonus">${label}! 🪙 +${n}</p>`).join('')}
        ${
          missed.length
            ? `<div class="review"><h3>Let's look at these again</h3>
                ${missed.map((m) => `<div class="review-row"><span>${esc(m.question)}</span><strong>${esc(m.answer)}</strong></div>`).join('')}
              </div>`
            : ''
        }
        <div class="panel-actions">
          <button class="btn secondary" data-action="shop">🛒 Shop</button>
          <button class="btn secondary" data-action="topics">Pick another</button>
          ${nextLevel ? `<button class="btn" data-action="harder">Try ${nextLevel.name} ${nextLevel.emoji}</button>` : '<button class="btn" data-action="again">Play again</button>'}
        </div>
      </div>
    </div>`);

  bindBubble();
  say(buddyLine, 'happy');
  if (p.autoRead) speak(`${message} You got ${firstTry} of ${QUESTIONS_PER_ROUND} on the first try. ${buddyLine}`);
  on('[data-action="shop"]', () => renderShop());
  on('[data-action="topics"]', renderTopics);
  on('[data-action="again"]', () => startRound(topic.id));
  on('[data-action="harder"]', () => {
    p.level = nextLevel.id;
    save();
    startRound(topic.id);
  });
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
