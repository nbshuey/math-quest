// Problem generators, grouped by grade.
//
// Each generator takes a difficulty level (1 = Easy, 2 = Medium, 3 = Hard)
// and returns:
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

export const LEVELS = [
  { id: 1, name: 'Easy', emoji: '🌱' },
  { id: 2, name: 'Medium', emoji: '⭐' },
  { id: 3, name: 'Hard', emoji: '🔥' },
];

const NAMES = ['Milo', 'Ava', 'Leo', 'Zoe', 'Sam', 'Ruby', 'Max', 'Ivy'];
const ITEMS = ['stickers', 'marbles', 'seashells', 'cookies', 'toy cars', 'crayons', 'stamps', 'gems'];
const SIGNS = ['<', '=', '>'];

const box = '<span class="box">?</span>';
const frac = (n, d) => `<span class="frac"><span>${n}</span><span>${d}</span></span>`;
const bar = (n, d) =>
  `<div class="bar" style="--d:${d}">${Array.from({ length: d }, (_, i) => `<span class="${i < n ? 'on' : ''}"></span>`).join('')}</div>`;

/* ---------------------------- Grade 2 ---------------------------- */

function addition(level) {
  let a, b;
  if (level === 1) { a = rand(1, 12); b = rand(1, 20 - a); }
  else if (level === 2) { a = rand(10, 80); b = rand(5, 99 - a); }
  else { a = rand(100, 800); b = rand(25, 999 - a); }
  const ones = (a % 10) + (b % 10);
  const hint = level === 1
    ? `Start at ${Math.max(a, b)} and count up ${Math.min(a, b)} more.`
    : `Add the ones first (${a % 10} + ${b % 10}).${ones >= 10 ? ' That makes a new ten, so carry it!' : ''} Then the tens${level === 3 ? ', then the hundreds' : ''}.`;
  if (Math.random() < 0.3) {
    const item = pick(ITEMS);
    return { prompt: `${pick(NAMES)} has ${a} ${item} and gets ${b} more. How many ${item} now?`, answer: String(a + b), hint, word: true };
  }
  return { prompt: `${a} + ${b} = ?`, answer: String(a + b), hint };
}

function subtraction(level) {
  let a, b;
  if (level === 1) { a = rand(5, 20); b = rand(1, a - 1); }
  else if (level === 2) { a = rand(20, 99); b = rand(5, a - 5); }
  else { a = rand(200, 999); b = rand(50, a - 50); }
  let hint;
  if (level === 1) hint = `Think addition: ${b} + ? = ${a}`;
  else if (a % 10 < b % 10) hint = `You can't take ${b % 10} from ${a % 10}, so borrow a ten: now you have ${(a % 10) + 10} ones.`;
  else hint = `Subtract the ones first (${a % 10} − ${b % 10}), then the tens${level === 3 ? ', then the hundreds' : ''}.`;
  if (Math.random() < 0.3) {
    const item = pick(ITEMS);
    return { prompt: `${pick(NAMES)} had ${a} ${item} and gave away ${b}. How many are left?`, answer: String(a - b), hint, word: true };
  }
  return { prompt: `${a} − ${b} = ?`, answer: String(a - b), hint };
}

function placeValue2(level) {
  if (level === 1) {
    const [t, o] = distinctDigits(2);
    const [name, d] = pick([['tens', t], ['ones', o]]);
    return { prompt: `What digit is in the ${name} place of ${t * 10 + o}?`, answer: String(d), hint: 'The left digit is the tens. The right digit is the ones.' };
  }
  if (level === 3) {
    const [h, t, o] = [rand(1, 9), rand(0, 9), rand(0, 9)];
    const parts = shuffle([`${h} hundreds`, `${t} tens`, `${o} ones`]);
    return {
      prompt: `What number has ${parts.join(', ')}?`,
      answer: String(h * 100 + t * 10 + o),
      hint: 'Write the hundreds first, then tens, then ones. Use 0 for an empty place!',
      word: true,
    };
  }
  const [h, t, o] = distinctDigits(3);
  const n = h * 100 + t * 10 + o;
  const places = [['hundreds', h, 100], ['tens', t, 10], ['ones', o, 1]];
  if (Math.random() < 0.5) {
    const [name, d] = pick(places);
    return { prompt: `What digit is in the ${name} place of ${n}?`, answer: String(d), hint: 'Read the places from left to right: hundreds, tens, ones.' };
  }
  const [, d, mult] = pick(places.filter(([, digit]) => digit !== 0));
  return {
    prompt: `What is the value of the ${d} in ${n}?`,
    answer: String(d * mult),
    choices: shuffle([d, d * 10, d * 100]).map(String),
    hint: `Find which place the ${d} is in. A 3 in the tens place is worth 30!`,
  };
}

