import { TOPICS, GRADES, LEVELS, speedFact, stepText } from './problems.js';
import { BUDDIES, HATS, EXTRAS, THEMES, TREATS, CATALOG, STAGES, stageFor } from './shop.js';
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
let speed = null; // the Speed Round being played
sounds.enabled = state.sound;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const save = () => saveState(state);
const currentProfile = () => state.profiles.find((p) => p.id === state.currentId);
const totalStars = (p) => Object.values(p.best).reduce((a, b) => a + b, 0);
const buddyOf = (p) => BUDDIES.find((b) => b.id === p.buddy) ?? BUDDIES[0];
const levelById = (id) => LEVELS.find((l) => l.id === id) ?? LEVELS[1];
// With 🧭 Auto, each topic (and the Speed Round) keeps its own level.
const topicLevel = (p, topicId) => (p.autoLevel ? p.topicLevels[topicId] ?? p.level : p.level);
const AUTO_UP = 3; // right on the first try this many times in a row → a level up
const AUTO_DOWN = 2; // missed the first try this many times in a row → a level down
// Special items (with `needs`) unlock once any buddy grows to that stage.
const maxStage = (p) => Math.max(0, ...Object.values(p.buddyXp ?? {}).map(stageFor));
const owns = (p, tab, item) => (item.needs ? maxStage(p) >= item.needs : item.price === 0) || p.owned[tab].includes(item.id);
const unlocksAt = (stage) => Object.values(CATALOG).flatMap((c) => c.items).filter((i) => i.needs === stage);
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
function weekStart(weeksAgo = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.setDate(d.getDate() - d.getDay() - 7 * weeksAgo);
}
const HISTORY_MAX = 200; // rounds kept, for Recent quests and weekly reports
// Warm-ups are extra practice, so they don't count toward the weekly goal.
const questsThisWeek = (p) => p.history.filter((h) => h.t >= weekStart() && h.topic !== 'warmup').length;

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

/* ---------------------------- Buddy growth ---------------------------- */

const buddyXp = (p, id = p.buddy) => p.buddyXp[id] ?? 0;

// Adds this round's coins to the buddy's growth. Returns the stages before and after.
function growBuddy(p, coins) {
  const before = stageFor(buddyXp(p));
  const maxBefore = maxStage(p);
  p.buddyXp[p.buddy] = buddyXp(p) + coins;
  // Special shop items unlocked for the first time by this growth.
  const unlocked = [];
  for (let st = maxBefore + 1; st <= maxStage(p); st++) unlocked.push(...unlocksAt(st));
  return { before, after: stageFor(buddyXp(p)), unlocked };
}

// A progress bar toward the buddy's next stage.
function growLine(p, gained = 0) {
  const xp = buddyXp(p);
  const i = stageFor(xp);
  const [stage, next] = [STAGES[i], STAGES[i + 1]];
  const pct = next ? ((xp - stage.xp) / (next.xp - stage.xp)) * 100 : 100;
  const name = esc(buddyName(p));
  return `<div class="grow">
    <div class="grow-text"><span>${stage.emoji} ${name} is a <strong>${stage.name}</strong> buddy${gained ? ` <b class="grow-gain">+${gained}</b>` : ''}</span>
      <small>${next ? `🪙 ${next.xp - xp} more to grow into ${next.emoji} ${next.name}` : 'Fully grown! 🌟'}</small></div>
    <div class="progress"><div style="width:${pct.toFixed(1)}%"></div></div>
  </div>`;
}

// The celebration line when a buddy reaches a new stage.
function grewLine(p, grown) {
  if (grown.after <= grown.before) return '';
  const s = STAGES[grown.after];
  const prizes = grown.unlocked.length ? `<small class="grew-unlock">🎁 New in the shop: ${grown.unlocked.map((i) => `${i.emoji} ${esc(i.name)}`).join(', ')}</small>` : '';
  return `<div class="grew">🎉 ${esc(buddyName(p))} grew into a <strong>${s.emoji} ${s.name}</strong> buddy!${prizes}</div>`;
}

