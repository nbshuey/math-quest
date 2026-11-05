// Read-aloud using the browser's built-in voices (Web Speech API).

const FRACTION_WORDS = {
  2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['fourth', 'fourths'], 5: ['fifth', 'fifths'],
  6: ['sixth', 'sixths'], 7: ['seventh', 'sevenths'], 8: ['eighth', 'eighths'], 9: ['ninth', 'ninths'],
  10: ['tenth', 'tenths'], 12: ['twelfth', 'twelfths'], 100: ['hundredth', 'hundredths'],
};

function fractionWords(n, d) {
  if (n === '?' || d === '?') return `${n === '?' ? 'blank' : n} over ${d === '?' ? 'blank' : d}`;
  const words = FRACTION_WORDS[d];
  return words ? `${n} ${Number(n) === 1 ? words[0] : words[1]}` : `${n} over ${d}`;
}

// Turn math symbols into words, so "3/8 = ?/16" is read as "3 eighths equals blank over 16".
export function toSpeech(text) {
  return String(text)
    .replace(/\p{Extended_Pictographic}|️/gu, '')
    .replace(/(\d+|\?)\/(\d+|\?)/g, (_, n, d) => fractionWords(n, d))
    .replace(/=\s*\?/g, 'equals what?')
    .replace(/(\d)\s*R(\d)/g, '$1 remainder $2')
    .replace(/×/g, ' times ')
    .replace(/÷/g, ' divided by ')
    .replace(/−/g, ' minus ')
    .replace(/\+/g, ' plus ')
    .replace(/=/g, ' equals ')
    .replace(/</g, ' is less than ')
    .replace(/>/g, ' is greater than ')
    .replace(/__/g, ' blank ')
    .replace(/(^|\s)\?(?=\s|$|\.)/g, '$1blank')
    .replace(/¢/g, ' cents')
    .replace(/°/g, ' degrees')
    .replace(/✕/g, ' X ')
    .replace(/→/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

// How a multiple-choice answer should sound.
export function choiceWords(choice) {
  return { '<': 'less than', '>': 'greater than', '=': 'equal to' }[choice] ?? choice;
}

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
let voice;

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => /en-US/i.test(v.lang) && /Samantha|Google US English|Aria|Jenny|Ava/i.test(v.name)) ||
    voices.find((v) => /^en/i.test(v.lang))
  );
}

export function speak(text) {
  if (!canSpeak || !text) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(toSpeech(text));
  voice ??= pickVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = 'en-US';
  utterance.rate = 0.9; // a little slower than normal
  speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (canSpeak) speechSynthesis.cancel();
}
