// Little celebrations: confetti bursts and sound effects.

const COLORS = ['#6c5ce7', '#20c997', '#ffb020', '#ff6b6b', '#4dabf7', '#f783ac'];

export function confetti(count = 40) {
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti';
    const angle = Math.random() * Math.PI * 2;
    const dist = 120 + Math.random() * 260;
    piece.style.setProperty('--x', `${Math.cos(angle) * dist}px`);
    piece.style.setProperty('--y', `${Math.sin(angle) * dist - 120}px`);
    piece.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    piece.style.background = COLORS[i % COLORS.length];
    piece.addEventListener('animationend', () => piece.remove());
    document.body.appendChild(piece);
  }
}

let ctx;

function tone(freq, start, dur, type = 'sine', gain = 0.12) {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)();
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  vol.gain.setValueAtTime(gain, t);
  vol.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(vol).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

export const sounds = {
  enabled: true,
  play(notes, type) {
    if (!this.enabled) return;
    try {
      notes.forEach(([freq, start, dur]) => tone(freq, start, dur, type));
    } catch {
      // Audio not available.
    }
  },
  correct() { this.play([[523, 0, 0.15], [659, 0.1, 0.15], [784, 0.2, 0.3]]); },
  wrong() { this.play([[300, 0, 0.18], [220, 0.15, 0.3]], 'triangle'); },
  tap() { this.play([[880, 0, 0.05]]); },
  win() { this.play([[523, 0, 0.2], [659, 0.15, 0.2], [784, 0.3, 0.2], [1047, 0.45, 0.5]]); },
};