function buddyHtml(p, size = '') {
  const hat = HATS.find((h) => h.id === p.hat);
  const extra = EXTRAS.find((x) => x.id === p.extra);
  return `<div class="buddy ${size} stage-${stageFor(buddyXp(p))}" id="buddy">
    ${extra && extra.id !== 'none' ? `<span class="buddy-extra">${extra.emoji}</span>` : ''}
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
          <button class="toggle-opt ${draft.wordSteps ? 'selected' : ''}" data-toggle="wordSteps"><span class="check"></span>📖 Word problems one sentence at a time, then “What do we know? What are we finding?”</button>
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
    const reading = { autoRead: !!draft.autoRead, easyRead: !!draft.easyRead, wordSteps: !!draft.wordSteps };
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
        ${p.autoLevel ? `<span class="lvl-tag" title="${levelById(topicLevel(p, t.id)).name}">${levelById(topicLevel(p, t.id)).emoji}</span>` : ''}
        ${starRow(p.autoLevel ? Math.max(0, ...LEVELS.map((l) => p.best[`${t.id}:${l.id}`] || 0)) : p.best[`${t.id}:${p.level}`] || 0)}
      </button>`,
    )
    .join('');
  const levels = LEVELS.map(
    (l) => `<button class="level-opt ${!p.autoLevel && l.id === p.level ? 'selected' : ''}" data-level="${l.id}">
      ${l.emoji} ${l.name}<small>🪙 ×${l.id} coins</small></button>`,
  ).join('') + `<button class="level-opt ${p.autoLevel ? 'selected' : ''}" data-level="auto">
      🧭 Auto<small>Moves with you</small></button>`;
  const done = questsThisWeek(p);
  const goal = p.weeklyGoal
    ? `<div class="goal"><span>🎯 This week: <strong>${Math.min(done, p.weeklyGoal)} of ${p.weeklyGoal}</strong> quests${done >= p.weeklyGoal ? ' ✅' : ''}</span>
        <div class="progress"><div style="width:${Math.min(100, (done / p.weeklyGoal) * 100)}%"></div></div></div>`
    : '';
  // Focus areas a grown-up added since the buddy last mentioned them.
  p.focusSeen = (p.focusSeen ?? []).filter((id) => p.focus.includes(id));
  const newFocus = p.focus.filter((id) => !p.focusSeen.includes(id)).map(findTopic).filter(Boolean);
  const listNames = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]);
  const greeting = newFocus.length
    ? `Your grown-up thinks we should practice ${listNames(newFocus.map((t) => `${t.emoji} ${t.name}`))} together! Let's be a team. 🤝 Look for the ⭐ Focus ${newFocus.length > 1 ? 'cards' : 'card'}.`
    : p.message ? `Hi ${p.name}! A note from your grown-up: “${p.message}”` : `Hi ${p.name}! Pick a quest!`;
  if (newFocus.length) {
    p.focusSeen.push(...newFocus.map((t) => t.id));
    save();
  }

  show(`
    <div class="screen">
      ${playerBar(p)}
      <div class="topics-head">
        ${buddyRow(p, greeting)}
        <div class="head-btns">
          <button class="btn shop-btn" data-action="shop">🛒 Shop</button>
          <button class="btn secondary shop-btn" data-action="stickers">📒 Stickers ${Object.keys(p.stickers).length}/${STICKERS.length}</button>
        </div>
      </div>
      ${growLine(p)}
      <div class="levels" role="group" aria-label="Difficulty">${levels}</div>
      ${goal}
      <div class="topics">${warmupCard(p)}${speedCard(p)}${cards}</div>
    </div>`);

  bindSound();
  bindBubble();
  on('[data-action="back"]', renderHome);
  on('[data-action="shop"]', () => renderShop());
  on('[data-action="speed"]', renderSpeedIntro);
  on('[data-action="warmup"]', () => {
    startQueue(warmupQueue(p), 'warmup');
    say(warmupDone(p) ? 'Extra warm-up! No bonus this time, but great practice. ☀️' : 'Good morning, brain! 5 quick ones. ☀️', 'happy');
  });
  on('[data-action="stickers"]', renderStickers);
  on('[data-level]', (el) => {
    if (el.dataset.level === 'auto') p.autoLevel = true;
    else {
      p.autoLevel = false;
      p.level = Number(el.dataset.level);
    }
    save();
    sounds.tap();
    renderTopics();
    if (p.autoLevel) say('Auto it is! I\'ll make it harder when you\'re on a roll, and easier when it gets tricky. 🧭', 'happy');
  });
  on('[data-topic]', (el) => startRound(el.dataset.topic));
  if (newFocus.length) {
    say(greeting, 'happy');
    if (p.autoRead) speak(greeting);
  }
}

/* ---------------------------- Shop ---------------------------- */

const shopTabs = (tab) => `<div class="tabs" role="tablist">
  ${[...Object.entries(CATALOG), ['treats', { label: 'Treats' }]].map(([key, c]) => `<button class="tab ${key === tab ? 'selected' : ''}" data-tab="${key}" role="tab">${c.label}</button>`).join('')}
</div>`;