function skipCount(level) {
  let step, start;
  if (level === 1) { step = pick([2, 5, 10]); start = step * rand(0, 5); }
  else if (level === 2) {
    step = pick([2, 5, 10, 100]);
    start = step === 100 ? rand(1, 5) * 100 : step === 10 ? rand(1, 50) : step * rand(0, 15);
  } else { step = pick([3, 4, 25, 50, 100]); start = step * rand(1, 10); }
  let seq = Array.from({ length: 5 }, (_, i) => start + i * step);
  const down = level === 3 && Math.random() < 0.5;
  if (down) seq = seq.reverse();
  const missing = rand(1, 4);
  return {
    prompt: seq.map((v, i) => (i === missing ? '__' : v)).join(', '),
    answer: String(seq[missing]),
    hint: `Each number goes ${down ? 'down' : 'up'} by ${step}.`,
  };
}

function compare2(level) {
  const [min, max] = level === 1 ? [10, 99] : [100, 999];
  const a = rand(min, max);
  let b;
  const r = Math.random();
  if (r < 0.15) b = a;
  else if (level === 3 || r < 0.55) b = a + pick(level === 3 ? [-20, -2, -1, 1, 2, 20] : [-100, -10, -1, 1, 10, 100]);
  else b = rand(min, max);
  if (b < min || b > max) b = a - (b - a);
  return {
    prompt: 'Which sign goes in the box?',
    visual: `<div class="eq">${a} ${box} ${b}</div>`,
    summary: `${a} ? ${b}`,
    answer: a > b ? '>' : a < b ? '<' : '=',
    choices: SIGNS,
    hint: `Compare the ${level === 1 ? 'tens first, then the ones' : 'hundreds first, then tens, then ones'}. The alligator mouth eats the bigger number!`,
  };
}

const MONEY = {
  dollar: { cls: 'bill', label: '$1', value: 100, one: 'dollar bill', many: 'dollar bills' },
  q: { cls: 'coin coin-q', label: '25¢', value: 25, one: 'quarter', many: 'quarters' },
  d: { cls: 'coin coin-d', label: '10¢', value: 10, one: 'dime', many: 'dimes' },
  n: { cls: 'coin coin-n', label: '5¢', value: 5, one: 'nickel', many: 'nickels' },
  p: { cls: 'coin coin-p', label: '1¢', value: 1, one: 'penny', many: 'pennies' },
};

function money(level) {
  // [kind, max count] for each level, plus the allowed total range.
  const setup = {
    1: { kinds: [['d', 4], ['p', 7]], range: [1, 50] },
    2: { kinds: [['q', 3], ['d', 4], ['n', 3], ['p', 5]], range: [1, 100] },
    3: { kinds: [['dollar', 1], ['q', 4], ['d', 4], ['n', 2], ['p', 4]], range: [101, 200] },
  }[level];
  let counts, total;
  do {
    counts = setup.kinds.map(([kind, max]) => [kind, rand(0, max)]);
    total = counts.reduce((sum, [kind, c]) => sum + c * MONEY[kind].value, 0);
  } while (total < setup.range[0] || total > setup.range[1]);
  const visual = counts
    .flatMap(([kind, c]) => Array(c).fill(`<span class="${MONEY[kind].cls}">${MONEY[kind].label}</span>`))
    .join('');
  const summary = counts
    .filter(([, c]) => c)
    .map(([kind, c]) => `${c} ${c > 1 ? MONEY[kind].many : MONEY[kind].one}`)
    .join(', ');
  return {
    prompt: 'How many cents is this money worth?',
    visual: `<div class="coins-row">${visual}</div>`,
    summary,
    answer: String(total),
    hint: `Start with the biggest and count on: ${level === 3 ? 'a dollar is 100¢, ' : ''}quarters 25¢, dimes 10¢, nickels 5¢, pennies 1¢.`,
  };
}

/* ---------------------------- Grade 4 ---------------------------- */

function multFacts(level) {
  let a, b;
  if (level === 1) { a = pick([2, 3, 4, 5, 10]); b = rand(1, 10); }
  else if (level === 2) { a = rand(2, 10); b = rand(2, 10); }
  else { a = rand(6, 12); b = rand(6, 12); }
  if (Math.random() < 0.5) [a, b] = [b, a];
  let hint = `${a} × ${b} means ${a} groups of ${b}. Try skip counting by ${b}!`;
  if (a === 9 || b === 9) hint = `9s trick: 10 × ${a === 9 ? b : a} = ${(a === 9 ? b : a) * 10}, then take away one ${a === 9 ? b : a}.`;
  return { prompt: `${a} × ${b} = ?`, answer: String(a * b), hint };
}

