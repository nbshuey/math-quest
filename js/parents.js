// The Grown-ups page: PIN, progress, settings, weekly report and backup.

import { LEVELS } from './problems.js';
import { saveState } from './storage.js';
import { sounds } from './effects.js';
import { QUESTIONS_PER_ROUND, state, esc, save, levelById, topicLevel, AUTO_UP, AUTO_DOWN, buddyName, coreTopics, findTopic, FOCUS_BONUS, GOAL_BONUS, startOfDay, questsThisWeek, reloadState } from './state.js';
import { DAY_NAMES, shortDate, pctOf, weekSummary, TEAM_BONUS, TEAM_GOALS, teamCount, STICKERS, factFromKey } from './rewards.js';
import { app, show, applyLook, on } from './ui.js';
import { setFeedback } from './play.js';
import { minutes } from './speedround.js';
import { renderHome } from './home.js';

export function renderParentGate() {
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

export function ago(t) {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(t)) / 86400000);
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

export const GOALS = [0, 3, 5, 7, 10];

export function renderParents(childId = state.currentId) {
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
    if (h.boss) {
      return `<div class="review-row"><span>${date} · 👾 Boss: ${t?.emoji ?? ''} ${esc(t?.name ?? h.topic)} · ${lvl?.emoji ?? ''}</span>
        <strong>${h.boss === 'won' ? 'Won! 🏆' : 'Escaped'} · ${h.firstTry}/${h.total}</strong></div>`;
    }
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
        ${state.profiles.length > 1 ? `
        <h3>🤝 Team goal (everyone together)</h3>
        <p class="panel-note">Quests from all players added up. Reaching it pays everyone ${TEAM_BONUS} coins, and the first time unlocks the 🏰 Family Fort theme. It rewards cheering each other on. This week: <strong>${teamCount()}</strong> together.</p>
        <div class="grade-row">
          ${TEAM_GOALS.map((g) => `<button class="grade-opt ${g === (state.teamGoal ?? 0) ? 'selected' : ''}" data-team-goal="${g}">${g ? `${g} quests` : 'Off'}</button>`).join('')}
        </div>` : ''}
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
  on('[data-team-goal]', (el) => {
    state.teamGoal = Number(el.dataset.teamGoal);
    app.querySelectorAll('[data-team-goal]').forEach((b) => b.classList.toggle('selected', b === el));
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

export function renderReport(childId, weeksAgo = 0) {
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

// Saves everything (all players) as a file the grown-up can keep.
export function downloadBackup() {
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

export async function restoreBackup(file, childId) {
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
  reloadState();
  sounds.enabled = state.sound;
  state.lastBackup ??= data.saved;
  save();
  renderParents(state.profiles.some((k) => k.id === childId) ? childId : state.profiles[0].id);
  const el = app.querySelector('#backupFeedback');
  el.className = 'feedback good';
  el.textContent = `✓ Restored ${names}`;
}