function renderShop(tab = 'buddies', message = 'Welcome to the shop! What should we get?') {
  if (tab === 'treats') return renderTreats(message);
  const p = currentProfile();
  applyLook(p);
  const { items, slot } = CATALOG[tab];

  // Cheapest first; special unlockable items at the end.
  const cards = [...items]
    .sort((a, b) => (a.needs ? 1 : 0) - (b.needs ? 1 : 0) || a.price - b.price)
    .map((item) => {
      const owned = owns(p, tab, item);
      const using = p[slot] === item.id;
      let button;
      if (using) button = '<button class="buy-btn using" disabled>✓ Using</button>';
      else if (owned) button = `<button class="buy-btn owned" data-use="${item.id}">Use</button>`;
      else if (item.needs) button = `<button class="buy-btn locked special" disabled>🔒 Grow a ${STAGES[item.needs].emoji} ${STAGES[item.needs].name} buddy</button>`;
      else if (p.coins >= item.price) button = `<button class="buy-btn" data-buy="${item.id}">🪙 ${item.price}</button>`;
      else button = `<button class="buy-btn locked" disabled>🔒 🪙 ${item.price}</button>`;
      const art = tab === 'themes'
        ? `<div class="theme-swatch" style="background:${item.swatch}">${item.emoji}</div>`
        : tab === 'hats'
          ? `<div class="shop-emoji hat-preview"><span>${item.id === 'none' ? '' : item.emoji}</span><span>${buddyOf(p).emoji}</span></div>`
          : tab === 'extras'
            ? `<div class="shop-emoji extra-preview"><span>${buddyOf(p).emoji}</span><span>${item.id === 'none' ? '' : item.emoji}</span></div>`
            : `<div class="shop-emoji">${item.emoji}</div>`;
      const st = tab === 'buddies' && owned ? STAGES[stageFor(buddyXp(p, item.id))] : null;
      const stage = st ? `<div class="shop-stage">${st.emoji} ${st.name}</div>` : '';
      const badge = item.needs ? `<span class="special-tag">${STAGES[item.needs].emoji} Special</span>` : '';
      return `<div class="shop-item ${using ? 'equipped' : ''} ${item.needs ? 'special' : ''}">${badge}${art}<div class="shop-name">${esc(item.name)}</div>${stage}${button}</div>`;
    })
    .join('');

  show(`
    <div class="screen">
      ${playerBar(p)}
      <div class="topics-head">${buddyRow(p, message)}</div>
      ${shopTabs(tab)}
      <div class="shop-grid">${cards}</div>
      <p class="shop-tip">Earn coins by answering on the first try. Hard quests pay 🪙 ×3!
        ${tab === 'extras' ? '<br>Extras are things your buddy holds. Every buddy can use them.' : ''}
        ${tab === 'buddies' || tab === 'hats' || tab === 'extras' ? '<br>✨🌟 Special items are free: they unlock when one of your buddies grows big enough!' : ''}
        ${tab === 'buddies' ? '<br>Your buddy grows with every coin you earn together: 🍼 Baby → 🌱 Little → 🌿 Big → ✨ Super → 🌟 Legend. Spending coins never shrinks them!' : ''}</p>
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
    const stickers = checkStickers(p, { kind: 'shop' });
    save();
    const line = stickers.length ? `Yay! You got ${item.name}! And a new sticker: ${stickers.map((t) => `${t.emoji} ${t.name}`).join(', ')}!` : `Yay! You got ${item.name}!`;
    renderShop(tab, line);
    say(line, 'happy');
  });
}

// Treats: buy one and the buddy eats it right away and does a happy move.
function renderTreats(message = 'Snack time? I love treats! 😋') {
  const p = currentProfile();
  applyLook(p);
  const cards = TREATS.map((t) => `
    <div class="shop-item"><div class="shop-emoji">${t.emoji}</div><div class="shop-name">${esc(t.name)}</div>
      ${p.coins >= t.price ? `<button class="buy-btn" data-treat="${t.id}">🪙 ${t.price}</button>` : `<button class="buy-btn locked" disabled>🔒 🪙 ${t.price}</button>`}
    </div>`).join('');
  show(`
    <div class="screen">
      ${playerBar(p)}
      <div class="topics-head">${buddyRow(p, message)}</div>
      ${shopTabs('treats')}
      <div class="shop-grid">${cards}</div>
      <p class="shop-tip">Treats are a fun way to say thanks to your buddy. ${p.treatsFed ? `You've shared ${p.treatsFed} treat${p.treatsFed > 1 ? 's' : ''}!` : ''} Treats don't make your buddy grow, but earning coins does!</p>
    </div>`);
  bindSound();
  bindBubble();
  on('[data-action="back"]', renderTopics);
  on('[data-tab]', (el) => renderShop(el.dataset.tab));
  on('[data-treat]', (el) => {
    const t = TREATS.find((x) => x.id === el.dataset.treat);
    // Two taps, like buying anything else.
    if (!el.classList.contains('confirm')) {
      el.classList.add('confirm');
      el.textContent = 'Tap to share!';
      setTimeout(() => {
        if (!el.isConnected) return;
        el.classList.remove('confirm');
        el.textContent = `🪙 ${t.price}`;
      }, 3000);
      return;
    }
    p.coins -= t.price;
    p.treatsFed = (p.treatsFed ?? 0) + 1;
    const stickers = checkStickers(p, { kind: 'shop' });
    save();
    const line = stickers.length ? `${t.line} And a new sticker: ${stickers.map((st) => `${st.emoji} ${st.name}`).join(', ')}!` : t.line;
    renderTreats(line);
    feedBuddy(t);
    say(line);
    if (p.autoRead) speak(line);
  });
}

// The treat flies to the buddy, then the buddy does its move with hearts.
function feedBuddy(t) {
  const buddy = app.querySelector('#buddy');
  if (!buddy) return;
  const food = document.createElement('span');
  food.className = 'treat-fly';
  food.textContent = t.emoji;
  buddy.append(food);
  sounds.correct();
  setTimeout(() => {
    food.remove();
    buddy.classList.remove('happy', 'sad');
    buddy.classList.add(`treat-${t.move}`);
    for (let i = 0; i < 5; i++) {
      const heart = document.createElement('span');
      heart.className = 'treat-heart';
      heart.textContent = pick(['❤️', '💖', '✨', '💛']);
      heart.style.setProperty('--dx', `${(i - 2) * 18}px`);
      heart.style.animationDelay = `${i * 0.08}s`;
      buddy.append(heart);
      setTimeout(() => heart.remove(), 1400);
    }
    if (t.move === 'party') confetti(80);
    setTimeout(() => buddy.classList.remove(`treat-${t.move}`), 1300);
  }, 550);
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
      if (s?.asked >= 8 && s.hinted / s.asked >= 0.5) flags.push('<span class="flag">💡 Leans on hints</span>');
      const lvl = p.autoLevel ? `🧭 ${levelById(topicLevel(p, t.id)).emoji} ${levelById(topicLevel(p, t.id)).name} · ` : '';
      const detail = s?.asked
        ? `${lvl}${pct}% right the first time (${s.firstTry} of ${s.asked})${s.whyAsked ? ` · 🧠 ${s.whyRight} of ${s.whyAsked} explained` : ''}${s.tellAsked ? ` · 🗣️ ${s.told} of ${s.tellAsked} out loud` : ''}${s.hinted ? ` · 💡 hints on ${s.hinted} question${s.hinted > 1 ? 's' : ''}` : ''} · ${ago(s.last)}`
        : `${lvl}Not played yet`;
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
    if (h.topic === 'speed') {
      return `<div class="review-row"><span>${date} · ⚡ Speed Round · ${lvl?.emoji ?? ''}</span>
        <strong>${h.speed} in ${minutes(h.seconds)}${h.wrong ? ` · ✗ ${h.wrong}` : ''}</strong></div>`;
    }
    const label = h.topic === 'warmup' ? '☀️ Daily warm-up' : `${t?.emoji ?? ''} ${esc(t?.name ?? h.topic)}`;
    return `<div class="review-row"><span>${date} · ${label} · ${lvl?.emoji ?? ''}</span>
      <strong>${h.firstTry}/${h.total ?? QUESTIONS_PER_ROUND}${h.whyAsked ? ` · 🧠 ${h.whyRight}/${h.whyAsked}` : ''}${h.tellAsked ? ` · 🗣️ ${h.told}/${h.tellAsked}` : ''}${h.hinted ? ` · 💡 ${h.hinted}` : ''}</strong></div>`;
  }).join('');

  const speedBests = Object.entries(p.speed.best)
    .filter(([k]) => k.startsWith(`${p.grade}:`))
    .map(([k, n]) => {
      const [, level, seconds] = k.split(':').map(Number);
      const lvl = LEVELS.find((l) => l.id === level);
      return `<div class="review-row"><span>🏅 Best · ${lvl?.emoji ?? ''} ${lvl?.name ?? ''} · ${minutes(seconds)}</span><strong>${n}</strong></div>`;
    })
    .join('');
  const tricky = Object.entries(p.speed.missed).sort((a, b) => b[1] - a[1]).slice(0, 8);

  show(`
    <div class="screen parents">
      <div class="topbar">
        <button class="icon-btn" data-action="back" aria-label="Back">←</button>
        <div class="who"><strong>👪 Grown-ups</strong></div>
      </div>
      <div class="tabs" role="tablist">
        ${state.profiles.map((k) => `<button class="tab ${k.id === p.id ? 'selected' : ''}" data-child="${k.id}" role="tab">${k.avatar} ${esc(k.name)}</button>`).join('')}
      </div>

      <div class="panel report-link">
        <h2>📄 Weekly report</h2>
        <p class="panel-note">How ${esc(first)}'s week went, with ideas for next week. Easy to print or save as a PDF. This week: <strong>${questsThisWeek(p)}</strong> quest${questsThisWeek(p) === 1 ? '' : 's'} so far.</p>
        <button class="btn" data-action="report">Open weekly report</button>
      </div>

      <div class="panel">
        <h2>⭐ Focus areas</h2>
        <p class="panel-note">Tick what ${esc(first)} is working on. Focus quests show first on ${esc(first)}'s screen, pay ${FOCUS_BONUS} bonus coins, and come up more often in Mixed Challenge, Fix the Mistake and the daily warm-up. ${esc(buddyName(p))} tells ${esc(first)} about new ones as a team goal.
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
        <h2>🧭 Difficulty</h2>
        <div class="toggle-list">
          <button class="toggle-opt ${p.autoLevel ? 'selected' : ''}" data-toggle="autoLevel"><span class="check"></span>
            <span>🧭 Auto level <small class="block">Each topic keeps its own level. It goes up after ${AUTO_UP} first-try answers in a row and down after ${AUTO_DOWN} misses in a row, so ${esc(first)} stays challenged without getting stuck. ${esc(first)} can also pick this on the quest screen.</small></span></button>
        </div>
        ${p.autoLevel ? '' : `<p class="panel-note">Right now ${esc(first)} plays everything at ${levelById(p.level).emoji} ${levelById(p.level).name}.</p>`}
      </div>

      <div class="panel">
        <h2>⚡ Speed Round</h2>
        <div class="toggle-list">
          <button class="toggle-opt ${p.speedOn ? 'selected' : ''}" data-toggle="speedOn"><span class="check"></span>
            <span>Show the Speed Round <small class="block">A timed round of quick ${p.grade === 2 ? 'add and subtract' : 'times and division'} facts. Turn it off if the clock is stressful.</small></span></button>
        </div>
        ${speedBests ? `<div class="review">${speedBests}</div>` : '<p class="panel-note">No Speed Rounds yet.</p>'}
        ${tricky.length ? `<p class="panel-note"><strong>Facts to practice:</strong> ${tricky.map(([k, n]) => `${esc(k)} = ${factFromKey(k).answer}${n > 1 ? ` (missed ${n}×)` : ''}`).join(' · ')}</p>
          <p class="panel-note">These come up more often in the Speed Round until ${esc(first)} gets them right.</p>` : ''}
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
        <h2>💾 Backup</h2>
        <p class="panel-note">Progress is saved only in this browser. Clearing the browser's data, or using another device, starts over.
          Save a backup file now and then, and restore it here if anything goes wrong. It holds every player.</p>
        <p class="panel-note">${state.lastBackup ? `Last backup: <strong>${ago(state.lastBackup)}</strong>.` : '<strong>No backup yet.</strong>'}
          ${!state.lastBackup || Date.now() - state.lastBackup > 30 * 86400000 ? ' <span class="flag">💾 Time for a backup</span>' : ''}</p>
        <div class="pin-row">
          <button class="btn" data-action="backup">💾 Save a backup file</button>
          <label class="btn secondary file-btn">📂 Restore from a file<input type="file" id="restoreFile" accept=".json,application/json" hidden /></label>
        </div>
        <div class="feedback" id="backupFeedback"></div>
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
  on('[data-action="report"]', () => renderReport(p.id));
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
    // The Difficulty note and the per-topic levels depend on Auto.
    if (el.dataset.toggle === 'autoLevel') {
      const y = window.scrollY;
      renderParents(p.id);
      window.scrollTo(0, y);
    }
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
  on('[data-action="backup"]', () => {
    downloadBackup();
    renderParents(p.id);
  });
  app.querySelector('#restoreFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) restoreBackup(file, p.id);
  });
  on('[data-action="clearPin"]', () => {
    state.pin = '';
    save();
    renderParents(p.id);
  });
}

