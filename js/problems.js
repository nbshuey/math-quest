// Problem generators, grouped by grade.
//
// Every generator returns:
//   prompt   – the question text
//   answer   – the correct answer as a string
//   choices  – (optional) answers to pick from; without it the kid types a number
//   visual   – (optional) HTML shown under the prompt (coins, fractions, bars)
//   summary  – (optional) short text version of the question for the review list
//   hint     – a nudge shown after a wrong try or when "Hint" is tapped
//   word     – (optional) true for word problems (smaller font)

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const fmt = (n) => n.toLocaleString('en-US');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Up to `count` distinct digits; the first is never 0.
function distinctDigits(count) {
  const pool = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  if (pool[0] === 0) pool.push(pool.shift());
  return pool.slice(0, count);
}

const NAMES = ['Milo', 'Ava', 'Leo', 'Zoe', 'Sam', 'Ruby', 'Max', 'Ivy'];
const ITEMS = ['stickers', 'marbles', 'seashells', 'cookies', 'toy cars', 'crayons', 'stamps'];
const SIGNS = ['<', '=', '>'];

const box = '<span class="box">?</span>';
const frac = (n, d) => `<span class="frac"><span>${n}</span><span>${d}</span></span>`;
const bar = (n, d) =>
  `<div class="bar" style="--d:${d}">${Array.from({ length: d }, (_, i) => `<span class="${i < n ? 'on' : ''}"></span>`).join('')}</div>`;

/* ---------------------------- Grade 2 ---------------------------- */

function add100() {
  const a = rand(10, 80);
  const b = rand(5, 99 - a);
  const ones = (a % 10) + (b % 10);
  const hint = `Add the ones first (${a % 10} + ${b % 10}).${ones >= 10 ? ' That makes a new ten, so carry it!' : ''} Then add the tens.`;
  if (Math.random() < 0.3) {
    const item = pick(ITEMS);
    return { prompt: `${pick(NAMES)} has ${a} ${item} and gets ${b} more. How many ${item} now?`, answer: String(a + b), hint, word: true };
  }
  return { prompt: `${a} + ${b} = ?`, answer: String(a + b), hint };
}

function sub100() {
  const a = rand(20, 99);
  const b = rand(5, a - 5);
  const hint = a % 10 < b % 10
    ? `You can't take ${b % 10} from ${a % 10}, so borrow a ten: now you have ${(a % 10) + 10} ones.`
    : `Subtract the ones first (${a % 10} − ${b % 10}), then the tens.`;
  if (Math.random() < 0.3) {
    const item = pick(ITEMS);
    return { prompt: `${pick(NAMES)} had ${a} ${item} and gave away ${b}. How many are left?`, answer: String(a - b), hint, word: true };
  }
  return { prompt: `${a} − ${b} = ?`, answer: String(a - b), hint };
}

function placeValue2() {
  const [h, t, o] = distinctDigits(3);
  const n = h * 100 + t * 10 + o;
  const places = [['hundreds', h, 100], ['tens', t, 10], ['ones', o, 1]];
  const hint = 'Read the places from left to right: hundreds, tens, ones.';
  if (Math.random() < 0.5) {
    const [name, d] = pick(places);
    return { prompt: `What digit is in the ${name} place of ${n}?`, answer: String(d), hint };
  }
  const [, d, mult] = pick(places.filter(([, digit]) => digit !== 0));
  return {
    prompt: `What is the value of the ${d} in ${n}?`,
    answer: String(d * mult),
    choices: shuffle([d, d * 10, d * 100]).map(String),
    hint: `Find which place the ${d} is in. A 3 in the tens place is worth 30!`,
  };
}

function skipCount() {
  const step = pick([2, 5, 10, 100]);
  const start = step === 100 ? rand(1, 5) * 100 : step === 10 ? rand(1, 50) : step * rand(0, 15);
  const seq = Array.from({ length: 5 }, (_, i) => start + i * step);
  const missing = rand(1, 4);
  return {
    prompt: seq.map((v, i) => (i === missing ? '__' : v)).join(', '),
    answer: String(seq[missing]),
    hint: `Each number goes up by ${step}.`,
  };
}

