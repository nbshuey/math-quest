// The shop, buddy treats and the sticker book.

import { TREATS, CATALOG, STAGES, stageFor, inSeason, nextSeason } from './shop.js';
import { confetti, sounds } from './effects.js';
import { speak } from './speech.js';
import { pick, esc, save, currentProfile, buddyOf, owns } from './state.js';
import { buddyXp, STICKER_COINS, STICKERS, checkStickers } from './rewards.js';
import { app, show, applyLook, on, buddyRow, bindBubble, say, bindSound } from './ui.js';
import { playerBar, renderTopics } from './home.js';

export const shopTabs = (tab) => `<div class="tabs" role="tablist">
  ${[...Object.entries(CATALOG), ['treats', { label: 'Treats' }]].map(([key, c]) => `<button class="tab ${key === tab ? 'selected' : ''}" data-tab="${key}" role="tab">${c.label}</button>`).join('')}
</div>`;

export function renderShop(tab = 'buddies', message = 'Welcome to the shop! What should we get?') {
  if (tab === 'treats') return renderTreats(message);
  const p = currentProfile();
  applyLook(p);
  const { items, slot } = CATALOG[tab];

  // Cheapest first; special unlockable items at the end.
  const cards = [...items]
    .sort((a, b) => (a.needs || a.gift ? 1 : 0) - (b.needs || b.gift ? 1 : 0) || (inSeason(a) ? 0 : 1) - (inSeason(b) ? 0 : 1) || a.price - b.price)
    .map((item) => {
      const owned = owns(p, tab, item);
      const using = p[slot] === item.id;
      let button;
      if (using) button = '<button class="buy-btn using" disabled>✓ Using</button>';
      else if (owned) button = `<button class="buy-btn owned" data-use="${item.id}">Use</button>`;
      else if (item.needs) button = `<button class="buy-btn locked special" disabled>🔒 Grow a ${STAGES[item.needs].emoji} ${STAGES[item.needs].name} buddy</button>`;
      else if (item.gift) button = `<button class="buy-btn locked special" disabled>${item.gift === 'team' ? '🤝 Reach a team goal' : '🎂 A birthday present'}</button>`;
      else if (!inSeason(item)) button = `<button class="buy-btn locked special" disabled>🗓️ Back in ${nextSeason(item)}</button>`;
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
      const badge = item.needs
        ? `<span class="special-tag">${STAGES[item.needs].emoji} Special</span>`
        : item.gift ? '<span class="special-tag">🎁 Gift</span>'
          : item.months && inSeason(item) && !owned ? '<span class="special-tag season">🗓️ This season</span>' : '';
      return `<div class="shop-item ${using ? 'equipped' : ''} ${item.needs || item.gift ? 'special' : ''}">${badge}${art}<div class="shop-name">${esc(item.name)}</div>${stage}${button}</div>`;
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
export function renderTreats(message = 'Snack time? I love treats! 😋') {
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
export function feedBuddy(t) {
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

export function renderStickers() {
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