/* ---------------------------- Weekly report ---------------------------- */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const shortDate = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const pctOf = (n, d) => (d ? Math.round((100 * n) / d) : 0);

// Adds up one week of rounds (weeksAgo = 0 is this week).
function weekSummary(p, weeksAgo) {
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

function renderReport(childId, weeksAgo = 0) {
  applyLook(null);
  const p = state.profiles.find((k) => k.id === childId) ?? state.profiles[0];
  const name = esc(p.name);
  const w = weekSummary(p, weeksAgo);
  const last = weekSummary(p, weeksAgo + 1);
  const firstPct = pctOf(w.first, w.asked);
  const change = (now, before, unit = '') => {
    if (!before && before !== 0) return '';
    const d = now - before;
    return d ? `<small class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)}${unit} vs last week</small>` : '<small class="delta">same as last week</small>';
  };
  const lastPct = last.asked ? pctOf(last.first, last.asked) : null;
  const goal = p.weeklyGoal ? ` of ${p.weeklyGoal}` : '';

  const topicRows = Object.entries(w.topics)
    .map(([id, t]) => ({ id, t, topic: findTopic(id), pct: pctOf(t.first, t.asked) }))
    .sort((a, b) => b.t.asked - a.t.asked);
  const rowHtml = topicRows.map(({ t, topic, pct }) => `
    <div class="report-row">
      <span class="report-topic">${topic?.emoji ?? ''} ${esc(topic?.name ?? '')}</span>
      <span class="report-bar"><span style="width:${pct}%" class="${pct >= 80 ? 'good' : pct < 70 ? 'low' : ''}"></span></span>
      <span class="report-num">${pct}% <small>of ${t.asked}</small></span>
    </div>`).join('');

  const enough = topicRows.filter((r) => r.t.asked >= 5 && r.topic && !r.topic.extra);
  const wins = enough.filter((r) => r.pct >= 80).sort((a, b) => b.pct - a.pct).slice(0, 3);
  const tricky = enough.filter((r) => r.pct < 70).sort((a, b) => a.pct - b.pct).slice(0, 3);
  const facts = Object.entries(p.speed.missed).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => `${k} = ${factFromKey(k).answer}`);

  // A few ideas for next week, most useful first.
  const ideas = [];
  if (!w.rounds.length) ideas.push(`Pick two or three short practice times for next week. Ten minutes on a few days beats one long session.`);
  else if (w.days.size < 3) ideas.push(`${name} practiced on ${w.days.size} day${w.days.size === 1 ? '' : 's'}. Short quests on more days help facts stick.`);
  if (tricky[0]) ideas.push(`Do ${/^[AEIOU]/.test(tricky[0].topic.name) ? 'an' : 'a'} ${esc(tricky[0].topic.name)} quest together. Open the 💡 steps and ask “What would you do next?” before each one.`);
  if (w.whyAsked >= 3 && w.whyRight / w.whyAsked < 0.6) ideas.push(`Explaining was tricky this week. At homework time, ask “How do you know?” and let ${name} talk it through before you help.`);
  if (w.asked >= 10 && w.hinted / w.asked >= 0.5) ideas.push(`${name} used hints on about half the questions. Before tapping 💡, ask what the first step might be.`);
  if (facts.length && weeksAgo === 0) ideas.push(`Quick facts to practice in the car or at dinner: ${facts.slice(0, 4).join(', ')}.`);
  if (w.rounds.length && !tricky.length && firstPct >= 85) ideas.push(`A strong week! Try 🔥 Hard or 🧭 Auto so ${name} keeps being challenged.`);
  if (w.tellAsked && w.told / w.tellAsked >= 0.5) ideas.push(`Great talking-it-out this week. Keep tapping ⭐ when the steps are clear.`);

  const weekStickers = STICKERS.filter((st) => p.stickers[st.id] >= w.from && p.stickers[st.id] < w.to);
  const days = DAY_NAMES.map((d, i) => `<div class="day ${w.perDay[i] ? 'on' : ''}"><b>${d}</b><span>${w.perDay[i] ? '✓'.repeat(Math.min(3, w.perDay[i])) : '–'}</span></div>`).join('');

  show(`
    <div class="screen parents report">
      <div class="topbar no-print">
        <button class="icon-btn" data-action="back" aria-label="Back">←</button>
        <div class="who"><strong>📄 Weekly report</strong></div>
        <button class="btn small" data-action="print">🖨️ Print</button>
      </div>
      <div class="week-nav no-print">
        <button class="btn secondary small" data-week="${weeksAgo + 1}">‹ Earlier</button>
        <span>${weeksAgo === 0 ? 'This week' : weeksAgo === 1 ? 'Last week' : `${weeksAgo} weeks ago`}</span>
        <button class="btn secondary small" data-week="${weeksAgo - 1}" ${weeksAgo === 0 ? 'disabled' : ''}>Later ›</button>
      </div>

      <div class="panel">
        <div class="report-head">
          <span class="report-avatar">${p.avatar}</span>
          <div><h2>${name}'s week</h2>
            <p class="panel-note">Grade ${p.grade} · ${shortDate(w.from)} – ${shortDate(w.to - 1)}</p></div>
        </div>
        ${w.rounds.length ? `
        <div class="tiles">
          <div class="tile"><strong>${w.goalCount}${goal}</strong><span>quests${p.weeklyGoal && w.goalCount >= p.weeklyGoal ? ' 🎯' : ''}</span>${change(w.goalCount, last.goalCount)}</div>
          <div class="tile"><strong>${w.days.size} of 7</strong><span>days practiced</span></div>
          <div class="tile"><strong>${w.asked ? `${firstPct}%` : '–'}</strong><span>right first try</span>${w.asked && lastPct !== null ? change(firstPct, lastPct, '%') : ''}</div>
          <div class="tile"><strong>${w.asked}</strong><span>questions</span></div>
          <div class="tile"><strong>🪙 ${w.coins}</strong><span>coins earned</span></div>
        </div>
        <div class="days">${days}</div>` : `<p class="panel-note">No quests this week${weeksAgo === 0 ? ' yet' : ''}.</p>`}
        ${weekStickers.length ? `<p class="panel-note">📒 New stickers: ${weekStickers.map((st) => `${st.emoji} ${esc(st.name)}`).join(' · ')}</p>` : ''}
      </div>

      ${rowHtml ? `<div class="panel"><h2>📚 Topics</h2><p class="panel-note">How often ${name} got it right on the first try, and how many questions.</p>${rowHtml}</div>` : ''}

      ${wins.length || tricky.length ? `
      <div class="panel two-col">
        <div><h3>🌟 Going well</h3>${wins.length ? `<ul>${wins.map((r) => `<li>${r.topic.emoji} ${esc(r.topic.name)}: ${r.pct}%</li>`).join('')}</ul>` : '<p class="panel-note">Keep going, wins are on the way!</p>'}</div>
        <div><h3>🔎 Worth practicing</h3>${tricky.length ? `<ul>${tricky.map((r) => `<li>${r.topic.emoji} ${esc(r.topic.name)}: ${r.pct}%
          ${p.focus.includes(r.id) ? '<small>(focus area)</small>' : `<button class="link-btn no-print" data-focus-add="${r.id}">⭐ Make it a focus area</button>`}</li>`).join('')}</ul>` : '<p class="panel-note">Nothing under 70% this week.</p>'}</div>
      </div>` : ''}

      ${w.quests.length || w.speedRounds.length ? `
      <div class="panel">
        <h2>🧠 Thinking & speed</h2>
        <div class="review">
          ${w.whyAsked ? `<div class="review-row"><span>🧠 Picked the right explanation</span><strong>${w.whyRight} of ${w.whyAsked}</strong></div>` : ''}
          ${w.tellAsked ? `<div class="review-row"><span>🗣️ Great explaining out loud</span><strong>${w.told} of ${w.tellAsked}</strong></div>` : ''}
          ${w.asked ? `<div class="review-row"><span>💡 Questions with a hint</span><strong>${w.hinted} of ${w.asked}</strong></div>` : ''}
          ${w.warmups.length ? `<div class="review-row"><span>☀️ Daily warm-ups</span><strong>${w.warmups.length} · ${pctOf(w.warmups.reduce((n, h) => n + h.firstTry, 0), w.warmups.reduce((n, h) => n + h.total, 0))}% right first try</strong></div>` : ''}
          ${w.speedRounds.length ? `<div class="review-row"><span>⚡ Speed Rounds</span><strong>${w.speedRounds.length}${w.best1 ? ` · best ${w.best1} in 1 min` : ''} · ${pctOf(w.speedRight, w.speedRight + w.speedWrong)}% right</strong></div>` : ''}
        </div>
        ${facts.length && weeksAgo === 0 ? `<p class="panel-note"><strong>Facts to practice:</strong> ${facts.map(esc).join(' · ')}</p>` : ''}
      </div>` : ''}

      ${ideas.length ? `<div class="panel"><h2>💬 Ideas for next week</h2><ul class="ideas">${ideas.slice(0, 4).map((i) => `<li>${i}</li>`).join('')}</ul></div>` : ''}
    </div>`);

  on('[data-action="back"]', () => renderParents(p.id));
  on('[data-action="print"]', () => window.print());
  on('[data-week]', (el) => !el.disabled && renderReport(p.id, Number(el.dataset.week)));
  on('[data-focus-add]', (el) => {
    p.focus = [...new Set([...p.focus, el.dataset.focusAdd])];
    save();
    el.outerHTML = '<small>⭐ Added as a focus area</small>';
  });
}

