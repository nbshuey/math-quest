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
//   why      – a "How do you know?" follow-up: { right, wrong: [two wrong ideas], visual? }
//   mistake  – (optional) a believable wrong answer, used by "Fix the Mistake"

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const fmt = (n) => n.toLocaleString('en-US');
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

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

// Combine two numbers place by place without carrying or borrowing
// (how kids get these wrong), e.g. byPlace(47, 38, add) → 75.
function byPlace(a, b, fn) {
  let result = 0;
  let place = 1;
  while (a > 0 || b > 0) {
    result += (fn(a % 10, b % 10) % 10) * place;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
    place *= 10;
  }
  return result;
}

function needsBorrow(a, b) {
  for (; b > 0; a = Math.floor(a / 10), b = Math.floor(b / 10)) if (a % 10 < b % 10) return true;
  return false;
}

// The non-zero place values of a number: 347 → [300, 40, 7].
const placeParts = (n) => {
  const digits = String(n).split('');
  return digits.map((d, i) => Number(d) * 10 ** (digits.length - 1 - i)).filter(Boolean);
};

export const LEVELS = [
  { id: 1, name: 'Easy', emoji: '🌱' },
  { id: 2, name: 'Medium', emoji: '⭐' },
  { id: 3, name: 'Hard', emoji: '🔥' },
];

const NAMES = ['Milo', 'Ava', 'Leo', 'Zoe', 'Sam', 'Ruby', 'Max', 'Ivy'];
const ITEMS = ['stickers', 'marbles', 'seashells', 'cookies', 'toy cars', 'crayons', 'stamps', 'gems'];
const SIGNS = ['<', '=', '>'];
const PLACE_WORDS = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'hundred-thousands', 'millions'];

/* --------------------------- Pictures --------------------------- */

const box = '<span class="box">?</span>';
const frac = (n, d) => `<span class="frac"><span>${n}</span><span>${d}</span></span>`;
const bar = (n, d) =>
  `<div class="bar" style="--d:${d}">${Array.from({ length: d }, (_, i) => `<span class="${i < n ? 'on' : ''}"></span>`).join('')}</div>`;

// Area model: a rectangle split into the place-value parts of one factor.
const areaModel = (parts, side) => `
  <div class="area">
    <span class="area-side">${fmt(side)}</span>
    ${parts.map((p) => `<div class="area-cell" style="flex:${String(p).length}"><span class="area-top">${fmt(p)}</span><span class="area-val">${fmt(p * side)}</span></div>`).join('')}
  </div>`;

// Number line from low to high with n marked, for rounding.
const numberLine = (low, high, n) => `
  <div class="nline">
    <div class="nline-track">
      <span class="nline-mid"></span>
      <span class="nline-dot" style="left:${((n - low) / (high - low)) * 100}%"><b>${fmt(n)}</b></span>
    </div>
    <div class="nline-labels"><span>${fmt(low)}</span><span>${fmt((low + high) / 2)}</span><span>${fmt(high)}</span></div>
  </div>`;

const why = (right, wrong, visual) => ({ right, wrong, visual });
const cap = (text) => text[0].toUpperCase() + text.slice(1);
const aOrAn = (word) => `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`;

/* ----------------------- Step-by-step hints -----------------------
   Each question can carry `steps`: short hints shown one at a time.
   The last step always leaves the final bit of work for the kid. */

const PLACES = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'hundred-thousands'];
const digitsOf = (n) => String(n).split('').reverse().map(Number); // ones first

// Column adding or subtracting, one place at a time. Works the first two
// places, then leaves the rest (and putting the digits together) to the kid.
function columnSteps(a, b, add) {
  const top = digitsOf(a);
  const bottom = digitsOf(b);
  const steps = [];
  let carry = 0;
  for (let i = 0; i < top.length; i++) {
    const [x, y] = [top[i], bottom[i] ?? 0];
    const name = cap(PLACES[i]);
    const last = i === top.length - 1 || (i === 2 && top.length > 3);
    if (last && i >= 2 && top.length > 3) {
      steps.push(`Keep going left the same way: ${PLACES.slice(2, top.length).join(', ')}.${add ? ' Remember any carried 1!' : ''}`);
      break;
    }
    if (add) {
      const sum = x + y + carry;
      const shown = `${name}: ${x} + ${y}${carry ? ' + 1 carried' : ''}`;
      if (last) steps.push(`${shown} = ?`);
      else steps.push(`${shown} = ${sum}.${sum >= 10 ? ` Write ${sum % 10} and carry 1 to the ${PLACES[i + 1]}.` : ''}`);
      carry = sum >= 10 ? 1 : 0;
    } else {
      if (last) {
        steps.push(`${name}: ${x} − ${y} = ?`);
        break;
      }
      if (x < y) {
        let j = i + 1;
        while (top[j] === 0) top[j++] = 9;
        top[j]--;
        const from = j === i + 1 ? `the ${PLACES[i + 1]}` : `the ${PLACES[j]} (the zeros in between become 9s)`;
        steps.push(`${name}: ${x} is less than ${y}, so borrow 1 from ${from}. Now ${x + 10} − ${y} = ${x + 10 - y}.`);
      } else steps.push(`${name}: ${x} − ${y} = ${x - y}.`);
    }
  }
  const shorter = String(add ? a + b : a - b).length < top.length;
  steps.push(`Put the digits together, from the left.${shorter ? ' No need to write a 0 at the front.' : ''}`);
  return steps;
}

// A tip for multiplying by a number like 60, 100 or 12.
function timesTip(n, f) {
  const zeros = String(f).match(/0*$/)[0].length;
  if (zeros) return `Tip: do ${n} × ${f / 10 ** zeros}, then put ${zeros} zero${zeros > 1 ? 's' : ''} on the end.`;
  if (f > 10) return `Tip: break it apart. ${n} × 10 + ${n} × ${f - 10}.`;
  return '';
}

const halfOf = (n) => (n % 2 ? `${(n - 1) / 2}½` : String(n / 2));
const multiples = (step, count) => Array.from({ length: count }, (_, i) => step * (i + 1)).join(', ');

/* ---------------------------- Grade 2 ---------------------------- */

function addition(level) {
  let a, b;
  if (level === 1) { a = rand(1, 12); b = rand(1, 20 - a); }
  else if (level === 2) { a = rand(10, 80); b = rand(5, 99 - a); }
  else { a = rand(100, 800); b = rand(25, 999 - a); }
  const sum = a + b;
  const ones = (a % 10) + (b % 10);
  const [big, small] = [Math.max(a, b), Math.min(a, b)];
  const hint = level === 1
    ? `Start at ${big} and count up ${small} more.`
    : `Add the ones first (${a % 10} + ${b % 10}).${ones >= 10 ? ' That makes a new ten, so carry it!' : ''} Then the tens${level === 3 ? ', then the hundreds' : ''}.`;
  const reasoning = level === 1
    ? why(`Start at ${big} and count up ${small}.`, [`Start at ${big} and count down ${small}.`, `Put the numbers side by side: ${a}${b}.`])
    : why(
        `Add the ones, then the tens${level === 3 ? ', then the hundreds' : ''}. Carry when a place makes 10 or more.`,
        [
          `Add all the digits together: ${[...String(a), ...String(b)].join(' + ')}.`,
          ones >= 10 ? 'Add each place, but never carry.' : `Take away instead: ${big} − ${small}.`,
        ],
      );
  const steps = level === 1
    ? [`Start with the bigger number: ${big}. Keep it in your head.`, `Count up ${small} more on your fingers, starting with ${big + 1}.`, 'What number did you stop on?']
    : columnSteps(a, b, true);
  const base = { answer: String(sum), hint, steps, why: reasoning, mistake: ones >= 10 ? byPlace(a, b, (x, y) => x + y) : undefined };
  if (Math.random() < 0.3) {
    const item = pick(ITEMS);
    return {
      ...base,
      prompt: `${pick(NAMES)} has ${a} ${item} and gets ${b} more. How many ${item} now?`,
      steps: [`"Gets more" means add: ${a} + ${b}.`, ...steps],
      word: true,
    };
  }
  return { ...base, prompt: `${a} + ${b} = ?` };
}

function subtraction(level) {
  let a, b;
  if (level === 1) { a = rand(5, 20); b = rand(1, a - 1); }
  else if (level === 2) { a = rand(20, 99); b = rand(5, a - 5); }
  else { a = rand(200, 999); b = rand(50, a - 50); }
  const borrow = needsBorrow(a, b);
  let hint;
  if (level === 1) hint = `Think addition: ${b} + ? = ${a}`;
  else if (a % 10 < b % 10) hint = `You can't take ${b % 10} from ${a % 10}, so borrow a ten: now you have ${(a % 10) + 10} ones.`;
  else hint = `Subtract the ones first (${a % 10} − ${b % 10}), then the tens${level === 3 ? ', then the hundreds' : ''}.`;
  const reasoning = level === 1
    ? why(`${b} + ${a - b} = ${a}, so the answer is ${a - b}.`, [`${a} + ${b} = ${a + b}.`, `Count back just 1 from ${a}.`])
    : why(`Check by adding: ${a - b} + ${b} = ${a}.`, [
        borrow ? 'Take the smaller digit from the bigger digit in each place.' : `Add them: ${a} + ${b} = ${a + b}.`,
        `Take away just the ones: ${a} − ${b % 10} = ${a - (b % 10)}.`,
      ]);
  const steps = level === 1
    ? [`Think addition: ${b} + ? = ${a}.`, `Start at ${b} and count up to ${a} on your fingers.`, 'How many fingers did you count?']
    : columnSteps(a, b, false);
  const base = { answer: String(a - b), hint, steps, why: reasoning, mistake: borrow ? byPlace(a, b, (x, y) => Math.abs(x - y)) : undefined };
  if (Math.random() < 0.3) {
    const item = pick(ITEMS);
    return {
      ...base,
      prompt: `${pick(NAMES)} had ${a} ${item} and gave away ${b}. How many are left?`,
      steps: [`"Gave away" means take away: ${a} − ${b}.`, ...steps],
      word: true,
    };
  }
  return { ...base, prompt: `${a} − ${b} = ?` };
}

