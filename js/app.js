// Math Quest: starts the app and handles the keyboard.

import { sounds } from './effects.js';
import { state } from './state.js';
import { app } from './ui.js';
import { session, nextQuestion, pressKey } from './play.js';
import { speed, speedKey } from './speedround.js';
import { renderHome } from './home.js';

sounds.enabled = state.sound;

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

// Offline support on the hosted (https) site. On http://localhost the browser just loads files.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