/* ---------------------------- Backup ---------------------------- */

// Saves everything (all players) as a file the grown-up can keep.
function downloadBackup() {
  state.lastBackup = Date.now();
  save();
  const data = JSON.stringify({ app: 'math-quest', version: 1, saved: Date.now(), state });
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  a.download = `math-quest-backup-${day}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function restoreBackup(file, childId) {
  const fail = (text) => {
    const el = app.querySelector('#backupFeedback');
    if (el) {
      el.className = 'feedback try';
      el.textContent = text;
    }
  };
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return fail("That file isn't a Math Quest backup.");
  }
  const incoming = data?.app === 'math-quest' ? data.state : data;
  if (!Array.isArray(incoming?.profiles) || !incoming.profiles.length || !incoming.profiles.every((k) => k?.id && k?.name)) {
    return fail("That file isn't a Math Quest backup.");
  }
  const when = data.saved ? new Date(data.saved).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'an earlier date';
  const names = incoming.profiles.map((k) => k.name).join(', ');
  if (!confirm(`Replace everything on this device with the backup from ${when} (${names})? Progress since then will be lost.`)) return;
  saveState(incoming);
  state = loadState();
  sounds.enabled = state.sound;
  state.lastBackup ??= data.saved;
  save();
  renderParents(state.profiles.some((k) => k.id === childId) ? childId : state.profiles[0].id);
  const el = app.querySelector('#backupFeedback');
  el.className = 'feedback good';
  el.textContent = `✓ Restored ${names}`;
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
    topic, level: topicLevel(p, topic.id), auto: p.autoLevel, total: QUESTIONS_PER_ROUND, index: 0, firstTry: 0, streak: 0, bestStreak: 0,
    points: 0, byTopic: {}, upRun: 0, downRun: 0, levelNote: '', levelCounts: { 1: 0, 2: 0, 3: 0 },
    pool: [...core, ...focus, ...focus, ...focus], focus: p.focus.includes(topic.id),
    missed: [], seen: new Set(), whyDue: false, whyAsked: 0, whyRight: 0, tellAsked: 0, told: 0, tellOff: false, hinted: 0,
  };
  loadQuestion();
}

function loadQuestion() {
  // Avoid repeating the same question within a round.
  let q;
  let tries = 0;
  if (session.queue) session.level = session.queue[session.index].level;
  do q = session.topic.gen(session.level, session.pool);
  while (session.seen.has(q.summary ?? q.prompt) && tries++ < 25);
  session.seen.add(q.summary ?? q.prompt);
  q.topicId ??= session.topic.id;
  q.level = session.level;
  session.levelCounts[q.level]++;
  const name = buddyName(currentProfile());
  for (const key of ['prompt', 'hint', 'summary']) if (q[key]) q[key] = q[key].replaceAll('{buddy}', name);
  // Each step is its text, or { text, pic } with a little picture.
  q.steps = (q.steps?.length ? q.steps : [q.hint]).map((step) =>
    typeof step === 'string' ? step.replaceAll('{buddy}', name) : { ...step, text: step.text.replaceAll('{buddy}', name) });
  if (WHY_AT.includes(session.index)) session.whyDue = true;
  Object.assign(session, { current: q, attempts: 0, locked: false, input: '', stepsShown: 0 });
  renderQuestion();
}

// 🧭 Auto: move up after a run of first-try answers, down after a run of misses.
function trackLevel(firstTry) {
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

function nextQuestion() {
  session.index++;
  if (session.index >= session.total) session.mode === 'warmup' ? finishWarmup() : session.queue ? finishReplay() : finishRound();
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

// "Ruby has 32 gems and gets 17 more. How many gems now?" → two sentences.
const splitSentences = (text) => text.split(/(?<=[.?!])\s+(?=[A-Z0-9"])/).filter(Boolean);

function sentencePrompt(sentences) {
  return `<div class="prompt word sentences" id="sentences">${sentences
    .map((t, i) => `<span class="sentence ${i ? 'hidden' : 'latest'}">${esc(t)}</span>`)
    .join(' ')}</div>
    <button class="btn secondary small" data-action="nextSentence" id="nextSentence">📖 Next sentence (2 of ${sentences.length})</button>
    <div class="planner hidden" id="planner"></div>`;
}

// Shows the next sentence; after the last one, a "What do we know? What are we finding?" box.
function showSentence(sentences) {
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

function renderQuestion() {
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
  const greeting = note || (q.claim !== undefined
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
        <div class="streak" title="Streak">${session.streak >= 2 ? '🔥' : ''}${session.streak}</div>
      </div>
      ${buddyRow(p, greeting)}
      <div class="question" id="question">
        ${sayButton('question', 'Read the question aloud')}
        <div class="q-count">${session.topic.emoji} ${session.mode === 'warmup' ? 'Warm-up ' : session.queue ? 'Try again ' : 'Question '}${session.index + 1} of ${session.total} · ${session.auto ? '🧭 ' : ''}${levelById(q.level).emoji} ${levelById(q.level).name}</div>
        ${sentences ? sentencePrompt(sentences) : `<div class="prompt ${q.word ? 'word' : ''}">${esc(q.prompt)}</div>`}
        ${q.visual ? `<div class="visual">${q.visual}</div>` : ''}
        ${claim}
        ${q.choices ? '' : '<div class="answer-display" id="answer">&nbsp;</div>'}
        <div class="feedback" id="feedback"></div>
        <div class="hint hidden" id="hint">
          <div class="hint-head">💡 Step by step</div>
          <ol class="steps" id="steps"></ol>
        </div>
      </div>
      <div id="input-area">${input}</div>
      <div class="play-actions">
        <button class="btn secondary" data-action="hint" id="hintBtn">💡 Hint</button>
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
    if (confirm('Quit this quest? Your progress in this round will be lost.')) renderTopics();
  });
  if (p.autoRead) speak(sentences ? sentences[0] : questionSpeech(q));
}

function pressKey(key) {
  if (session.locked) return;
  if (key === 'enter') return submit(session.input);
  if (key === 'back') session.input = session.input.slice(0, -1);
  else if (session.input.length < 8) session.input = (session.input + key).replace(/^0+(?=\d)/, '');
  app.querySelector('#answer').textContent = session.input ? Number(session.input).toLocaleString('en-US') : ' ';
}

// Step-by-step hints: each tap shows one more step. The last step always
// leaves the final bit of work for the kid.
function showHint() {
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
  p.stats[q.topicId].hinted ??= 0;
  return p.stats[q.topicId];
}

function recordHint(q) {
  topicStats(q).hinted++;
  session.hinted++;
  save();
}

function recordAnswer(q, firstTry) {
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
    trackLevel(session.attempts === 0);
    if (session.attempts === 0) {
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

/* ---------------------------- Results ---------------------------- */

// Pays the weekly goal bonus once, the first time the goal is reached each week.
function goalBonus(p, bonuses) {
  if (p.weeklyGoal && p.goalWeek !== weekStart() && questsThisWeek(p) >= p.weeklyGoal) {
    p.goalWeek = weekStart();
    bonuses.push(['🎯 Weekly goal reached', GOAL_BONUS]);
  }
}

function finishRound() {
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
  entry.coins = earned + bonuses.reduce((sum, [, n]) => sum + n, 0);
  p.coins += entry.coins;
  p.questCount++;
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

/* ---------------------------- Sticker book ---------------------------- */

// Stickers for good habits as well as right answers. Each is checked after a
// round (ctx says what kind), or after buying something in the shop.
const STICKER_COINS = 5;
const quest = (c) => c.kind === 'quest';
const totalTold = (p) => Object.values(p.stats).reduce((n, s) => n + (s.told || 0), 0);
const topicsPlayed = (p) => coreTopics(p.grade).filter((t) => p.stats[t.id]?.asked).length;
const daysThisWeek = (p) => new Set(p.history.filter((h) => h.t >= weekStart()).map((h) => new Date(h.t).getDay())).size;
const ownedCount = (p) => Object.values(p.owned).reduce((n, list) => n + list.length, 0);

const STICKERS = [
  { id: 'first', emoji: '🎉', name: 'First quest', how: 'Finish a quest.', test: (p, c) => quest(c) },
  { id: 'streak5', emoji: '🔥', name: 'On fire', how: 'Get 5 in a row on the first try.', test: (p, c) => quest(c) && c.bestStreak >= 5 },
  { id: 'perfect', emoji: '⭐', name: 'Perfect!', how: 'Get all 10 right on the first try.', test: (p, c) => quest(c) && c.firstTry === 10 },
  { id: 'hard', emoji: '🌶️', name: 'Brave brain', how: 'Finish a 🔥 Hard quest.', test: (p, c) => quest(c) && c.level === 3 },
  { id: 'summit', emoji: '🏔️', name: 'Mountain top', how: 'Get a perfect 🔥 Hard quest.', test: (p, c) => quest(c) && c.level === 3 && c.firstTry === 10 },
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
function checkStickers(p, ctx) {
  const earned = STICKERS.filter((st) => !p.stickers[st.id] && st.test(p, ctx));
  for (const st of earned) p.stickers[st.id] = Date.now();
  p.coins += earned.length * STICKER_COINS;
  return earned;
}

function stickerLine(stickers) {
  if (!stickers.length) return '';
  return `<div class="new-stickers"><strong>📒 New sticker${stickers.length > 1 ? 's' : ''}!</strong>
    <div class="sticker-row">${stickers.map((st) => `<span class="sticker earned"><b>${st.emoji}</b>${esc(st.name)}</span>`).join('')}</div>
    <small>🪙 +${stickers.length * STICKER_COINS} coins</small></div>`;
}

function renderStickers() {
  const p = currentProfile();
  applyLook(p);
  const have = Object.keys(p.stickers).length;
  const cards = STICKERS.map((st) => {
    const when = p.stickers[st.id];
    return `<div class="sticker ${when ? 'earned' : 'locked'}"><b>${st.emoji}</b><strong>${esc(st.name)}</strong>
      <small>${when ? `✓ ${new Date(when).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : esc(st.how)}</small></div>`;
  }).join('');
  const next = STICKERS.find((st) => !p.stickers[st.id]);
  show(`
    <div class="screen">
      ${playerBar(p)}
      <div class="topics-head">${buddyRow(p, have === STICKERS.length ? 'You got every sticker! WOW! 🏆' : `You have ${have} of ${STICKERS.length} stickers!${next ? ` Next idea: ${next.how}` : ''}`)}</div>
      <h2 class="sticker-title">📒 Sticker book</h2>
      <div class="sticker-book">${cards}</div>
      <p class="shop-tip">Each new sticker gives 🪙 ${STICKER_COINS} coins. Grey ones say how to get them.</p>
    </div>`);
  bindSound();
  bindBubble();
  on('[data-action="back"]', renderTopics);
}