function compare2() {
  const a = rand(100, 999);
  let b;
  const r = Math.random();
  if (r < 0.15) b = a;
  else if (r < 0.55) b = a + pick([-100, -10, -1, 1, 10, 100]);
  else b = rand(100, 999);
  if (b < 100 || b > 999) b = rand(100, 999);
  return {
    prompt: 'Which sign goes in the box?',
    visual: `<div class="eq">${a} ${box} ${b}</div>`,
    summary: `${a} ? ${b}`,
    answer: a > b ? '>' : a < b ? '<' : '=',
    choices: SIGNS,
    hint: 'Compare the hundreds first, then tens, then ones. The alligator mouth eats the bigger number!',
  };
}

function money() {
  const coins = [['q', 25, 'quarter', 'quarters'], ['d', 10, 'dime', 'dimes'], ['n', 5, 'nickel', 'nickels'], ['p', 1, 'penny', 'pennies']];
  let counts, total;
  do {
    counts = [rand(0, 3), rand(0, 4), rand(0, 3), rand(0, 5)];
    total = counts.reduce((sum, c, i) => sum + c * coins[i][1], 0);
  } while (total === 0 || total > 100);
  const visual = counts
    .flatMap((c, i) => Array(c).fill(`<span class="coin coin-${coins[i][0]}">${coins[i][1]}¢</span>`))
    .join('');
  const summary = counts.map((c, i) => (c ? `${c} ${coins[i][c > 1 ? 3 : 2]}` : '')).filter(Boolean).join(', ');
  return {
    prompt: 'How many cents are these coins worth?',
    visual: `<div class="coins-row">${visual}</div>`,
    summary,
    answer: String(total),
    hint: 'Start with the biggest coins and count on: quarters 25¢, dimes 10¢, nickels 5¢, pennies 1¢.',
  };
}

/* ---------------------------- Grade 4 ---------------------------- */

function multFacts() {
  const a = rand(2, 12);
  const b = rand(2, 12);
  return { prompt: `${a} × ${b} = ?`, answer: String(a * b), hint: `${a} × ${b} means ${a} groups of ${b}. Try skip counting by ${b}!` };
}

function multBig() {
  let a, b, parts;
  if (Math.random() < 0.6) {
    a = pick([rand(12, 99), rand(100, 999), rand(1000, 4999)]);
    b = rand(2, 9);
    const digits = String(a).split('');
    parts = digits
      .map((d, i) => Number(d) * 10 ** (digits.length - 1 - i))
      .filter(Boolean)
      .map((p) => `${fmt(p)} × ${b}`);
  } else {
    a = rand(11, 49);
    b = rand(11, 29);
    parts = [`${a} × ${b - (b % 10)}`, b % 10 ? `${a} × ${b % 10}` : ''].filter(Boolean);
  }
  return { prompt: `${fmt(a)} × ${b} = ?`, answer: String(a * b), hint: `Break it apart: ${parts.join(' + ')}` };
}

function division() {
  const d = rand(2, 9);
  const q = rand(3, 30);
  const r = Math.random() < 0.5 ? rand(1, d - 1) : 0;
  const n = d * q + r;
  if (!r) return { prompt: `${n} ÷ ${d} = ?`, answer: String(q), hint: `Think backwards: ${d} × ? = ${n}` };
  const label = (qq, rr) => `${qq} R${rr}`;
  const options = new Set([label(q, r), label(q + 1, r), label(q - 1, r), label(q, r === d - 1 ? r - 1 : r + 1)]);
  return {
    prompt: `${n} ÷ ${d} = ?`,
    answer: label(q, r),
    choices: shuffle([...options]),
    hint: `Find the biggest number that times ${d} is ${n} or less. What's left over is the remainder (R).`,
  };
}

const BASE_FRACTIONS = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [1, 6], [5, 6], [3, 8], [5, 8]];

function equivFractions() {
  const [n, d] = pick(BASE_FRACTIONS);
  const k = rand(2, 5);
  if (Math.random() < 0.6) {
    return {
      prompt: 'Fill in the missing number.',
      visual: `<div class="eq">${frac(n, d)} = ${frac(box, d * k)}</div>`,
      summary: `${n}/${d} = ?/${d * k}`,
      answer: String(n * k),
      hint: `What was ${d} multiplied by to make ${d * k}? Multiply the top by the same number!`,
    };
  }
  return {
    prompt: 'Fill in the missing number.',
    visual: `<div class="eq">${frac(n, d)} = ${frac(n * k, box)}</div>`,
    summary: `${n}/${d} = ${n * k}/?`,
    answer: String(d * k),
    hint: `What was ${n} multiplied by to make ${n * k}? Multiply the bottom by the same number!`,
  };
}