function multBig(level) {
  const oneDigit = level === 1 || Math.random() < 0.6;
  let a, b, parts;
  if (oneDigit) {
    a = level === 1 ? rand(12, 99) : level === 2 ? rand(100, 999) : rand(1000, 9999);
    b = rand(2, 9);
    const digits = String(a).split('');
    parts = digits
      .map((d, i) => Number(d) * 10 ** (digits.length - 1 - i))
      .filter(Boolean)
      .map((p) => `${fmt(p)} × ${b}`);
  } else {
    a = level === 2 ? rand(11, 30) : rand(21, 99);
    b = level === 2 ? rand(11, 19) : rand(21, 99);
    parts = [`${a} × ${b - (b % 10)}`, b % 10 ? `${a} × ${b % 10}` : ''].filter(Boolean);
  }
  return { prompt: `${fmt(a)} × ${b} = ?`, answer: String(a * b), hint: `Break it apart: ${parts.join(' + ')}` };
}

function division(level) {
  let d, q, r;
  if (level === 1) { d = rand(2, 10); q = rand(1, 10); r = 0; }
  else if (level === 2) { d = rand(2, 9); q = rand(3, 30); r = Math.random() < 0.5 ? rand(1, d - 1) : 0; }
  else { d = rand(3, 9); q = rand(12, 150); r = Math.random() < 0.6 ? rand(1, d - 1) : 0; }
  const n = d * q + r;
  if (!r) return { prompt: `${fmt(n)} ÷ ${d} = ?`, answer: String(q), hint: `Think backwards: ${d} × ? = ${fmt(n)}` };
  const label = (qq, rr) => `${qq} R${rr}`;
  const options = new Set([label(q, r), label(q + 1, r), label(q - 1, r), label(q, r === d - 1 ? r - 1 : r + 1)]);
  return {
    prompt: `${fmt(n)} ÷ ${d} = ?`,
    answer: label(q, r),
    choices: shuffle([...options]),
    hint: `Find the biggest number that times ${d} is ${fmt(n)} or less. What's left over is the remainder (R).`,
  };
}

const EASY_FRACTIONS = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4]];
const BASE_FRACTIONS = [...EASY_FRACTIONS, [1, 5], [2, 5], [3, 5], [1, 6], [5, 6], [3, 8], [5, 8]];
const HARD_FRACTIONS = [...BASE_FRACTIONS, [2, 7], [3, 10], [7, 10], [4, 9], [5, 12], [7, 12]];

function equivFractions(level) {
  const [n, d] = pick([EASY_FRACTIONS, BASE_FRACTIONS, HARD_FRACTIONS][level - 1]);
  const k = level === 1 ? rand(2, 3) : level === 2 ? rand(2, 5) : rand(3, 8);
  const missingTop = level === 1 || Math.random() < 0.6;
  // On Hard, half the questions go the other way: simplify the big fraction.
  const simplify = level === 3 && Math.random() < 0.5;
  const [left, right] = simplify ? [[n * k, d * k], [n, d]] : [[n, d], [n * k, d * k]];
  const shown = missingTop ? frac(box, right[1]) : frac(right[0], box);
  const verb = simplify ? 'divided' : 'multiplied';
  const known = missingTop ? [left[1], right[1]] : [left[0], right[0]];
  return {
    prompt: 'Fill in the missing number.',
    visual: `<div class="eq">${frac(...left)} = ${shown}</div>`,
    summary: `${left[0]}/${left[1]} = ${missingTop ? `?/${right[1]}` : `${right[0]}/?`}`,
    answer: String(missingTop ? right[0] : right[1]),
    hint: `What was ${known[0]} ${verb} by to make ${known[1]}? Do the same to the ${missingTop ? 'top' : 'bottom'}!`,
  };
}

function compareFractions(level) {
  const dens = level === 3 ? [3, 4, 5, 6, 7, 8, 9, 10, 12] : [2, 3, 4, 5, 6, 8, 10, 12];
  const b = pick(dens);
  const a = rand(1, b - 1);
  let c, d;
  if (level === 1) {
    // Same bottom or same top number.
    const sameTopDens = dens.filter((x) => x !== b && x > a);
    if (b > 2 && (Math.random() < 0.5 || !sameTopDens.length)) {
      d = b;
      do c = rand(1, b - 1); while (c === a);
    } else {
      c = a;
      d = pick(sameTopDens);
    }
  } else if (Math.random() < 0.2) {
    const k = pick([2, 3]);
    [c, d] = [a * k, b * k];
  } else {
    do {
      d = pick(dens);
      c = rand(1, d - 1);
    } while (a * d === c * b);
  }
  const bars = level < 3 ? `<div class="bars">${bar(a, b)}${bar(c, d)}</div>` : '';
  return {
    prompt: 'Which sign goes in the box?',
    visual: `<div class="eq">${frac(a, b)} ${box} ${frac(c, d)}</div>${bars}`,
    summary: `${a}/${b} ? ${c}/${d}`,
    answer: a * d > c * b ? '>' : a * d < c * b ? '<' : '=',
    choices: SIGNS,
    hint: level === 1
      ? 'Same bottom? Bigger top wins. Same top? Smaller bottom means bigger pieces!'
      : level === 2
        ? 'Look at how much of each bar is colored. You can also compare each fraction to 1/2.'
        : 'Make the bottoms the same, or compare each fraction to 1/2.',
  };
}

