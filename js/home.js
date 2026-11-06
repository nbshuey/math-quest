// Home, Edit player and the topics (quest) screen.

import { GRADES, LEVELS, TOPICS } from './problems.js';
import { confetti, sounds } from './effects.js';
import { speak, canSpeak } from './speech.js';
import { AVATARS, state, pick, esc, save, currentProfile, totalStars, buddyOf, levelById, topicLevel, findTopic, FOCUS_BONUS, weekStart, questsThisWeek } from './state.js';
import { birthdayGift, TEAM_BONUS, teamCount, teamOn, STICKERS, bossReady, WARMUP_SIZE, warmupDone, warmupStreak, warmupQueue } from './rewards.js';
import { app, starRow, show, applyLook, on, growLine, buddyRow, bindBubble, say, soundButton, bindSound } from './ui.js';
import { session, startRound, renderBossIntro, startQueue, setSession } from './play.js';
import { speedCard, renderSpeedIntro } from './speedround.js';
import { testCard, renderTestIntro } from './unittest.js';
import { renderShop, renderStickers } from './shopscreen.js';
import { renderParentGate } from './parents.js';
import { makeProfile } from './storage.js';

export function renderHome() {
  setSession(null);
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

export function renderEdit(id) {
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
        <div class="field-label">Birthday (optional, for a surprise)</div>
        <div class="birthday-row">
          <select id="bdMonth" class="text-input"><option value="">Month</option>${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => `<option value="${i + 1}" ${Number(draft.birthday?.split('-')[0]) === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select>
          <select id="bdDay" class="text-input"><option value="">Day</option>${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${Number(draft.birthday?.split('-')[1]) === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
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
    const [bm, bd] = [app.querySelector('#bdMonth').value, app.querySelector('#bdDay').value];
    const reading = { autoRead: !!draft.autoRead, easyRead: !!draft.easyRead, wordSteps: !!draft.wordSteps, birthday: bm && bd ? `${bm}-${bd}` : '' };
    if (existing) Object.assign(existing, { name, grade: draft.grade, avatar: draft.avatar, ...reading });
    else state.profiles.push({ ...makeProfile(name, draft.grade, draft.avatar), ...reading });
    save();
    renderHome();
  });
}

export function playerBar(p, backAction = 'back') {
  return `
    <div class="topbar">
      <button class="icon-btn" data-action="${backAction}" aria-label="Back">←</button>
      <div class="who">${p.avatar} <strong>${esc(p.name)}</strong></div>
      <div class="coin-pill">🪙 ${p.coins}</div>
      ${soundButton()}
    </div>`;
}

export function renderTopics() {
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
        ${bossReady(p, t.id) ? '<span class="boss-tag">👾 Boss!</span>' : ''}
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
  const birthday = birthdayGift(p);
  const teamCheer = p.teamCheer === weekStart();
  if (teamCheer) {
    delete p.teamCheer;
    save();
  }
  const greeting = birthday
    ? `Happy birthday, ${p.name}! 🎂 I got you presents: the 🎂 Birthday Party theme and a 🎁 Present to hold. Find them in the shop!`
    : teamCheer
    ? `🤝 Your team reached the goal! Everyone got ${TEAM_BONUS} coins${state.teamWins === 1 ? ', and the 🏰 Family Fort theme is in the shop' : ''}. Teamwork!`
    : newFocus.length
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
      ${teamBar(p)}
      <div class="topics">${warmupCard(p)}${speedCard(p)}${testCard(p)}${cards}</div>
    </div>`);

  bindSound();
  bindBubble();
  on('[data-action="back"]', renderHome);
  on('[data-action="shop"]', () => renderShop());
  on('[data-action="speed"]', renderSpeedIntro);
  on('[data-action="test"]', renderTestIntro);
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
  on('[data-topic]', (el) => (bossReady(p, el.dataset.topic) ? renderBossIntro(el.dataset.topic) : startRound(el.dataset.topic)));
  if (newFocus.length || birthday || teamCheer) {
    say(greeting, 'happy');
    if (p.autoRead) speak(greeting);
  }
  if (birthday || teamCheer) {
    sounds.win();
    confetti(150);
  }
}

export function teamBar(p) {
  if (!teamOn()) return '';
  const done = teamCount();
  const who = state.profiles.map((k) => `${k.avatar} ${questsThisWeek(k)}`).join(' · ');
  return `<div class="goal team"><span>🤝 Team goal: <strong>${Math.min(done, state.teamGoal)} of ${state.teamGoal}</strong> quests together${done >= state.teamGoal ? ' ✅' : ''} <small>${who}</small></span>
    <div class="progress"><div style="width:${Math.min(100, (done / state.teamGoal) * 100)}%"></div></div></div>`;
}

export function warmupCard(p) {
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
