// Shared screen helpers: rendering, the buddy, sound and theme.

import { HATS, EXTRAS, THEMES, STAGES, stageFor } from './shop.js';
import { sounds } from './effects.js';
import { speak, stopSpeaking, canSpeak } from './speech.js';
import { state, esc, save, buddyOf, buddyName } from './state.js';
import { buddyXp, STICKER_COINS } from './rewards.js';

// Where the background decorations sit, as [left %, top %].
export const DECOR_SPOTS = [[4, 8], [88, 5], [14, 46], [93, 38], [3, 82], [82, 86], [50, 94], [36, 12], [66, 62], [24, 70]];

export const app = document.getElementById('app');

export const decor = document.getElementById('decor');

export const starRow = (n, max = 3) =>
  `<span class="stars">${Array.from({ length: max }, (_, i) => `<span class="${i < n ? '' : 'off'}">★</span>`).join('')}</span>`;

export const sayButton = (id, label = 'Read aloud') => (canSpeak ? `<button class="say-btn" data-say="${id}" aria-label="${label}">🔊</button>` : '');

export function show(html) {
  stopSpeaking();
  app.innerHTML = html;
  window.scrollTo(0, 0);
}

// The player's theme and reading settings (or the defaults on the home screen).
export function applyLook(p) {
  applyTheme(p?.theme ?? 'sunny');
  document.body.classList.toggle('easy-read', !!p?.easyRead);
}

export function on(selector, handler) {
  app.querySelectorAll(selector).forEach((el) => el.addEventListener('click', (e) => handler(el, e)));
}

export function applyTheme(themeId) {
  if (document.body.dataset.theme === themeId) return;
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  document.body.dataset.theme = theme.id;
  decor.innerHTML = DECOR_SPOTS.map(
    ([left, top], i) => `<span style="left:${left}%;top:${top}%;animation-delay:${-i * 0.7}s">${theme.decor[i % theme.decor.length]}</span>`,
  ).join('');
}

// A progress bar toward the buddy's next stage.
export function growLine(p, gained = 0) {
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
export function grewLine(p, grown) {
  if (grown.after <= grown.before) return '';
  const s = STAGES[grown.after];
  const prizes = grown.unlocked.length ? `<small class="grew-unlock">🎁 New in the shop: ${grown.unlocked.map((i) => `${i.emoji} ${esc(i.name)}`).join(', ')}</small>` : '';
  return `<div class="grew">🎉 ${esc(buddyName(p))} grew into a <strong>${s.emoji} ${s.name}</strong> buddy!${prizes}</div>`;
}

export function buddyHtml(p, size = '') {
  const hat = HATS.find((h) => h.id === p.hat);
  const extra = EXTRAS.find((x) => x.id === p.extra);
  return `<div class="buddy ${size} stage-${stageFor(buddyXp(p))}" id="buddy">
    ${extra && extra.id !== 'none' ? `<span class="buddy-extra">${extra.emoji}</span>` : ''}
    <span class="buddy-hat">${hat && hat.id !== 'none' ? hat.emoji : ''}</span>
    <span class="buddy-body">${buddyOf(p).emoji}</span>
  </div>`;
}

export function buddyRow(p, text) {
  return `<div class="buddy-row">${buddyHtml(p)}<button class="bubble" id="bubble" title="Tap to hear">${esc(text)}</button></div>`;
}

// Tapping the buddy's speech bubble reads it aloud.
export function bindBubble() {
  on('#bubble', (el) => speak(el.textContent));
}

// Make the buddy say something, with a little hop (happy) or wobble (sad).
export function say(text, mood) {
  const bubble = app.querySelector('#bubble');
  const buddy = app.querySelector('#buddy');
  if (bubble) bubble.textContent = text;
  if (buddy && mood) {
    buddy.classList.remove('happy', 'sad');
    void buddy.offsetWidth; // restart the animation
    buddy.classList.add(mood);
  }
}

export function soundButton() {
  return `<button class="icon-btn" data-action="sound" aria-label="Toggle sound">${state.sound ? '🔊' : '🔇'}</button>`;
}

export function bindSound() {
  on('[data-action="sound"]', (el) => {
    state.sound = sounds.enabled = !state.sound;
    el.textContent = state.sound ? '🔊' : '🔇';
    save();
  });
}

export function stickerLine(stickers) {
  if (!stickers.length) return '';
  return `<div class="new-stickers"><strong>📒 New sticker${stickers.length > 1 ? 's' : ''}!</strong>
    <div class="sticker-row">${stickers.map((st) => `<span class="sticker earned"><b>${st.emoji}</b>${esc(st.name)}</span>`).join('')}</div>
    <small>🪙 +${stickers.length * STICKER_COINS} coins</small></div>`;
}