const PLACE_NAMES = {
  10: ['ten', 'ones'],
  100: ['hundred', 'tens'],
  1000: ['thousand', 'hundreds'],
  10000: ['ten thousand', 'thousands'],
  100000: ['hundred thousand', 'ten-thousands'],
};

function rounding(level) {
  let n, place;
  if (level === 1) { n = rand(11, 999); place = n >= 100 && Math.random() < 0.5 ? 100 : 10; }
  else if (level === 2) { n = rand(1000, 99999); place = pick([10, 100, 1000]); }
  else { n = rand(100000, 999999); place = pick([1000, 10000, 100000]); }
  if (n % place === 0) n += rand(1, place - 1);
  const [name, rightName] = PLACE_NAMES[place];
  const rightDigit = Math.floor(n / (place / 10)) % 10;
  return {
    prompt: `Round ${fmt(n)} to the nearest ${name}.`,
    answer: String(Math.round(n / place) * place),
    hint: `Look at the ${rightName} digit: it's ${rightDigit}. 5 or more → round up. 4 or less → round down.`,
  };
}

function placeValue4(level) {
  const size = [4, 6, 7][level - 1];
  const digits = distinctDigits(size);
  const n = Number(digits.join(''));
  const positions = digits.map((d, i) => [d, size - 1 - i]).filter(([d]) => d !== 0);
  const [d, power] = pick(positions);
  const otherPowers = shuffle([...Array(size).keys()].filter((p) => p !== power)).slice(0, 3);
  return {
    prompt: `What is the value of the ${d} in ${fmt(n)}?`,
    answer: fmt(d * 10 ** power),
    choices: shuffle([power, ...otherPowers]).map((p) => fmt(d * 10 ** p)),
    hint: `From the right: ones, tens, hundreds, thousands${size > 4 ? ', ten-thousands, hundred-thousands' : ''}${size > 6 ? ', millions' : ''}.`,
  };
}

/* ---------------------------- Topics ---------------------------- */

function withMixed(topics) {
  return [
    ...topics,
    { id: 'mixed', name: 'Mixed Challenge', emoji: '🎲', desc: 'A little bit of everything!', gen: (level) => pick(topics).gen(level) },
  ];
}

export const TOPICS = {
  2: withMixed([
    { id: 'add100', name: 'Addition', emoji: '➕', desc: 'Add numbers together', gen: addition },
    { id: 'sub100', name: 'Subtraction', emoji: '➖', desc: 'Take away', gen: subtraction },
    { id: 'place2', name: 'Place Value', emoji: '🏠', desc: 'Hundreds, tens & ones', gen: placeValue2 },
    { id: 'skip', name: 'Skip Counting', emoji: '🐸', desc: 'Count by 2s, 5s, 10s & more', gen: skipCount },
    { id: 'compare2', name: 'Compare Numbers', emoji: '🐊', desc: 'Greater than, less than', gen: compare2 },
    { id: 'money', name: 'Money', emoji: '🪙', desc: 'Count the coins', gen: money },
  ]),
  4: withMixed([
    { id: 'multfacts', name: 'Times Tables', emoji: '✖️', desc: 'Facts up to 12 × 12', gen: multFacts },
    { id: 'multbig', name: 'Big Multiplication', emoji: '🏗️', desc: 'Multi-digit multiplying', gen: multBig },
    { id: 'division', name: 'Division', emoji: '➗', desc: 'With and without remainders', gen: division },
    { id: 'equivfrac', name: 'Equal Fractions', emoji: '🍕', desc: 'Find equivalent fractions', gen: equivFractions },
    { id: 'comparefrac', name: 'Compare Fractions', emoji: '⚖️', desc: 'Which fraction is bigger?', gen: compareFractions },
    { id: 'rounding', name: 'Rounding', emoji: '🎯', desc: 'Round to the nearest place', gen: rounding },
    { id: 'place4', name: 'Place Value', emoji: '🏰', desc: 'Big numbers, digit by digit', gen: placeValue4 },
  ]),
};

export const GRADES = Object.keys(TOPICS).map(Number);