/* ---------------------------- Daily warm-up ---------------------------- */

// 5 quick questions a day, mostly from focus areas, recent misses and tricky topics.
const WARMUP_SIZE = 5;
const WARMUP_BONUS = 5;
const today = () => startOfDay(Date.now());
const warmupDone = (p) => p.warmup?.day === today();
// The streak only counts if the last warm-up was today or yesterday.
const warmupStreak = (p) => (p.warmup && today() - p.warmup.day <= 86400000 * 1.5 ? p.warmup.streak : 0);

function warmupCard(p) {
  const streak = warmupStreak(p);
  const streakText = streak ? `🔥 ${streak}-day streak` : 'Start a streak!';
  return `
    <button class="topic-card warmup-card ${warmupDone(p) ? 'done' : ''}" data-action="warmup">
      <div class="topic-emoji">${warmupDone(p) ? '✅' : '☀️'}</div>
      <div class="topic-name">Daily warm-up</div>
      <div class="topic-desc">${warmupDone(p) ? 'Done today! Come back tomorrow.' : `${WARMUP_SIZE} quick questions · 🪙 bonus`}</div>
      <div class="speed-best">${streakText}</div>
    </button>`;
}

function warmupQueue(p) {
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

function finishWarmup() {
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

/* ---------------------------- Try these again ---------------------------- */

// A short round with fresh questions of the same kinds the kid just missed.
const REPLAY_MAX = 5;
const REPLAY_BONUS = 5; // for fixing every one

function startReplay(missed) {
  startQueue(missed.slice(0, REPLAY_MAX).map((m) => ({ topicId: m.topicId, level: m.level })), 'replay');
  say(`New numbers, same kind of problem. You've got this! 🔁`, 'happy');
}

// A short round from a list of { topicId, level }: Try these again, or the daily warm-up.
function startQueue(queue, mode) {
  const p = currentProfile();
  session = {
    mode,
    topic: {
      id: mode, name: mode === 'warmup' ? 'Warm-up' : 'Try again', emoji: mode === 'warmup' ? '☀️' : '🔁',
      gen: (level) => {
        const m = session.queue[session.index];
        return { topicId: m.topicId, ...findTopic(m.topicId).gen(level) };
      },
    },
    queue, total: queue.length, level: queue[0].level, auto: false, index: 0, firstTry: 0, streak: 0, bestStreak: 0,
    points: 0, byTopic: {}, upRun: 0, downRun: 0, levelNote: '', levelCounts: { 1: 0, 2: 0, 3: 0 },
    pool: coreTopics(p.grade), focus: false,
    missed: [], seen: new Set(), whyDue: false, whyAsked: 0, whyRight: 0, tellAsked: 0, told: 0, tellOff: true, hinted: 0,
  };
  loadQuestion();
}

function finishReplay() {
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

/* ---------------------------- Speed Round ---------------------------- */

// A timed round of quick facts: as many as you can before the time runs out.
// Facts the kid missed before come up more often, and the Grown-ups page lists them.
const SPEED_TIMES = [60, 120];
const SPEED_NEW_BEST = 5; // bonus coins for beating your best
const SPEED_UP_PACE = 15; // right answers a minute (at 90%+ right) to level up in Auto
const speedKeyOf = (p, seconds) => `${p.grade}:${topicLevel(p, 'speed')}:${seconds}`;
const speedBest = (p, seconds) => p.speed.best[speedKeyOf(p, seconds)] ?? 0;
const minutes = (seconds) => `${seconds / 60} min`;

function speedCard(p) {
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

// Turn a saved fact ("7 × 8") back into a question, in either order for + and ×.
function factFromKey(key) {
  let [a, op, b] = key.split(' ');
  if ((op === '+' || op === '×') && Math.random() < 0.5) [a, b] = [b, a];
  const [x, y] = [Number(a), Number(b)];
  return { text: `${x} ${op} ${y}`, key, answer: String({ '+': x + y, '−': x - y, '×': x * y, '÷': x / y }[op]) };
}

function nextFact() {
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

function renderSpeedIntro() {
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

function startSpeed(seconds) {
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

function playSpeed(p) {
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

function stopSpeed() {
  if (!speed) return;
  clearInterval(speed.timer);
  speed.running = false;
}

function speedKey(key) {
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

function checkSpeed() {
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

function showFact() {
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

function finishSpeed() {
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

/* ---------------------------- Keyboard ---------------------------- */

document.addEventListener('keydown', (e) => {
  if (speed?.running && app.querySelector('.speed-play')) {
    if (e.key === 'Enter') e.preventDefault();
    if (/^[0-9]$/.test(e.key)) speedKey(e.key);
    else if (e.key === 'Backspace') speedKey('back');
    else if (e.key === 'Enter') speedKey('enter');
    return;
  }
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