function compareFractions() {
  const dens = [2, 3, 4, 5, 6, 8, 10, 12];
  const b = pick(dens);
  const a = rand(1, b - 1);
  let c, d;
  if (Math.random() < 0.2) {
    const k = pick([2, 3]);
    [c, d] = [a * k, b * k];
  } else {
    do {
      d = pick(dens);
      c = rand(1, d - 1);
    } while (a * d === c * b);
  }
  return {
    prompt: 'Which sign goes in the box?',
    visual: `<div class="eq">${frac(a, b)} ${box} ${frac(c, d)}</div><div class="bars">${bar(a, b)}${bar(c, d)}</div>`,
    summary: `${a}/${b} ? ${c}/${d}`,
    answer: a * d > c * b ? '>' : a * d < c * b ? '<' : '=',
    choices: SIGNS,
    hint: 'Look at how much of each bar is colored. You can also compare each fraction to 1/2.',
  };
}

function rounding() {
  const place = pick([10, 100, 1000]);
  let n = rand(1000, 99999);
  if (n % place === 0) n += rand(1, place - 1);
  const names = { 10: ['ten', 'ones'], 100: ['hundred', 'tens'], 1000: ['thousand', 'hundreds'] };
  const [name, rightName] = names[place];
  const rightDigit = Math.floor(n / (place / 10)) % 10;
  return {
    prompt: `Round ${fmt(n)} to the nearest ${name}.`,
    answer: String(Math.round(n / place) * place),
    hint: `Look at the ${rightName} digit: it's ${rightDigit}. 5 or more → round up. 4 or less → round down.`,
  };
}

function placeValue4() {
  const digits = distinctDigits(6);
  const n = Number(digits.join(''));
  const positions = digits.map((d, i) => [d, 5 - i]).filter(([d]) => d !== 0);
  const [d, power] = pick(positions);
  const otherPowers = shuffle([0, 1, 2, 3, 4, 5].filter((p) => p !== power)).slice(0, 3);
  return {
    prompt: `What is the value of the ${d} in ${fmt(n)}?`,
    answer: fmt(d * 10 ** power),
    choices: shuffle([power, ...otherPowers]).map((p) => fmt(d * 10 ** p)),
    hint: 'From the right: ones, tens, hundreds, thousands, ten-thousands, hundred-thousands.',
  };
}

/* ---------------------------- Topics ---------------------------- */

function withMixed(topics) {
  return [
    ...topics,
    { id: 'mixed', name: 'Mixed Challenge', emoji: '🎲', desc: 'A little bit of everything!', gen: () => pick(topics).gen() },
  ];
}

export const TOPICS = {
  2: withMixed([
    { id: 'add100', name: 'Addition', emoji: '➕', desc: 'Add numbers up to 100', gen: add100 },
    { id: 'sub100', name: 'Subtraction', emoji: '➖', desc: 'Take away within 100', gen: sub100 },
    { id: 'place2', name: 'Place Value', emoji: '🏠', desc: 'Hundreds, tens & ones', gen: placeValue2 },
    { id: 'skip', name: 'Skip Counting', emoji: '🐸', desc: 'Count by 2s, 5s, 10s, 100s', gen: skipCount },
    { id: 'compare2', name: 'Compare Numbers', emoji: '🐊', desc: 'Greater than, less than', gen: compare2 },
    { id: 'money', name: 'Money', emoji: '🪙', desc: 'Count the coins', gen: money },
  ]),
  4: withMixed([
    { id: 'multfacts', name: 'Times Tables', emoji: '✖️', desc: 'Facts up to 12 × 12', gen: multFacts },
    { id: 'multbig', name: 'Big Multiplication', emoji: '🏗️', desc: 'Multi-digit multiplying', gen: multBig },
    { id: 'division', name: 'Division', emoji: '➗', desc: 'With and without remainders', gen: division },
    { id: 'equivfrac', name: 'Equal Fractions', emoji: '🍕', desc: 'Find equivalent fractions', gen: equivFractions },
    { id: 'comparefrac', name: 'Compare Fractions', emoji: '⚖️', desc: 'Which fraction is bigger?', gen: compareFractions },
    { id: 'rounding', name: 'Rounding', emoji: '🎯', desc: 'Nearest 10, 100, or 1,000', gen: rounding },
    { id: 'place4', name: 'Place Value', emoji: '🏰', desc: 'Up to hundred-thousands', gen: placeValue4 },
  ]),
};

export const GRADES = Object.keys(TOPICS).map(Number);