function placeValue2(level) {
  if (level === 1) {
    const [t, o] = distinctDigits(2);
    const n = t * 10 + o;
    const [name, d] = pick([['tens', t], ['ones', o]]);
    return {
      prompt: `What digit is in the ${name} place of ${n}?`,
      answer: String(d),
      hint: 'The left digit is the tens. The right digit is the ones.',
      steps: [`Look at ${n}. It has 2 digits.`, 'The left digit is the tens. The right digit is the ones.', `Point to the ${name} place. What digit is there?`],
      why: why(`${n} is ${t} tens and ${o} ones.`, [`${n} is ${o} tens and ${t} ones.`, `${n} is ${t + o} ones.`]),
      mistake: name === 'tens' ? o : t,
    };
  }
  if (level === 3) {
    const [h, t, o] = [rand(1, 9), rand(0, 9), rand(0, 9)];
    const n = h * 100 + t * 10 + o;
    const parts = shuffle([`${h} hundreds`, `${t} tens`, `${o} ones`]);
    return {
      prompt: `What number has ${parts.join(', ')}?`,
      answer: String(n),
      hint: 'Write the hundreds first, then tens, then ones. Use 0 for an empty place!',
      steps: [
        `Hundreds come first. Write the ${h}.`,
        `Tens come next. Write the ${t}.${t === 0 ? ' A 0 holds the place!' : ''}`,
        `Ones come last. Write the ${o}.${o === 0 ? ' A 0 holds the place!' : ''}`,
        'Read the three digits together. What number is it?',
      ],
      why: why(`${h} hundreds = ${h * 100}, ${t} tens = ${t * 10}, ${o} ones = ${o}. Together: ${n}.`, [
        `Add the digits: ${h} + ${t} + ${o} = ${h + t + o}.`,
        `Hundreds are worth 10 each, so ${h} hundreds is ${h * 10}.`,
      ]),
      word: true,
    };
  }
  const [h, t, o] = distinctDigits(3);
  const n = h * 100 + t * 10 + o;
  const places = [['hundreds', h, 100], ['tens', t, 10], ['ones', o, 1]];
  if (Math.random() < 0.5) {
    const [name, d] = pick(places);
    return {
      prompt: `What digit is in the ${name} place of ${n}?`,
      answer: String(d),
      hint: 'Read the places from left to right: hundreds, tens, ones.',
      steps: ['Read the places from left to right: hundreds, tens, ones.', `Point to the ${name} place in ${n}.`, 'What digit is there?'],
      why: why(`${n} is ${h} hundreds, ${t} tens and ${o} ones.`, [
        `${n} is ${o} hundreds, ${t} tens and ${h} ones.`,
        `Add the digits: ${h} + ${t} + ${o} = ${h + t + o}.`,
      ]),
    };
  }
  const [name, d, mult] = pick(places.filter(([, digit]) => digit !== 0));
  const other = pick(places.filter(([placeName]) => placeName !== name))[0];
  return {
    prompt: `What is the value of the ${d} in ${n}?`,
    answer: String(d * mult),
    choices: shuffle([d, d * 10, d * 100]).map(String),
    hint: `Find which place the ${d} is in. A 3 in the tens place is worth 30!`,
    steps: [
      `Find the ${d} in ${n}.`,
      'Which place is it in: hundreds, tens or ones?',
      'In the ones place it means just itself. In the tens, add one 0. In the hundreds, add two 0s.',
      `So what is the ${d} worth?`,
    ],
    why: why(`The ${d} is in the ${name} place, so it means ${d} ${name} = ${d * mult}.`, [
      mult === 1 ? `Every digit is worth 10 times itself: ${d * 10}.` : `A digit is always worth just itself: ${d}.`,
      `The ${d} is in the ${other} place.`,
    ]),
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
  const dir = down ? 'down' : 'up';
  const missing = rand(1, 4);
  const k = missing <= 2 ? 3 : 0; // two numbers next to each other that are both shown
  return {
    prompt: seq.map((v, i) => (i === missing ? '__' : v)).join(', '),
    answer: String(seq[missing]),
    hint: `Each number goes ${dir} by ${step}.`,
    steps: [
      `Look at two numbers next to each other: ${seq[k]} and ${seq[k + 1]}.`,
      `How far apart are they? Each number goes ${dir} by ${step}.`,
      `The number before the blank is ${seq[missing - 1]}. ${seq[missing - 1]} ${down ? '−' : '+'} ${step} = ?`,
    ],
    why: why(`It goes ${dir} by ${step} each time.`, [`It goes ${dir} by 1 each time.`, `It goes ${dir} by ${step * 2} each time.`]),
    mistake: seq[missing] + (down ? -1 : 1),
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
  const names = level === 1 ? ['tens', 'ones'] : ['hundreds', 'tens', 'ones'];
  const [da, db] = [String(a), String(b)];
  const i = [...da].findIndex((x, k) => x !== db[k]);
  const steps = [`Look at the ${names[0]} first: ${da[0]} and ${db[0]}.`];
  for (let k = 1; k <= (i < 0 ? names.length - 1 : i); k++) steps.push(`Same ${names[k - 1]}, so look at the ${names[k]}: ${da[k]} and ${db[k]}.`);
  steps.push(i < 0
    ? 'Every place is the same. What does that tell you?'
    : `Which number has more ${names[i]}? The alligator mouth opens toward the bigger number!`);
  return {
    steps,
    prompt: 'Which sign goes in the box?',
    visual: `<div class="eq">${a} ${box} ${b}</div>`,
    summary: `${a} ? ${b}`,
    answer: a > b ? '>' : a < b ? '<' : '=',
    choices: SIGNS,
    hint: `Compare the ${level === 1 ? 'tens first, then the ones' : 'hundreds first, then tens, then ones'}. The alligator mouth eats the bigger number!`,
    why: why(
      i < 0 ? "Every place has the same digit, so they're equal." : `Look at the ${names[i]} first: ${da[i]} is ${da[i] > db[i] ? 'more' : 'less'} than ${db[i]}.`,
      ['Look at the ones first.', i < 0 ? 'The first number is always bigger.' : "They have the same number of digits, so they're equal."],
    ),
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
  const values = counts.flatMap(([kind, c]) => Array(c).fill(MONEY[kind].value));
  let running = 0;
  const tally = values.map((v) => (running += v)).join(', ');
  // Count on one kind of money at a time, biggest first.
  const groups = counts.filter(([, c]) => c);
  const steps = [];
  let sofar = 0;
  groups.forEach(([kind, c], g) => {
    const m = MONEY[kind];
    const marks = Array.from({ length: c }, (_, i) => `${sofar + m.value * (i + 1)}¢`);
    const what = c > 1 ? m.many : `${m.one}`;
    if (groups.length === 1) {
      steps.push(`Each ${m.one} is worth ${m.value}¢.`, `Count the ${what} by ${m.value}s. Where do you end?`);
    } else if (g === groups.length - 1) {
      steps.push(`Last, the ${what}: ${m.value}¢${c > 1 ? ' each' : ''}. Count on from ${sofar}¢. Where do you end?`);
    } else if (g === 0) {
      steps.push(`Start with the biggest: the ${what}. ${marks.join(', ')}.`);
    } else {
      steps.push(`Count on the ${what} by ${m.value}s: ${marks.join(', ')}.`);
    }
    sofar += c * m.value;
  });
  const wrong = [1, 5, 10]
    .map((each) => [values.length * each, `Every coin is worth ${each}¢: ${values.length * each}¢.`])
    .filter(([wrongTotal]) => wrongTotal !== total)
    .slice(0, 2)
    .map(([, text]) => text);
  return {
    prompt: 'How many cents is this money worth?',
    visual: `<div class="coins-row">${visual}</div>`,
    summary,
    answer: String(total),
    hint: `Start with the biggest and count on: ${level === 3 ? 'a dollar is 100¢, ' : ''}quarters 25¢, dimes 10¢, nickels 5¢, pennies 1¢.`,
    steps,
    why: why(`Count on from the biggest: ${tally}.`, wrong),
    mistake: values.length > 1 ? total - values[values.length - 1] : total + 1,
  };
}

/* ---------------------------- Grade 4 ---------------------------- */

// Steps for a times fact, using the friendliest trick.
function factSteps(a, b) {
  const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
  if (lo === 1) return ['Anything times 1 is just itself.', `So what is ${a} × ${b}?`];
  if (lo === 10 || hi === 10) {
    const o = a === 10 ? b : a;
    return ['Times 10 is easy: put a 0 on the end.', `What is ${o} with a 0 on the end?`];
  }
  if (a === 9 || b === 9) {
    const o = a === 9 ? b : a;
    return [`Start with 10 × ${o} = ${10 * o}.`, `9 × ${o} is one ${o} less than that.`, `${10 * o} − ${o} = ?`];
  }
  const easy = [2, 5].find((x) => x === a || x === b);
  if (easy || lo <= 4) {
    const by = easy ?? hi;
    const times = by === a ? b : a;
    return [
      `${a} × ${b} means ${times} groups of ${by}.`,
      `Skip count by ${by}s and hold up a finger each time: ${multiples(by, Math.min(3, times - 1))}…`,
      `Keep going until you have ${times} fingers up. Where do you land?`,
    ];
  }
  // Both 6 or more: break the bigger one into 5 (or 10) and the rest.
  const chunk = hi > 10 ? 10 : 5;
  return [
    `Break ${hi} into ${chunk} + ${hi - chunk}.`,
    `${chunk} × ${lo} = ${chunk * lo}. ${hi - chunk} × ${lo} = ${(hi - chunk) * lo}.`,
    `Add them: ${chunk * lo} + ${(hi - chunk) * lo} = ?`,
  ];
}

function multFacts(level) {
  let a, b;
  if (level === 1) { a = pick([2, 3, 4, 5, 10]); b = rand(1, 10); }
  else if (level === 2) { a = rand(2, 10); b = rand(2, 10); }
  else { a = rand(6, 12); b = rand(6, 12); }
  if (Math.random() < 0.5) [a, b] = [b, a];
  let hint = `${a} × ${b} means ${a} groups of ${b}. Try skip counting by ${b}!`;
  if (a === 9 || b === 9) hint = `9s trick: 10 × ${a === 9 ? b : a} = ${(a === 9 ? b : a) * 10}, then take away one ${a === 9 ? b : a}.`;
  const steps = factSteps(a, b);
  const multiples = Array.from({ length: a }, (_, i) => b * (i + 1));
  const counted = a <= 6 ? multiples.join(', ') : `${multiples.slice(0, 3).join(', ')} … ${a * b}`;
  return {
    prompt: `${a} × ${b} = ?`,
    answer: String(a * b),
    hint,
    steps,
    why: why(`Skip count by ${b}, ${a} times: ${counted}.`, [
      a + b === a * b ? `Count by 1s up to ${b}.` : `Add them: ${a} + ${b} = ${a + b}.`,
      `Put the digits side by side: ${a}${b}.`,
    ]),
    mistake: a * (b + pick([-1, 1])),
  };
}

function multBig(level) {
  const oneDigit = level === 1 || Math.random() < 0.6;
  let a, b;
  if (oneDigit) {
    a = level === 1 ? rand(12, 99) : level === 2 ? rand(100, 999) : rand(1000, 9999);
    b = rand(2, 9);
    const parts = placeParts(a);
    // Forgetting to carry: multiply each digit and keep only the last digit.
    const noCarry = String(a).split('').reverse().reduce((sum, d, i) => sum + ((Number(d) * b) % 10) * 10 ** i, 0);
    const lead = parts[0];
    const zeros = String(lead).length - 1;
    const d0 = lead / 10 ** zeros;
    const zeroTip = `Tip: for ${fmt(lead)} × ${b}, do ${d0} × ${b} = ${d0 * b}, then put ${zeros} zero${zeros > 1 ? 's' : ''} on the end.`;
    const steps = parts.length === 1
      ? [`Do ${d0} × ${b} = ${d0 * b}.`, `Then put ${zeros} zero${zeros > 1 ? 's' : ''} on the end. What do you get?`]
      : [
          `Break ${fmt(a)} into ${parts.map(fmt).join(' + ')}.`,
          zeroTip,
          `Multiply each part by ${b}: ${parts.map((p) => `${fmt(p)} × ${b} = ${fmt(p * b)}`).join(', ')}.`,
          `Add them up: ${parts.map((p) => fmt(p * b)).join(' + ')} = ?`,
        ];
    return {
      prompt: `${fmt(a)} × ${b} = ?`,
      answer: String(a * b),
      hint: `Break it apart: ${parts.map((p) => `${fmt(p)} × ${b}`).join(' + ')}`,
      steps,
      why: why(
        `Break ${fmt(a)} into ${parts.map(fmt).join(' + ')}. Multiply each part by ${b}, then add: ${parts.map((p) => fmt(p * b)).join(' + ')} = ${fmt(a * b)}.`,
        [`Only multiply the ones: ${a % 10} × ${b} = ${(a % 10) * b}.`, `Add instead: ${fmt(a)} + ${b} = ${fmt(a + b)}.`],
        areaModel(parts, b),
      ),
      mistake: noCarry !== a * b ? noCarry : undefined,
    };
  }
  // No round tens: "tens by tens and ones by ones" would happen to be right.
  do {
    a = level === 2 ? rand(11, 30) : rand(21, 99);
    b = level === 2 ? rand(11, 19) : rand(21, 99);
  } while (a % 10 === 0 || b % 10 === 0);
  const [tens, ones] = [b - (b % 10), b % 10];
  const parts = [tens, ones].filter(Boolean);
  const tensOnly = (a - (a % 10)) * tens + (a % 10) * ones; // a common mix-up
  return {
    prompt: `${a} × ${b} = ?`,
    answer: String(a * b),
    hint: `Break it apart: ${parts.map((p) => `${a} × ${p}`).join(' + ')}`,
    steps: [
      `Break ${b} into ${tens} + ${ones}.`,
      `${a} × ${tens}: do ${a} × ${tens / 10} = ${fmt((a * tens) / 10)}, then put a 0 on the end: ${fmt(a * tens)}.`,
      `${a} × ${ones} = ${fmt(a * ones)}.`,
      `Add them: ${fmt(a * tens)} + ${fmt(a * ones)} = ?`,
    ],
    why: why(
      `Break ${b} into ${parts.join(' + ')}. ${parts.map((p) => `${a} × ${p} = ${fmt(a * p)}`).join(', ')}. Add: ${fmt(a * b)}.`,
      [`Multiply tens by tens and ones by ones, then add: ${fmt(tensOnly)}.`, `Add instead: ${a} + ${b} = ${a + b}.`],
      areaModel(parts, a),
    ),
    mistake: tensOnly,
  };
}

function division(level) {
  let d, q, r;
  if (level === 1) { d = rand(2, 10); q = rand(1, 10); r = 0; }
  else if (level === 2) { d = rand(2, 9); q = rand(3, 30); r = Math.random() < 0.5 ? rand(1, d - 1) : 0; }
  else { d = rand(3, 9); q = rand(12, 150); r = Math.random() < 0.6 ? rand(1, d - 1) : 0; }
  const n = d * q + r;
  let steps;
  if (q <= 10) {
    steps = r
      ? [
          `Count by ${d}s: ${multiples(d, Math.min(2, q - 1))}… Stop before you go past ${fmt(n)}.`,
          `How many ${d}s did you count? That's the first part of the answer.`,
          `${fmt(n)} minus the last number you said is the remainder (R).`,
        ]
      : [`Think backwards: ${d} × ? = ${fmt(n)}.`, `Skip count by ${d}s: ${multiples(d, Math.max(1, Math.min(3, q - 1)))}…`, `How many ${d}s did it take to reach ${fmt(n)}?`];
  } else {
    const chunk = q % 10 ? q - (q % 10) : q - 10; // take out a big group of tens first
    const left = n - d * chunk;
    steps = [
      `Take out a big chunk first: ${d} × ${chunk} = ${fmt(d * chunk)}. (${d} × ${chunk / 10} = ${fmt((d * chunk) / 10)}, then add a 0.)`,
      `What's left: ${fmt(n)} − ${fmt(d * chunk)} = ${fmt(left)}.`,
      `How many ${d}s fit in ${fmt(left)}?${r ? ' Anything left over is the remainder (R).' : ''}`,
      `Add the groups: ${chunk} + that number = ?`,
    ];
  }
  const reasoning = why(
    r ? `${d} × ${q} = ${fmt(d * q)}, and ${r} is left over.` : `${d} × ${q} = ${fmt(n)}, so ${fmt(n)} ÷ ${d} = ${q}.`,
    [`${d} × ${q + 1} = ${fmt(d * (q + 1))}, and that fits.`, `Take away ${d} once: ${fmt(n)} − ${d} = ${fmt(n - d)}.`],
  );
  if (!r) return { prompt: `${fmt(n)} ÷ ${d} = ?`, answer: String(q), hint: `Think backwards: ${d} × ? = ${fmt(n)}`, steps, why: reasoning, mistake: q + 1 };
  const label = (qq, rr) => `${qq} R${rr}`;
  const options = new Set([label(q, r), label(q + 1, r), label(q - 1, r), label(q, r === d - 1 ? r - 1 : r + 1)]);
  return {
    prompt: `${fmt(n)} ÷ ${d} = ?`,
    answer: label(q, r),
    choices: shuffle([...options]),
    hint: `Find the biggest number that times ${d} is ${fmt(n)} or less. What's left over is the remainder (R).`,
    steps,
    why: reasoning,
    mistake: label(q - 1, r + d), // remainder bigger than the divisor
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
  // Adding instead of multiplying: 1/3 = ?/6 → 1 + 3 = 4.
  const added = missingTop ? left[0] + (right[1] - left[1]) : left[1] + (right[0] - left[0]);
  const bars = Math.max(left[1], right[1]) <= 24 ? `<div class="bars">${bar(...left)}${bar(...right)}</div>` : '';
  return {
    prompt: 'Fill in the missing number.',
    visual: `<div class="eq">${frac(...left)} = ${shown}</div>`,
    summary: `${left[0]}/${left[1]} = ${missingTop ? `?/${right[1]}` : `${right[0]}/?`}`,
    answer: String(missingTop ? right[0] : right[1]),
    hint: `What was ${known[0]} ${verb} by to make ${known[1]}? Do the same to the ${missingTop ? 'top' : 'bottom'}!`,
    steps: [
      `Look at the ${missingTop ? 'bottoms' : 'tops'}: ${known[0]} and ${known[1]}.`,
      `${known[0]} ${simplify ? '÷' : '×'} ${k} = ${known[1]}. So it was ${verb} by ${k}.`,
      `Do the same to the ${missingTop ? 'top' : 'bottom'}: ${missingTop ? left[0] : left[1]} ${simplify ? '÷' : '×'} ${k} = ?`,
    ],
    why: why(
      `${simplify ? 'Divide' : 'Multiply'} the top and the bottom by the same number, ${k}. The bars show the same amount.`,
      ['Add the same number to the top and the bottom.', 'Only change the bottom number. The top stays the same.'],
      bars,
    ),
    mistake: added > 0 ? added : undefined,
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
  const answer = a * d > c * b ? '>' : a * d < c * b ? '<' : '=';
  const bars = `<div class="bars">${bar(a, b)}${bar(c, d)}</div>`;

  // Pick the clearest explanation for this pair.
  const [A, C] = [`${a}/${b}`, `${c}/${d}`];
  const half = (x, y) => Math.sign(2 * x - y); // -1 below 1/2, 0 at 1/2, 1 above
  let right, steps;
  const sign = 'Which sign fits?';
  let wrong = ['A bigger bottom number means a bigger fraction.', 'A bigger top number always means a bigger fraction.'];
  if (answer === '=') {
    right = `They're the same amount: multiply the top and bottom of ${A} by ${c / a} to get ${C}.`;
    steps = [`Try making ${A} look like ${C}. What do you multiply ${b} by to get ${d}?`, `Multiply the top and bottom of ${A} by ${d / b}: ${a} × ${d / b} and ${b} × ${d / b}.`, `Compare what you get with ${C}. ${sign}`];
  } else if (b === d) {
    right = `Same size pieces, so more pieces is bigger: ${Math.max(a, c)} pieces beats ${Math.min(a, c)}.`;
    wrong = ['A bigger bottom number means a bigger fraction.', "They have the same bottom, so they're equal."];
    steps = [`The bottoms are the same (${b}), so the pieces are the same size.`, `Compare the tops: ${a} pieces and ${c} pieces.`, `More pieces of the same size is more. ${sign}`];
  } else if (a === c) {
    right = `Both have ${a} pieces, but cutting into ${Math.min(b, d)} makes bigger pieces than cutting into ${Math.max(b, d)}.`;
    steps = [`The tops are the same: ${a} piece${a > 1 ? 's' : ''} each.`, `Compare the bottoms: ${b} and ${d}. Cutting into more pieces makes each piece smaller.`, `Which fraction has the bigger pieces? ${sign}`];
  } else if (half(a, b) * half(c, d) < 0) {
    const [more, less] = half(a, b) > 0 ? [A, C] : [C, A];
    right = `${more} is more than half, and ${less} is less than half.`;
    steps = [
      'Compare each fraction to 1/2.',
      `Half of ${b} is ${halfOf(b)}. Is ${a} more or less than that? Half of ${d} is ${halfOf(d)}. Is ${c} more or less?`,
      `The one that's more than half is bigger. ${sign}`,
    ];
  } else {
    const L = (b * d) / gcd(b, d);
    right = `Make the bottoms the same: ${A} = ${(a * L) / b}/${L} and ${C} = ${(c * L) / d}/${L}.`;
    steps = [
      `Make the bottoms the same. ${b} and ${d} both go into ${L}.`,
      `${A} = ${(a * L) / b}/${L}. ${C} = ${(c * L) / d}/${L}.`,
      `Now the pieces are the same size, so compare the tops. ${sign}`,
    ];
  }

  return {
    prompt: 'Which sign goes in the box?',
    visual: `<div class="eq">${frac(a, b)} ${box} ${frac(c, d)}</div>${level < 3 ? bars : ''}`,
    summary: `${A} ? ${C}`,
    answer,
    choices: SIGNS,
    hint: level === 1
      ? 'Same bottom? Bigger top wins. Same top? Smaller bottom means bigger pieces!'
      : level === 2
        ? 'Look at how much of each bar is colored. You can also compare each fraction to 1/2.'
        : 'Make the bottoms the same, or compare each fraction to 1/2.',
    steps,
    why: why(right, wrong, bars),
    mistake: { '<': '>', '>': '<', '=': pick(['<', '>']) }[answer],
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
  const low = Math.floor(n / place) * place;
  const high = low + place;
  const answer = Math.round(n / place) * place;
  const up = answer === high;
  const other = up ? low : high;
  return {
    prompt: `Round ${fmt(n)} to the nearest ${name}.`,
    answer: String(answer),
    hint: `Look at the ${rightName} digit: it's ${rightDigit}. 5 or more → round up. 4 or less → round down.`,
    steps: [
      `${fmt(n)} is between ${fmt(low)} and ${fmt(high)}.`,
      `Look at the ${rightName} digit, just to the right of the ${name}s place: it's ${rightDigit}.`,
      `5 or more rounds up to ${fmt(high)}. 4 or less rounds down to ${fmt(low)}. Which one?`,
    ],
    why: why(
      n - low === place / 2 ? `${fmt(n)} is exactly halfway, and halfway rounds up to ${fmt(high)}.` : `${fmt(n)} is closer to ${fmt(answer)} than to ${fmt(other)}.`,
      [`The ${rightName} digit is ${rightDigit}, so round ${up ? 'down' : 'up'}.`, `Always round ${up ? 'down' : 'up'}.`],
      numberLine(low, high, n),
    ),
    mistake: other,
  };
}

function placeValue4(level) {
  const size = [4, 6, 7][level - 1];
  const digits = distinctDigits(size);
  const n = Number(digits.join(''));
  const positions = digits.map((d, i) => [d, size - 1 - i]).filter(([d]) => d !== 0);
  const [d, power] = pick(positions);
  const otherPowers = shuffle([...Array(size).keys()].filter((p) => p !== power)).slice(0, 3);
  const wrongPlace = PLACE_WORDS[pick([...Array(size).keys()].filter((p) => p !== power))];
  return {
    prompt: `What is the value of the ${d} in ${fmt(n)}?`,
    answer: fmt(d * 10 ** power),
    choices: shuffle([power, ...otherPowers]).map((p) => fmt(d * 10 ** p)),
    hint: `From the right: ones, tens, hundreds, thousands${size > 4 ? ', ten-thousands, hundred-thousands' : ''}${size > 6 ? ', millions' : ''}.`,
    steps: [
      `Find the ${d} in ${fmt(n)}.`,
      'Count the places from the right: ones, tens, hundreds, thousands…',
      `The ${d} is in the ${PLACE_WORDS[power]} place.`,
      `So it's worth ${d} × ${fmt(10 ** power)}. Which choice is that?`,
    ],
    why: why(`The ${d} is in the ${PLACE_WORDS[power]} place, so it's worth ${d} × ${fmt(10 ** power)} = ${fmt(d * 10 ** power)}.`, [
      power === 0 ? `Every digit is worth 10 times itself: ${d * 10}.` : `A digit is always worth just itself: ${d}.`,
      `The ${d} is in the ${wrongPlace} place.`,
    ]),
  };
}

/* ------------------------ More pictures ------------------------ */

// Offer the right answer plus `count` distinct wrong ones from the candidates.
function choicesFrom(answer, candidates, count = 2) {
  const wrong = [...new Set(candidates.map(String))].filter((c) => c !== answer);
  return shuffle([answer, ...wrong.slice(0, count)]);
}

const clockTime = (h, m) => `${h}:${String(m).padStart(2, '0')}`;
const nextHour = (h) => (h % 12) + 1;
const prevHour = (h) => ((h + 10) % 12) + 1;

function clock(h, m) {
  const at = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return [50 + r * Math.sin(a), 50 - r * Math.cos(a)].map((v) => v.toFixed(1));
  };
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const [x1, y1] = at(i * 6, i % 5 ? 43.5 : 41);
    const [x2, y2] = at(i * 6, 46);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="tick${i % 5 ? '' : ' big'}"/>`;
  }).join('');
  const nums = Array.from({ length: 12 }, (_, i) => {
    const [x, y] = at((i + 1) * 30, 34);
    return `<text x="${x}" y="${y}">${i + 1}</text>`;
  }).join('');
  const [hx, hy] = at(((h % 12) + m / 60) * 30, 21);
  const [mx, my] = at(m * 6, 37);
  return `<svg class="clock" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="47" class="clock-face"/>${ticks}${nums}
    <line x1="50" y1="50" x2="${mx}" y2="${my}" class="hand-m"/>
    <line x1="50" y1="50" x2="${hx}" y2="${hy}" class="hand-h"/>
    <circle cx="50" cy="50" r="3" class="clock-pin"/></svg>`;
}

// Dots in partner pairs, for even and odd.
const pairDots = (n) =>
  `<div class="pairs">${Array.from({ length: Math.ceil(n / 2) }, (_, i) => `<span class="pair">${'<i></i>'.repeat(Math.min(2, n - i * 2))}</span>`).join('')}</div>`;

const arrayPic = (rows, cols, item) =>
  `<div class="array" style="--c:${cols}">${Array(rows * cols).fill(`<span>${item}</span>`).join('')}</div>`;

const pictureGraph = (title, rows) => `
  <div class="graph"><div class="graph-title">${title}</div>
    ${rows.map((r) => `<div class="graph-row"><span class="graph-label">${r.e} ${r.name}</span><span class="graph-pics">${r.e.repeat(r.v)}</span></div>`).join('')}
  </div>`;

const barGraph = (title, rows, max) => {
  const cells = (fn) => `<span class="graph-bar" style="--max:${max}">${Array.from({ length: max }, (_, i) => fn(i)).join('')}</span>`;
  return `
  <div class="graph"><div class="graph-title">${title}</div>
    ${rows.map((r) => `<div class="graph-row"><span class="graph-label">${r.e} ${r.name}</span>${cells((i) => `<i class="${i < r.v ? 'on' : ''}"></i>`)}</div>`).join('')}
    <div class="graph-row graph-scale"><span class="graph-label"></span>${cells((i) => `<b>${i + 1}</b>`)}</div>
  </div>`;
};

const SHAPES = [
  { name: 'triangle', sides: 3, why: '3 sides and 3 corners make a triangle.' },
  { name: 'square', sides: 4, why: '4 sides that are all the same length, and 4 square corners: a square.' },
  { name: 'rectangle', sides: 4, why: '4 sides and 4 square corners, with 2 long sides and 2 short sides: a rectangle.' },
  { name: 'trapezoid', sides: 4, why: '4 sides, but only the top and bottom go the same way: a trapezoid.' },
  { name: 'pentagon', sides: 5, why: '5 sides and 5 corners make a pentagon.' },
  { name: 'hexagon', sides: 6, why: '6 sides and 6 corners make a hexagon.' },
  { name: 'octagon', sides: 8, why: '8 sides and 8 corners make an octagon.' },
];

function shapePic(shape) {
  let points;
  if (shape.name === 'rectangle') points = '6,30 94,30 94,72 6,72';
  else if (shape.name === 'trapezoid') points = '30,30 70,30 92,72 8,72';
  else {
    const n = shape.sides;
    points = Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / n + (n % 2 ? 0 : Math.PI / n);
      return `${(50 + 42 * Math.cos(a)).toFixed(1)},${(53 + 42 * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
  }
  return `<svg class="shape" viewBox="0 0 100 100" aria-hidden="true"><polygon points="${points}"/></svg>`;
}

// A rectangle cut into k equal parts with one shaded.
const sharesPic = (k, shaded) =>
  `<svg class="shape shares" viewBox="0 0 120 70" aria-hidden="true">${Array.from(
    { length: k },
    (_, i) => `<rect x="${(4 + (i * 112) / k).toFixed(1)}" y="4" width="${(112 / k).toFixed(1)}" height="62" class="${i === shaded ? 'on' : ''}"/>`,
  ).join('')}</svg>`;

// A rectangle with its sides labeled. With `grid`, unit squares are drawn inside.
function rectPic(l, w, unit, { grid = false, top = `${l} ${unit}`, side = `${w} ${unit}` } = {}) {
  const ratio = grid ? l / w : Math.min(3, Math.max(1, l / w));
  return `<div class="rect-wrap"><span class="rect-label">${side}</span><div class="rect-col"><span class="rect-label">${top}</span>
    <div class="rect ${grid ? 'grid' : ''}" style="--r:${ratio};--l:${l};--w:${w}"></div></div></div>`;
}

const hundredGrid = (h) =>
  `<div class="hgrid">${Array.from({ length: 100 }, (_, i) => `<span class="${i < h ? 'on' : ''}"></span>`).join('')}</div>`;

/* ------------------------ More grade 2 ------------------------ */

function time(level) {
  const h = rand(1, 12);
  if (level === 3) {
    const m = rand(0, 11) * 5;
    const n = pick([15, 20, 25, 30, 35, 40, 45, 50]);
    const total = (h % 12) * 60 + m + n;
    const [h2, m2] = [Math.floor(total / 60) % 12 || 12, total % 60];
    const start = clockTime(h, m);
    const answer = clockTime(h2, m2);
    const crosses = m + n >= 60;
    const sameHour = clockTime(h, m2); // forgot to move on to the next hour
    return {
      prompt: `The clock says ${start}. What time will it be in ${n} minutes?`,
      visual: clock(h, m),
      summary: `${start} + ${n} minutes`,
      spoken: '',
      answer,
      choices: choicesFrom(answer, [crosses ? sameHour : clockTime(nextHour(h2), m2), clockTime(nextHour(h2), m2), clockTime(h2, (m2 + 10) % 60)]),
      hint: crosses ? `Count on to ${clockTime(nextHour(h), 0)} first. That's ${60 - m} minutes. Then count the rest.` : 'Count on by 5s with the long hand.',
      steps: crosses
        ? [
            `Start at ${start}.`,
            `${60 - m} minutes gets you to the next hour: ${clockTime(nextHour(h), 0)}.`,
            ...(n > 60 - m ? [`You still need ${n} − ${60 - m} = ${n - (60 - m)} more minutes.`, `What time is ${n - (60 - m)} minutes after ${clockTime(nextHour(h), 0)}?`] : ['So what time is it?']),
          ]
        : [
            `Start at ${start}. The long hand is on the ${m / 5 || 12}.`,
            `${n} minutes is ${n / 5} jumps of 5 minutes.`,
            `Where does the long hand land? The hour stays ${h}.`,
          ],
      why: why(
        crosses
          ? `Count on ${60 - m} minutes to ${clockTime(nextHour(h), 0)}, then ${n - (60 - m)} more: ${answer}.`
          : `Count on ${n} minutes from ${start}. It doesn't reach the next hour, so it's ${answer}.`,
        ['There are 100 minutes in an hour.', crosses ? `Add the minutes, but keep the hour at ${h}: ${sameHour}.` : `Every ${n} minutes is a new hour.`],
      ),
      mistake: crosses ? sameHour : clockTime(nextHour(h2), m2),
      word: true,
    };
  }
  const m = level === 1 ? pick([0, 30]) : rand(0, 11) * 5;
  const hand = m / 5 || 12; // the number the long hand points to
  const answer = clockTime(h, m);
  const swapped = clockTime(hand, (h % 12) * 5);
  const hourOff = clockTime(m >= 30 ? nextHour(h) : prevHour(h), m);
  return {
    prompt: 'What time does the clock show?',
    visual: clock(h, m),
    summary: `Clock: short hand at ${h}, long hand on ${hand}`,
    spoken: '',
    answer,
    choices: choicesFrom(answer, [swapped, hourOff, clockTime(h, hand % 12 === 0 ? 12 : hand)]),
    hint: 'The short hand is the hour. The long hand is the minutes: count by 5s for each number!',
    steps: m === 0
      ? [`The short hand shows the hour. It points to the ${h}.`, "The long hand is on the 12. That means o'clock: :00.", 'So what time is it?']
      : [
          m >= 30
            ? `The short hand shows the hour. It's between the ${h} and the ${nextHour(h)}. The hour is the number it already passed: ${h}.`
            : `The short hand shows the hour. It's just past the ${h}.`,
          `The long hand shows the minutes. It's on the ${hand}.`,
          `Count by 5s up to the ${hand}: ${multiples(5, Math.max(1, Math.min(3, hand - 1)))}…`,
          'Put the hour and the minutes together.',
        ],
    why: why(
      m === 0
        ? `The short hand is on the ${h} and the long hand is on the 12, so it's ${h} o'clock.`
        : `The short hand is ${m >= 30 ? 'past' : 'just after'} the ${h}, so the hour is ${h}. The long hand is on the ${hand}: ${hand} fives is ${m} minutes.`,
      [
        swapped !== answer ? `The long hand shows the hour, so it's ${swapped}.` : 'The short hand shows the minutes.',
        m === 0 ? `The long hand is on the 12, so it's 12 minutes past.` : `The long hand is on the ${hand}, so it's ${hand} minutes past.`,
      ],
    ),
    mistake: swapped !== answer ? swapped : hourOff,
  };
}

const EVEN_ODD = ['Even', 'Odd'];
const parity = (n) => (n % 2 ? 'Odd' : 'Even');
const other = (p) => (p === 'Even' ? 'Odd' : 'Even');

function evenOdd(level) {
  if (level === 3) {
    const [a, b] = [rand(11, 99), rand(11, 99)];
    const answer = parity(a + b);
    const [pa, pb] = [parity(a), parity(b)];
    return {
      prompt: `Is ${a} + ${b} even or odd?`,
      answer,
      choices: EVEN_ODD,
      hint: `Look at the ones digits. Is ${a} even or odd? Is ${b}?`,
      steps: [
        `Look at the ones digits: ${a % 10} and ${b % 10}.`,
        `Is ${a} even or odd? Is ${b}?`,
        'Even + even = even. Odd + odd = even. Even + odd = odd. Which one is this?',
      ],
      why: why(`${a} is ${pa.toLowerCase()} and ${b} is ${pb.toLowerCase()}. ${pa} + ${pb.toLowerCase()} = ${answer.toLowerCase()}.`, [
        `Just look at the first number: ${a} is ${pa.toLowerCase()}.`,
        `${pa} + ${pb.toLowerCase()} = ${other(answer).toLowerCase()}.`,
      ]),
      mistake: other(answer),
    };
  }
  const n = level === 1 ? rand(2, 20) : rand(21, 999);
  const answer = parity(n);
  const ones = n % 10;
  if (level === 1) {
    return {
      prompt: `Is ${n} even or odd?`,
      visual: pairDots(n),
      answer,
      choices: EVEN_ODD,
      hint: 'Even numbers make pairs with no dot left over.',
      steps: ['Look at the dots. They are in pairs, like partners.', 'Does every dot have a partner?', 'One dot left over means odd. No dot left over means even.'],
      why: answer === 'Even'
        ? why(`Every dot has a partner, so ${n} is even.`, ['One dot is left with no partner.', `Numbers that end in ${ones} are odd.`])
        : why(`One dot is left with no partner, so ${n} is odd.`, ['Every dot has a partner.', `Numbers that end in ${ones} are even.`]),
      mistake: other(answer),
    };
  }
  const first = Number(String(n)[0]);
  return {
    prompt: `Is ${n} even or odd?`,
    answer,
    choices: EVEN_ODD,
    hint: 'Only the ones digit matters. Is it 0, 2, 4, 6 or 8?',
    steps: [`Find the ones digit of ${n}: it's ${ones}.`, 'Even digits are 0, 2, 4, 6 and 8.', `Is ${ones} one of them?`],
    why: why(`The ones digit is ${ones}, and ${ones} is ${answer.toLowerCase()}. Only the ones digit matters.`, [
      parity(first) !== answer ? `The first digit is ${first}, so it's ${parity(first).toLowerCase()}.` : 'Big numbers are always even.',
      `Numbers that end in ${ones} are ${other(answer).toLowerCase()}.`,
    ]),
    mistake: other(answer),
  };
}

const ARRAY_ITEMS = ['🍎', '⭐', '🌸', '🍪', '🐞', '⚽', '🧁', '🐟'];

function equalGroups(level) {
  const rows = rand(2, level === 1 ? 3 : 5);
  let cols;
  do cols = rand(2, 5);
  while (cols === rows && (level === 3 || rows === 2)); // 2 × 2 = 2 + 2, so skip it
  const item = pick(ARRAY_ITEMS);
  const adds = (n) => Array(n).fill(cols).join(' + ');
  const total = rows * cols;
  if (level === 3) {
    const answer = adds(rows);
    return {
      prompt: 'Which addition matches the rows?',
      visual: arrayPic(rows, cols, item),
      summary: `${rows} rows of ${cols}`,
      spoken: '',
      answer,
      choices: shuffle([answer, `${rows} + ${cols}`, adds(rows + 1)]),
      hint: 'Count how many are in one row. Then count the rows.',
      steps: ['Count how many are in one row.', 'Count how many rows there are.', 'Add the number in one row once for every row. Which one matches?'],
      why: why(`There are ${rows} rows with ${cols} in each row, so add ${cols} ${rows} times.`, [
        `Add the number of rows and the number in a row: ${rows} + ${cols}.`,
        `There are ${rows + 1} rows.`,
      ]),
      mistake: `${rows} + ${cols}`,
    };
  }
  return {
    prompt: `How many ${item} in all?`,
    visual: arrayPic(rows, cols, item),
    summary: `${rows} rows of ${cols}`,
    answer: String(total),
    hint: `Count by ${cols}s, one row at a time.`,
    steps: [
      `Count the ${item} in one row: ${cols}.`,
      `Count the rows: ${rows}.`,
      `Count by ${cols}s, one row at a time: ${multiples(cols, rows - 1)}…`,
      'What number do you say for the last row?',
    ],
    why: why(`${rows} rows of ${cols}: ${adds(rows)} = ${total}.`, [`Count one row: ${cols}.`, `Add the rows and the columns: ${rows} + ${cols} = ${rows + cols}.`]),
    mistake: rows + cols,
  };
}

const GRAPHS = [
  { title: 'Favorite fruit', items: [['🍎', 'apples'], ['🍌', 'bananas'], ['🍇', 'grapes'], ['🍓', 'strawberries']] },
  { title: 'Favorite pet', items: [['🐶', 'dogs'], ['🐱', 'cats'], ['🐟', 'fish'], ['🐰', 'bunnies']] },
  { title: 'Favorite sport', items: [['⚽', 'soccer'], ['🏀', 'basketball'], ['⚾', 'baseball'], ['🏊', 'swimming']] },
];

function graphs(level) {
  const g = pick(GRAPHS);
  const k = level === 1 ? 3 : 4;
  const max = level === 1 ? 6 : 10;
  const items = shuffle(g.items).slice(0, k);
  let values;
  do values = items.map(() => rand(1, max));
  while (new Set(values).size < k);
  const rows = items.map(([e, name], i) => ({ e, name, v: values[i] }));
  const pictures = level === 1;
  const unit = pictures ? 'row' : 'bar';
  const sum = values.reduce((a, b) => a + b, 0);
  const sorted = [...rows].sort((a, b) => b.v - a.v);
  const [top, low] = [sorted[0], sorted[k - 1]];
  const [A, B] = shuffle(rows).slice(0, 2).sort((a, b) => b.v - a.v);
  const kind = pick({ 1: ['count', 'most'], 2: ['count', 'more', 'most'], 3: ['more', 'fewer', 'total', 'two'] }[level]);
  const base = {
    visual: pictures ? pictureGraph(g.title, rows) : barGraph(g.title, rows, max),
    spoken: '',
    word: true,
    hint: pictures ? 'Each picture is 1 kid. Count carefully!' : 'Look where each bar ends, and read the number under it.',
  };
  const data = `(${rows.map((r) => `${r.name} ${r.v}`).join(', ')})`;
  const ask = (prompt, rest) => ({ ...base, prompt, summary: `${prompt} ${data}`, ...rest });

  if (kind === 'count') {
    const t = pick(rows);
    const longest = t === top ? low : top;
    return ask(`How many kids picked ${t.name}?`, {
      answer: String(t.v),
      steps: [
        `Find the ${t.name} ${unit}.`,
        pictures ? 'Touch each picture as you count it.' : 'Put your finger at the end of the bar.',
        pictures ? 'How many pictures?' : 'Slide down to the numbers. Which number is it on?',
      ],
      why: why(pictures ? `Count the pictures in the ${t.name} row: ${t.v}.` : `The ${t.name} bar ends at ${t.v}.`, [
        `Count every ${unit}: ${sum}.`,
        `Look at the ${longest === top ? 'longest' : 'shortest'} ${unit}: ${longest.v}.`,
      ]),
      mistake: sum,
    });
  }
  if (kind === 'most') {
    const first = rows[0] === top ? rows[k - 1] : rows[0];
    return ask('Which did the most kids pick?', {
      answer: top.name,
      choices: rows.map((r) => r.name),
      steps: [`Look at every ${unit}.`, `Find the longest ${unit}. That's the most kids.`, 'Which one is it?'],
      why: why(`The ${top.name} ${unit} is the longest: ${top.v} kids.`, [
        `${cap(first.name)} is ${first === rows[0] ? 'at the top' : 'at the bottom'} of the graph, so it's the most.`,
        `The shortest ${unit} wins.`,
      ]),
      mistake: low.name,
    });
  }
  if (kind === 'more' || kind === 'fewer') {
    const prompt = kind === 'more' ? `How many more kids picked ${A.name} than ${B.name}?` : `How many fewer kids picked ${B.name} than ${A.name}?`;
    return ask(prompt, {
      answer: String(A.v - B.v),
      steps: [`Find ${A.name}: ${A.v}.`, `Find ${B.name}: ${B.v}.`, `"How many ${kind}" means subtract: ${A.v} − ${B.v} = ?`],
      why: why(`${cap(A.name)}: ${A.v}. ${cap(B.name)}: ${B.v}. ${A.v} − ${B.v} = ${A.v - B.v}.`, [
        `Add them: ${A.v} + ${B.v} = ${A.v + B.v}.`,
        `Just read the ${A.name} ${unit}: ${A.v}.`,
      ]),
      mistake: A.v + B.v,
    });
  }
  if (kind === 'two') {
    return ask(`How many kids picked ${A.name} or ${B.name}?`, {
      answer: String(A.v + B.v),
      steps: [`Find ${A.name}: ${A.v}.`, `Find ${B.name}: ${B.v}.`, `"Or" means put them together: ${A.v} + ${B.v} = ?`],
      why: why(`Add the two ${unit}s: ${A.v} + ${B.v} = ${A.v + B.v}.`, [`Subtract: ${A.v} − ${B.v} = ${A.v - B.v}.`, `Count every ${unit}: ${sum}.`]),
      mistake: A.v - B.v,
    });
  }
  return ask('How many kids voted in all?', {
    answer: String(sum),
    steps: [
      `Read every ${unit}: ${values.join(', ')}.`,
      `Add two at a time. ${values[0]} + ${values[1]} = ${values[0] + values[1]}.`,
      `Now add the rest: ${[values[0] + values[1], ...values.slice(2)].join(' + ')} = ?`,
    ],
    why: why(`Add every ${unit}: ${values.join(' + ')} = ${sum}.`, [`Read the longest ${unit}: ${top.v}.`, `Count the ${unit}s: ${k}.`]),
    mistake: top.v,
  });
}

const SHARE_NAMES = { 2: 'a half', 3: 'a third', 4: 'a fourth' };

function shapes(level) {
  if (level === 1) {
    const s = pick(SHAPES);
    const n = s.sides;
    const [word, one] = pick([['sides', 'side'], ['corners', 'corner']]);
    return {
      prompt: `How many ${word} does this shape have?`,
      visual: shapePic(s),
      summary: `${s.name}: how many ${word}?`,
      spoken: '',
      answer: String(n),
      hint: `Put your finger on one ${one} and go around. Count each ${one} once!`,
      steps: [`Put your finger on one ${one}.`, `Go around the shape and count each ${one}: 1, 2, 3…`, 'Stop when you get back to the start. How many?'],
      why: why(`Go around and count each ${one} once: ${Array.from({ length: n }, (_, i) => i + 1).join(', ')}.`, [
        `Skip the bottom ${one}: ${n - 1}.`,
        n === 4 ? 'Count only the top ones: 2.' : `Every shape has 4 ${word}.`,
      ]),
      mistake: n - 1,
    };
  }
  if (level === 3 && Math.random() < 0.5) {
    const k = rand(2, 4);
    const answer = SHARE_NAMES[k];
    return {
      prompt: 'How much of the shape is shaded?',
      visual: sharesPic(k, rand(0, k - 1)),
      summary: `${k} equal parts, 1 shaded`,
      spoken: '',
      answer,
      choices: Object.values(SHARE_NAMES),
      hint: 'Count all the equal parts. How many are shaded?',
      steps: ['Count all the equal parts.', 'How many parts are shaded? Just 1.', '1 of 2 equal parts is a half. 1 of 3 is a third. 1 of 4 is a fourth. Which is it?'],
      why: why(`It's cut into ${k} equal parts and 1 is shaded: ${answer}.`, [
        k === 2 ? 'It has 2 parts, so each part is a fourth.' : 'One part is shaded, so it is always a half.',
        `There are ${k} parts plus the shaded one, so it's 1 out of ${k + 1}.`,
      ]),
      mistake: k === 2 ? 'a fourth' : 'a half',
    };
  }
  if (level === 3) {
    const pool = SHAPES.filter((s) => s.sides !== 4);
    const s = pick(pool);
    const others = shuffle(pool.filter((x) => x !== s)).slice(0, 2);
    return {
      prompt: `I have ${s.sides} sides and ${s.sides} corners. What shape am I?`,
      answer: s.name,
      choices: shuffle([s.name, ...others.map((x) => x.name)]),
      hint: 'Tri- means 3, penta- means 5, hexa- means 6, octo- means 8.',
      steps: [`The shape has ${s.sides} sides.`, 'Tri- means 3, penta- means 5, hexa- means 6, octo- means 8.', 'Which name starts with the right number word?'],
      why: why(`${cap(aOrAn(s.name))} has ${s.sides} sides and ${s.sides} corners.`, [`${cap(aOrAn(others[0].name))} has ${s.sides} sides.`, 'More corners means fewer sides.']),
      word: true,
    };
  }
  const s = pick(SHAPES);
  // A square is also a rectangle, so never offer both.
  const pool = SHAPES.filter((x) => x !== s && !(['square', 'rectangle'].includes(s.name) && ['square', 'rectangle'].includes(x.name)));
  const others = shuffle(pool).slice(0, 2);
  return {
    prompt: 'What is this shape called?',
    visual: shapePic(s),
    summary: `A shape with ${s.sides} sides`,
    spoken: '',
    answer: s.name,
    choices: shuffle([s.name, ...others.map((x) => x.name)]),
    hint: 'Count the sides first. Then look at the corners.',
    steps: s.sides === 4
      ? ['Count the sides. How many?', '4 sides with square corners is a square or a rectangle. If not, it\'s a trapezoid.', 'All 4 sides the same length? Square. 2 long and 2 short? Rectangle.']
      : ['Count the sides. How many?', '3 sides: triangle. 5: pentagon. 6: hexagon. 8: octagon.', 'Which name matches?'],
    why: why(s.why, [`It has ${s.sides} sides, so it's ${aOrAn(others[0].name)}.`, `It's ${aOrAn(others[1].name)} because it's big.`]),
  };
}

/* ------------------------ More grade 4 ------------------------ */

function addSubBig(level) {
  const digits = level === 3 ? pick([5, 6]) : level + 2;
  const lo = 10 ** (digits - 1);
  const hi = 10 ** digits - 1;
  const lead = (n) => Math.round(n / lo) * lo; // round to the first place, for checking
  const add = Math.random() < 0.5;
  let a, b, zeros = false;
  if (add) [a, b] = [rand(lo, hi), rand(lo, hi)];
  else {
    zeros = level === 3 && Math.random() < 0.35;
    a = zeros ? rand(2, 9) * lo : rand(lo * 2, hi);
    b = rand(lo, a - 1);
  }
  const answer = add ? a + b : a - b;
  const carry = add ? byPlace(a, b, (x, y) => x + y) !== a + b : needsBorrow(a, b);
  const reasoning = add
    ? why(`Line up the places and add from the ones, carrying when a place makes 10 or more. Check: about ${fmt(lead(a))} + ${fmt(lead(b))} = ${fmt(lead(a) + lead(b))}.`, [
        carry ? 'Add each place, but never carry.' : 'Start adding at the left and carry to the right.',
        `Subtract instead: ${fmt(Math.max(a, b))} − ${fmt(Math.min(a, b))}.`,
      ])
    : why(`Line up the places and subtract from the ones, borrowing when the top digit is smaller. Check: ${fmt(answer)} + ${fmt(b)} = ${fmt(a)}.`, [
        carry ? 'Take the smaller digit from the bigger digit in each place.' : 'Start subtracting at the left and borrow to the right.',
        `Add instead: ${fmt(a)} + ${fmt(b)}.`,
      ]);
  const hint = zeros
    ? `Borrowing across zeros: take 1 from the ${fmt(a / lo)} in front, and the zeros become 9s.`
    : `Line up the places. Start with the ones and ${add ? 'carry when a place makes 10 or more' : 'borrow when the top digit is smaller'}.`;
  const steps = columnSteps(a, b, add);
  const base = { answer: String(answer), hint, steps, why: reasoning, mistake: carry ? (add ? byPlace(a, b, (x, y) => x + y) : byPlace(a, b, (x, y) => Math.abs(x - y))) : undefined };
  if (Math.random() < 0.3) {
    const name = pick(NAMES);
    const prompt = add
      ? pick([`A stadium had ${fmt(a)} fans on Saturday and ${fmt(b)} on Sunday. How many fans came in all?`, `${name} scored ${fmt(a)} points, then ${fmt(b)} more. How many points in all?`])
      : pick([`A library had ${fmt(a)} books and lent out ${fmt(b)}. How many books are left?`, `A game needs ${fmt(a)} points to win. ${name} has ${fmt(b)}. How many more points are needed?`]);
    return { ...base, prompt, steps: [`Write it as a number sentence: ${fmt(a)} ${add ? '+' : '−'} ${fmt(b)}.`, ...steps], word: true };
  }
  return { ...base, prompt: `${fmt(a)} ${add ? '+' : '−'} ${fmt(b)} = ?` };
}

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59];

function factors(level) {
  if (level === 1) {
    const f = rand(2, 9);
    const yes = Math.random() < 0.5;
    let n;
    if (yes) n = f * rand(3, Math.floor(50 / f));
    else do n = rand(10, 50); while (n % f === 0);
    const q = Math.floor(n / f);
    return {
      prompt: `Is ${f} a factor of ${n}?`,
      answer: yes ? 'Yes' : 'No',
      choices: ['Yes', 'No'],
      hint: `Skip count by ${f}. Do you land right on ${n}?`,
      steps: [`Skip count by ${f}: ${multiples(f, 3)}…`, `Keep going until you reach ${n} or go past it.`, `Did you land right on ${n}? Or think: ${f} × ? = ${n}.`],
      why: yes
        ? why(`${f} × ${n / f} = ${n}, so ${f} is a factor of ${n}.`, [`A number's only factors are 1 and itself.`, `${f} + ${n / f} = ${f + n / f}, not ${n}.`])
        : why(`${f} × ${q} = ${f * q} and ${f} × ${q + 1} = ${f * (q + 1)}. ${n} is in between, so ${f} is not a factor.`, [
            `${n} is bigger than ${f}, so ${f} is a factor.`,
            `${f} × ${q} = ${f * q}, which is close enough.`,
          ]),
      mistake: yes ? 'No' : 'Yes',
    };
  }
  if (level === 2) {
    const f = pick([3, 4, 6, 7, 8, 9]);
    const k = rand(2, Math.floor(99 / f));
    const answer = f * k;
    // A number that ends in the same digit as f but isn't a multiple: a common mix-up.
    const endsLike = shuffle(Array.from({ length: 9 }, (_, j) => 10 * (j + 1) + f).filter((x) => x % f !== 0 && x !== answer))[0];
    const near = [];
    while (near.length < 2) {
      const kk = rand(2, Math.floor(99 / f));
      const x = f * kk + (near.length ? 2 : 1);
      if (kk !== k && x < 100 && x !== endsLike && !near.includes(x)) near.push(x);
    }
    const nearK = Math.floor(near[0] / f);
    return {
      prompt: `Which number is a multiple of ${f}?`,
      answer: String(answer),
      choices: shuffle([answer, endsLike, ...near]).map(String),
      hint: `Skip count by ${f}: ${f}, ${f * 2}, ${f * 3}… Which number do you land on?`,
      steps: [`Skip count by ${f}: ${multiples(f, 3)}…`, `Careful: ending in ${f} doesn't make a number a multiple of ${f}.`, 'Check each choice. Which one do you land right on?'],
      why: why(`${f} × ${k} = ${answer}, so ${answer} is a multiple of ${f}.`, [
        `${endsLike} ends in ${f}, so it's a multiple of ${f}.`,
        `${near[0]} is close to ${f} × ${nearK} = ${f * nearK}, so it counts.`,
      ]),
      mistake: endsLike,
    };
  }
  const prime = Math.random() < 0.5;
  let n;
  if (prime) n = pick(PRIMES);
  else do n = rand(4, 60); while (PRIMES.includes(n));
  const a = prime ? 1 : [2, 3, 5, 7].find((x) => n % x === 0);
  return {
    prompt: `Is ${n} prime or composite?`,
    answer: prime ? 'Prime' : 'Composite',
    choices: ['Prime', 'Composite'],
    hint: 'A prime number has exactly 2 factors: 1 and itself. Can you make it with a times fact?',
    steps: [
      'Prime means only 1 and itself go in evenly.',
      `Is ${n} even? Then 2 goes in${n === 2 ? ', but 2 is the number itself' : ''}.`,
      `Try 3, 5 and 7 too${[3, 5, 7].includes(n) ? ` (not ${n} itself)` : ''}. Does any of them go in evenly?`,
      'Something besides 1 and itself goes in? Composite. Nothing? Prime.',
    ],
    why: prime
      ? why(`${n}'s only factors are 1 and ${n}, so it's prime.`, [
          n === 2 ? 'Even numbers are never prime.' : `${n} is odd, and odd numbers always have lots of factors.`,
          `${n} has factors like ${n} × 2 = ${n * 2}.`,
        ])
      : why(`${a} × ${n / a} = ${n}, so ${n} has more factors than just 1 and itself.`, [
          n % 2 ? 'All odd numbers are prime.' : 'You only need to check if 5 goes in.',
          `${n} has only two factors: 1 and ${n}.`,
        ]),
    mistake: prime ? 'Composite' : 'Prime',
  };
}

const UNITS = [['cm', 'centimeters'], ['m', 'meters'], ['in', 'inches'], ['ft', 'feet']];

function areaPerimeter(level) {
  const [unit, unitName] = pick(UNITS);
  const w = rand(2, level === 1 ? 6 : 12);
  const l = rand(level === 3 ? w + 1 : w, level === 1 ? 9 : 20);
  const [A, P] = [l * w, 2 * (l + w)];
  const spoken = `The rectangle is ${l} ${unitName} long and ${w} ${unitName} wide.`;
  if (level === 3) {
    const useArea = Math.random() < 0.5;
    const visual = rectPic(l, w, unit, { top: `? ${unit}` });
    const base = { visual, spoken: '', answer: String(l), word: true };
    if (useArea) {
      return {
        ...base,
        prompt: `This rectangle's area is ${A} square ${unitName}. One side is ${w} ${unitName}. How long is the other side?`,
        summary: `Area ${A}, one side ${w}: other side?`,
        hint: `Think: ${w} × ? = ${A}`,
        steps: ['Area = one side × the other side.', `You know one side is ${w}. So ${w} × ? = ${A}.`, `Skip count by ${w}s until you reach ${A}. How many jumps?`],
        why: why(`Area = side × side, and ${w} × ${l} = ${A}. So the other side is ${l}.`, [`Subtract: ${A} − ${w} = ${A - w}.`, `Multiply: ${A} × ${w} = ${A * w}.`]),
        mistake: A - w,
      };
    }
    return {
      ...base,
      prompt: `This rectangle's perimeter is ${P} ${unitName}. One side is ${w} ${unitName}. How long is the other side?`,
      summary: `Perimeter ${P}, one side ${w}: other side?`,
      hint: `There are two sides of ${w}. Take them away, then split what's left between the other two sides.`,
      steps: [
        `A rectangle has two sides of ${w}. Together they make ${2 * w}.`,
        `Take those away: ${P} − ${2 * w} = ${P - 2 * w}. That's the other two sides together.`,
        `Split ${P - 2 * w} into 2 equal sides: ${P - 2 * w} ÷ 2 = ?`,
      ],
      why: why(`The two ${w} ${unit} sides make ${2 * w}. ${P} − ${2 * w} = ${P - 2 * w} for the other two sides, so each one is ${l}.`, [
        `Subtract one side: ${P} − ${w} = ${P - w}.`,
        `Take away both ${w}s and stop: ${P} − ${2 * w} = ${P - 2 * w}.`,
      ]),
      mistake: P - 2 * w,
    };
  }
  const visual = rectPic(l, w, unit, { grid: level === 1 });
  if (Math.random() < 0.5) {
    return {
      prompt: `What is the area in square ${unitName}?`,
      visual,
      summary: `Area of a ${l} ${unit} by ${w} ${unit} rectangle`,
      spoken,
      answer: String(A),
      hint: level === 1 ? 'Area is the squares inside. Count one row, then count the rows.' : `Area is the squares inside: multiply the two sides.`,
      steps: level === 1
        ? [`Count the squares in one row: ${l}.`, `Count the rows: ${w}.`, `${w} rows of ${l}: ${w} × ${l} = ?`]
        : [
            'Area is the squares inside. Multiply the two sides.',
            ...(l > 10
              ? [`Break ${l} into 10 + ${l - 10}. 10 × ${w} = ${10 * w}. ${l - 10} × ${w} = ${(l - 10) * w}.`, `Add them: ${10 * w} + ${(l - 10) * w} = ?`]
              : [`${l} × ${w} = ?`]),
          ],
      why: why(`Area is the squares inside: ${w} rows of ${l}, so ${l} × ${w} = ${A}.`, [`Add all four sides: ${P}.`, `Add the two sides: ${l} + ${w} = ${l + w}.`]),
      mistake: P !== A ? P : l + w,
      word: true,
    };
  }
  return {
    prompt: `What is the perimeter in ${unitName}?`,
    visual,
    summary: `Perimeter of a ${l} ${unit} by ${w} ${unit} rectangle`,
    spoken,
    answer: String(P),
    hint: 'Perimeter is the distance all the way around. Add all 4 sides!',
    steps: [
      'Perimeter goes all the way around: 4 sides.',
      `The sides are ${l}, ${w}, ${l} and ${w}.`,
      `The two ${l}s make ${2 * l}. The two ${w}s make ${2 * w}.`,
      `${2 * l} + ${2 * w} = ?`,
    ],
    why: why(`Perimeter is the distance around: ${l} + ${w} + ${l} + ${w} = ${P}.`, [`Multiply the sides: ${l} × ${w} = ${A}.`, `Add the two sides you see: ${l} + ${w} = ${l + w}.`]),
    mistake: l + w,
    word: true,
  };
}

const DEN_WORDS = { 3: 'thirds', 4: 'fourths', 5: 'fifths', 6: 'sixths', 8: 'eighths', 10: 'tenths', 12: 'twelfths' };

function addFractions(level) {
  const d = pick({ 1: [3, 4, 5, 6, 8], 2: [4, 5, 6, 8, 10, 12], 3: [5, 6, 8, 10, 12] }[level]);
  const subtract = level > 1 && Math.random() < 0.4;
  let tops;
  if (subtract) {
    const a = rand(2, d);
    tops = [a, rand(1, a - 1)];
  } else if (level === 3 && Math.random() < 0.5) {
    tops = [rand(1, d - 1), rand(1, d - 1), rand(1, d - 1)];
  } else {
    const a = rand(1, d - 2);
    tops = [a, rand(1, (level === 1 ? d - 1 : d) - a)];
  }
  const [a, b] = tops;
  const top = subtract ? a - b : tops.reduce((x, y) => x + y, 0);
  const answer = `${top}/${d}`;
  const op = subtract ? ' − ' : ' + ';
  const text = tops.map((t) => `${t}/${d}`).join(op);
  const candidates = subtract
    ? [`${a + b}/${d}`, `${b}/${d}`, `${top + 1}/${d}`]
    : [`${top}/${d * tops.length}`, `${tops.reduce((x, y) => x * y, 1)}/${d}`, `${top + 1}/${d}`, `${top - 1}/${d}`];
  const shown = top <= d ? bar(top, d) : `${bar(d, d)}${bar(top - d, d)}`;
  const base = {
    visual: `<div class="eq">${tops.map((t) => frac(t, d)).join(op)}</div><div class="bars">${tops.map((t) => bar(t, d)).join('')}</div>`,
    summary: text,
    answer,
    choices: choicesFrom(answer, candidates.filter((c) => !c.startsWith('0/'))),
    hint: 'Same size pieces? Just add (or take away) the top numbers. The bottom number stays the same!',
    steps: [
      `The bottoms are all ${d}, so every piece is the same size: ${DEN_WORDS[d]}.`,
      `Keep the bottom number: ${d}.`,
      `${subtract ? 'Take away' : 'Add'} the tops: ${tops.join(op)} = ?`,
      `Write your answer over ${d}.`,
    ],
    why: subtract
      ? why(`The pieces are all ${DEN_WORDS[d]}, so take away the tops: ${a} − ${b} = ${top}. The bottom stays ${d}.`, [
          'Subtract the tops and subtract the bottoms too.',
          `Add the tops instead: ${a} + ${b} = ${a + b}.`,
        ], `<div class="bars">${shown}</div>`)
      : why(`The pieces are all ${DEN_WORDS[d]}, so add the tops: ${tops.join(' + ')} = ${top}. The bottom stays ${d}.`, [
          'Add the tops and add the bottoms too.',
          `Multiply the tops: ${tops.join(' × ')}.`,
        ], `<div class="bars">${shown}</div>`),
    mistake: subtract ? `${a + b}/${d}` : `${top}/${d * tops.length}`,
  };
  if (level === 3 && tops.length === 2 && Math.random() < 0.5) {
    const [n1, n2] = shuffle(NAMES);
    const prompt = subtract
      ? `${n1} had ${a}/${d} of a ribbon and used ${b}/${d} of it. How much ribbon is left?`
      : `${n1} ate ${a}/${d} of a pizza and ${n2} ate ${b}/${d}. How much pizza did they eat?`;
    return { ...base, prompt, word: true };
  }
  return { ...base, prompt: subtract ? 'Subtract the fractions.' : 'Add the fractions.' };
}

function decimals(level) {
  if (level === 1) {
    const t = rand(1, 9);
    if (Math.random() < 0.5) {
      const answer = `0.${t}`;
      return {
        prompt: `Write ${t}/10 as a decimal.`,
        visual: `<div class="bars">${bar(t, 10)}</div>`,
        answer,
        choices: shuffle([answer, `0.0${t}`, `${t}.0`]),
        hint: 'Tenths go in the first place right after the decimal point.',
        steps: [`${t}/10 means ${t} tenths.`, 'Tenths go in the first place right after the decimal point.', 'Write a 0, then the point, then the tenths digit. Which choice matches?'],
        why: why(`${t} tenths: the ${t} goes in the tenths place, right after the point: 0.${t}.`, [
          `Tenths are two places after the point: 0.0${t}.`,
          `The ${t} is a whole number: ${t}.0.`,
        ]),
        mistake: `0.0${t}`,
      };
    }
    const answer = `${t}/10`;
    return {
      prompt: `Write 0.${t} as a fraction.`,
      visual: `<div class="bars">${bar(t, 10)}</div>`,
      answer,
      choices: shuffle([answer, `${t}/100`, `1/${t}`]),
      hint: 'The first place after the point is tenths.',
      steps: [`Look at 0.${t}. The ${t} is right after the point.`, 'The first place after the point is tenths, so the bottom is 10.', `So it's ${t} tenths. Which choice matches?`],
      why: why(`The ${t} is in the tenths place, so 0.${t} is ${t} tenths: ${t}/10.`, [`0.${t} means ${t} hundredths: ${t}/100.`, `0.${t} means 1 out of ${t}: 1/${t}.`]),
      mistake: `${t}/100`,
    };
  }
  if (level === 2) {
    let h;
    do h = rand(11, 99); while (h % 10 === 0);
    const dec = `0.${h}`;
    const tenthsWrong = `${Math.floor(h / 10)}.${h % 10}`;
    const r = Math.random();
    if (r < 0.4) {
      return {
        prompt: `Write ${h}/100 as a decimal.`,
        visual: hundredGrid(h),
        answer: dec,
        choices: shuffle([dec, tenthsWrong, `0.0${h}`]),
        hint: 'Hundredths use two places after the decimal point.',
        steps: [`${h}/100 means ${h} hundredths.`, 'Hundredths use two places after the decimal point.', `Write a 0, then the point, then ${h}. Which choice matches?`],
        why: why(`${h} hundredths fills two places after the point: ${dec}.`, [
          `Put the point between the digits: ${tenthsWrong}.`,
          `Hundredths start two zeros after the point: 0.0${h}.`,
        ]),
        mistake: tenthsWrong,
      };
    }
    if (r < 0.7) {
      const t = rand(1, 9);
      return {
        prompt: 'Fill in the missing number.',
        visual: `<div class="eq">${frac(t, 10)} = ${frac(box, 100)}</div>`,
        summary: `${t}/10 = ?/100`,
        answer: String(t * 10),
        hint: '1 tenth is the same as 10 hundredths.',
        steps: ['1 tenth is the same as 10 hundredths.', `So ${t} tenths is ${t} groups of 10 hundredths.`, `${t} × 10 = ?`],
        why: why(`1 tenth = 10 hundredths, so ${t} tenths = ${t * 10} hundredths.`, [`Add 90 to the top, like the bottom: ${t + 90}.`, `The top stays the same: ${t}.`]),
        mistake: t,
      };
    }
    const answer = `${h}/100`;
    return {
      prompt: `Write ${dec} as a fraction.`,
      visual: hundredGrid(h),
      answer,
      choices: shuffle([answer, `${h}/10`, `${h}/1000`]),
      hint: 'Two places after the point means hundredths.',
      steps: [`Count the places after the point in ${dec}: two.`, 'Two places means hundredths, so the bottom is 100.', 'What goes on top? Which choice matches?'],
      why: why(`${dec} has two places after the point, so it's ${h} hundredths: ${h}/100.`, [`${dec} is ${h} tenths: ${h}/10.`, `Add a zero for every digit, plus one: ${h}/1000.`]),
      mistake: `${h}/10`,
    };
  }
  // Hard: compare decimals. Often a tenths number against a "longer" hundredths number.
  const r = Math.random();
  let x, y; // values in hundredths
  let kind;
  if (r < 0.55) {
    kind = 'trap';
    const t = rand(2, 9);
    x = t * 10;
    do y = rand(Math.max(11, t + 1), x - 1); while (y % 10 === 0);
  } else if (r < 0.7) {
    kind = 'equal';
    x = rand(1, 9) * 10;
    y = x;
  } else {
    kind = 'plain';
    do [x, y] = [rand(11, 99), rand(11, 99)]; while (x === y || x % 10 === 0 || y % 10 === 0);
  }
  const short = kind === 'plain' ? `0.${x}` : `0.${x / 10}`;
  const long = `0.${y}`;
  const flip = Math.random() < 0.5;
  const [L, R] = flip ? [long, short] : [short, long];
  const [lv, rv] = flip ? [y, x] : [x, y];
  const answer = lv > rv ? '>' : lv < rv ? '<' : '=';
  const two = (v) => (v / 100).toFixed(2);
  const bigger = lv > rv ? L : R;
  let right, wrong;
  if (kind === 'equal') {
    right = `${short} is ${x / 10} tenths, which is the same as ${x} hundredths: ${long}.`;
    wrong = [`${long} has more digits, so it's bigger.`, `${short} is smaller because ${x / 10} is less than ${x}.`];
  } else {
    right = `Make both hundredths: ${two(lv)} and ${two(rv)}. ${Math.max(lv, rv)} hundredths is more than ${Math.min(lv, rv)}, so ${bigger} is bigger.`;
    wrong = kind === 'trap'
      ? [`${long} has more digits, so it's bigger.`, `${y} is more than ${x / 10}, so ${long} is bigger.`]
      : [`Compare only the last digits: ${L.slice(-1)} and ${R.slice(-1)}.`, 'The number on the right is always bigger.'];
  }
  const grids = `<div class="hgrids"><figure>${hundredGrid(lv)}<figcaption>${L}</figcaption></figure><figure>${hundredGrid(rv)}<figcaption>${R}</figcaption></figure></div>`;
  return {
    prompt: 'Which sign goes in the box?',
    visual: `<div class="eq">${L} ${box} ${R}</div>`,
    summary: `${L} ? ${R}`,
    answer,
    choices: SIGNS,
    hint: 'Give both numbers two places after the point (0.5 = 0.50), then compare.',
    steps: kind === 'plain'
      ? ['Both numbers have two places after the point.', `Compare the tenths first: ${L[2]} and ${R[2]}. If they're the same, compare the hundredths.`, 'Which sign fits?']
      : ['Give both numbers two places after the point. 0.5 is the same as 0.50.', `So it's ${two(lv)} and ${two(rv)}.`, `Compare ${lv} hundredths and ${rv} hundredths. Which sign fits?`],
    why: why(right, wrong, grids),
    mistake: kind === 'trap' ? (L === long ? '>' : '<') : kind === 'equal' ? (L === long ? '>' : '<') : { '<': '>', '>': '<' }[answer],
  };
}

const CONVERSIONS = [
  { big: ['foot', 'feet'], small: ['inch', 'inches'], f: 12, more: 'longer' },
  { big: ['yard', 'yards'], small: ['foot', 'feet'], f: 3, more: 'longer' },
  { big: ['hour', 'hours'], small: ['minute', 'minutes'], f: 60, more: 'longer' },
  { big: ['minute', 'minutes'], small: ['second', 'seconds'], f: 60, more: 'longer' },
  { big: ['week', 'weeks'], small: ['day', 'days'], f: 7, more: 'longer' },
  { big: ['meter', 'meters'], small: ['centimeter', 'centimeters'], f: 100, more: 'longer', harder: true },
  { big: ['kilometer', 'kilometers'], small: ['meter', 'meters'], f: 1000, more: 'longer', harder: true },
  { big: ['pound', 'pounds'], small: ['ounce', 'ounces'], f: 16, more: 'heavier', harder: true },
  { big: ['kilogram', 'kilograms'], small: ['gram', 'grams'], f: 1000, more: 'heavier', harder: true },
  { big: ['gallon', 'gallons'], small: ['quart', 'quarts'], f: 4, more: 'more', harder: true },
  { big: ['liter', 'liters'], small: ['milliliter', 'milliliters'], f: 1000, more: 'more', harder: true },
];
const unitWord = ([one, many], n) => (n === 1 ? one : many);

function measurement(level) {
  const c = pick(CONVERSIONS.filter((x) => level > 1 || !x.harder));
  const { big, small, f } = c;
  const r = Math.random();
  if (level === 1 || (level === 2 && r < 0.5)) {
    const n = rand(2, level === 1 ? 5 : 10);
    return {
      prompt: `How many ${small[1]} are in ${n} ${big[1]}?`,
      summary: `${n} ${big[1]} = ? ${small[1]}`,
      answer: String(n * f),
      hint: `1 ${big[0]} = ${fmt(f)} ${small[1]}. How many groups of ${fmt(f)}?`,
      steps: [
        `1 ${big[0]} = ${fmt(f)} ${small[1]}.`,
        `${n} ${big[1]} is ${n} groups of ${fmt(f)}.`,
        ...(timesTip(n, f) ? [timesTip(n, f)] : []),
        `${n} × ${fmt(f)} = ?`,
      ],
      why: why(`1 ${big[0]} = ${fmt(f)} ${small[1]}, so ${n} ${big[1]} = ${n} × ${fmt(f)} = ${fmt(n * f)}.`, [
        `Add them: ${n} + ${fmt(f)} = ${fmt(n + f)}.`,
        `1 ${big[0]} is 10 ${small[1]}, so it's ${n * 10}.`,
      ]),
      mistake: n + f,
      word: true,
    };
  }
  if (level === 2 || r < 0.4) {
    const n = rand(1, level === 2 ? 5 : 9);
    const m = rand(1, f - 1);
    return {
      prompt: `How many ${small[1]} are in ${n} ${unitWord(big, n)} ${fmt(m)} ${unitWord(small, m)}?`,
      summary: `${n} ${unitWord(big, n)} ${fmt(m)} ${unitWord(small, m)} = ? ${small[1]}`,
      answer: String(n * f + m),
      hint: `Change the ${big[1]} into ${small[1]} first (1 ${big[0]} = ${fmt(f)}), then add the ${fmt(m)}.`,
      steps: [
        `1 ${big[0]} = ${fmt(f)} ${small[1]}.`,
        `Change the ${unitWord(big, n)}: ${n} × ${fmt(f)} = ${fmt(n * f)} ${small[1]}.`,
        `Don't forget the extra ${fmt(m)}: ${fmt(n * f)} + ${fmt(m)} = ?`,
      ],
      why: why(`${n} × ${fmt(f)} = ${fmt(n * f)} ${small[1]}, then add the ${fmt(m)}: ${fmt(n * f + m)}.`, [
        `Just add the numbers: ${n} + ${fmt(m)} = ${fmt(n + m)}.`,
        `${n} × ${fmt(f)} = ${fmt(n * f)}, and that's the answer.`,
      ]),
      mistake: n * f,
      word: true,
    };
  }
  // Hard: which is more? The bigger number isn't always the bigger amount.
  const n = rand(2, 6);
  let s;
  do s = n * f + pick([-1, 1]) * rand(1, Math.max(1, Math.floor(f / 3))); while (s <= 0 || s === n * f);
  const bigText = `${n} ${big[1]}`;
  const smallText = `${fmt(s)} ${small[1]}`;
  const answer = n * f > s ? bigText : smallText;
  return {
    prompt: `Which is ${c.more}?`,
    answer,
    choices: shuffle([bigText, smallText]),
    hint: `Change ${bigText} into ${small[1]} first. 1 ${big[0]} = ${fmt(f)} ${small[1]}.`,
    steps: [
      `Change ${bigText} into ${small[1]}. 1 ${big[0]} = ${fmt(f)} ${small[1]}.`,
      `${n} × ${fmt(f)} = ${fmt(n * f)} ${small[1]}.`,
      `Now compare ${fmt(n * f)} ${small[1]} with ${smallText}. Which is ${c.more}?`,
    ],
    why: why(`${bigText} = ${n} × ${fmt(f)} = ${fmt(n * f)} ${small[1]}. ${fmt(n * f)} ${n * f > s ? '>' : '<'} ${fmt(s)}, so ${answer} is ${c.more}.`, [
      `${fmt(s)} is a bigger number, so it's ${c.more}.`,
      `${cap(big[1])} are bigger units, so ${bigText} is always ${c.more}.`,
    ]),
    word: true,
  };
}

/* ---------------------------- Topics ---------------------------- */

export const RIGHT = '👍 Right';
export const WRONG = '👎 Wrong';

function wrongAnswerFor(q) {
  if (q.mistake !== undefined && String(q.mistake) !== q.answer) return String(q.mistake);
  if (q.choices) return pick(q.choices.filter((c) => c !== q.answer));
  const n = Number(q.answer.replace(/,/g, ''));
  return String(pick([n + 1, n + 10, n - 1, n - 10].filter((x) => x >= 0 && x !== n)));
}

// "Fix the Mistake": the buddy answers a question (right 40% of the time)
// and the kid decides whether the buddy is right, then explains why.
// "{buddy}" is replaced with the buddy's name by the app.
function mistakeTopic(topics) {
  return {
    id: 'mistake',
    name: 'Fix the Mistake',
    emoji: '🕵️',
    desc: 'Is your buddy right?',
    extra: true,
    // `pool` lets the app weight the topics (focus areas come up more often).
    gen: (level, pool = topics) => {
      const topic = pick(pool);
      const base = topic.gen(level);
      const buddyRight = Math.random() < 0.4;
      let claim = buddyRight ? base.answer : wrongAnswerFor(base);
      if (/^\d+$/.test(claim)) claim = fmt(Number(claim));
      return {
        topicId: topic.id,
        prompt: base.prompt,
        visual: base.visual,
        spoken: base.spoken,
        word: base.word,
        claim,
        baseSummary: base.summary,
        summary: `${base.summary ?? base.prompt} ({buddy} said ${claim})`,
        answer: buddyRight ? RIGHT : WRONG,
        choices: [RIGHT, WRONG],
        hint: "Solve it yourself first. Then check {buddy}'s answer.",
        steps: base.steps?.length
          ? [`Solve it yourself first. ${base.steps[0]}`, ...base.steps.slice(1), "Now check: does {buddy}'s answer match yours?"]
          : undefined,
        why: base.why,
        whyAsk: "What's the right thinking?",
        alwaysWhy: true,
      };
    },
  };
}

function withExtras(topics) {
  return [
    ...topics,
    mistakeTopic(topics),
    {
      id: 'mixed', name: 'Mixed Challenge', emoji: '🎲', desc: 'A little bit of everything!', extra: true,
      gen: (level, pool = topics) => {
        const topic = pick(pool);
        return { topicId: topic.id, ...topic.gen(level) };
      },
    },
  ];
}

export const TOPICS = {
  2: withExtras([
    { id: 'add100', name: 'Addition', emoji: '➕', desc: 'Add numbers together', gen: addition },
    { id: 'sub100', name: 'Subtraction', emoji: '➖', desc: 'Take away', gen: subtraction },
    { id: 'place2', name: 'Place Value', emoji: '🏠', desc: 'Hundreds, tens & ones', gen: placeValue2 },
    { id: 'skip', name: 'Skip Counting', emoji: '🐸', desc: 'Count by 2s, 5s, 10s & more', gen: skipCount },
    { id: 'compare2', name: 'Compare Numbers', emoji: '🐊', desc: 'Greater than, less than', gen: compare2 },
    { id: 'evenodd', name: 'Even & Odd', emoji: '👯', desc: 'Partners or leftovers?', gen: evenOdd },
    { id: 'groups', name: 'Equal Groups', emoji: '🍎', desc: 'Rows and arrays', gen: equalGroups },
    { id: 'money', name: 'Money', emoji: '🪙', desc: 'Count the coins', gen: money },
    { id: 'time', name: 'Telling Time', emoji: '🕒', desc: 'Read the clock', gen: time },
    { id: 'graphs', name: 'Graphs', emoji: '📊', desc: 'Picture & bar graphs', gen: graphs },
    { id: 'shapes', name: 'Shapes', emoji: '🔷', desc: 'Sides, corners & parts', gen: shapes },
  ]),
  4: withExtras([
    { id: 'multfacts', name: 'Times Tables', emoji: '✖️', desc: 'Facts up to 12 × 12', gen: multFacts },
    { id: 'multbig', name: 'Big Multiplication', emoji: '🏗️', desc: 'Multi-digit multiplying', gen: multBig },
    { id: 'division', name: 'Division', emoji: '➗', desc: 'With and without remainders', gen: division },
    { id: 'addsub4', name: 'Add & Subtract', emoji: '🧮', desc: 'Big numbers, carry & borrow', gen: addSubBig },
    { id: 'factors', name: 'Factors & Multiples', emoji: '🔢', desc: 'Factors, multiples & primes', gen: factors },
    { id: 'equivfrac', name: 'Equal Fractions', emoji: '🍕', desc: 'Find equivalent fractions', gen: equivFractions },
    { id: 'comparefrac', name: 'Compare Fractions', emoji: '⚖️', desc: 'Which fraction is bigger?', gen: compareFractions },
    { id: 'addfrac', name: 'Add Fractions', emoji: '🥧', desc: 'Same-size pieces', gen: addFractions },
    { id: 'decimals', name: 'Decimals', emoji: '🔟', desc: 'Tenths & hundredths', gen: decimals },
    { id: 'rounding', name: 'Rounding', emoji: '🎯', desc: 'Round to the nearest place', gen: rounding },
    { id: 'place4', name: 'Place Value', emoji: '🏰', desc: 'Big numbers, digit by digit', gen: placeValue4 },
    { id: 'area', name: 'Area & Perimeter', emoji: '📐', desc: 'Inside and around rectangles', gen: areaPerimeter },
    { id: 'measure', name: 'Measurement', emoji: '📏', desc: 'Convert units', gen: measurement },
  ]),
};

export const GRADES = Object.keys(TOPICS).map(Number);
