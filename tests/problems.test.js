// Every question type, at every level, many times over: answers, choices, hints and explanations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOPICS, GRADES, speedFact, stepText } from '../js/problems.js';
import { toSpeech } from '../js/speech.js';

const RUNS = Number(process.env.RUNS ?? 400);
const plain = (s) => s.replace(/,/g, '');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Steps that show the working may hit the answer by coincidence (e.g. "Ones: 7 − 1 = 6").
const WORKING = /^(Ones|Tens|Hundreds|What's left|Take out a big chunk)/;
// Shape names and unit comparisons list every option on purpose.
const NAMES_OK = new Set(['shapes', 'shapes3', 'measure']);

function problemsIn(q, topic) {
  const out = [];
  const text = JSON.stringify(q);
  if (/undefined|NaN|Infinity|null/.test(text.replace(/"mistake":null/, ''))) out.push('bad text');
  if (!q.prompt || typeof q.answer !== 'string' || !q.answer) out.push('no prompt or answer');
  if (q.choices) {
    if (!q.choices.includes(q.answer)) out.push('answer not in choices');
    if (new Set(q.choices).size !== q.choices.length || q.choices.length < 2) out.push('duplicate or too few choices');
  } else if (!/^\d{1,8}$/.test(plain(q.answer))) out.push('typed answer is not a whole number');
  const w = q.why;
  if (!w?.right || w.wrong?.length !== 2 || new Set([w.right, ...w.wrong]).size !== 3) out.push('"How do you know?" needs 1 right + 2 different wrong');
  if (q.mistake !== undefined && plain(String(q.mistake)) === plain(q.answer)) out.push('mistake equals the answer');
  if (typeof q.mistake === 'number' && q.mistake < 0) out.push('negative mistake');
  const steps = q.steps?.map(stepText);
  if (!steps || steps.length < 2 || steps.length > 6) out.push(`needs 2–6 hint steps, got ${steps?.length}`);
  else {
    if (steps.some((s) => typeof s !== 'string' || s.length < 8) || new Set(steps).size !== steps.length) out.push('empty or repeated step');
    if (q.steps.some((s) => typeof s !== 'string' && typeof s.pic !== 'string')) out.push('step picture is not HTML');
    if (!['<', '>', '='].includes(q.answer)) {
      const reveal = new RegExp(`= (${escRe(q.answer)}|${escRe(plain(q.answer))})(?!\\d|,\\d|\\/|\\.\\d)`);
      if (steps.some((s) => !WORKING.test(s) && reveal.test(s.replace(/¢/g, '')))) out.push('a hint step gives away the answer');
    }
    if (/[a-z]{3,}/i.test(q.answer) && !topic.extra && !NAMES_OK.has(topic.id) && !/^(Yes|No|Even|Odd|Prime|Composite)$/.test(q.answer)
      && steps.some((s) => s.includes(q.answer) && !(q.choices || []).some((c) => c !== q.answer && s.includes(c)))) out.push('a hint step names the answer');
    steps.forEach((s) => toSpeech(s));
  }
  toSpeech(q.prompt);
  return out;
}

for (const grade of GRADES) {
  for (const topic of TOPICS[grade]) {
    test(`grade ${grade} · ${topic.name}`, () => {
      const found = new Map();
      for (const level of [1, 2, 3]) {
        for (let i = 0; i < RUNS; i++) {
          const q = topic.gen(level);
          for (const problem of problemsIn(q, topic)) {
            const key = `L${level}: ${problem}`;
            // The division chunking step "2 × 10 = 20" can equal the answer of 40 ÷ 2: harmless.
            if (problem.includes('gives away') && (q.topicId ?? topic.id) === 'division') continue;
            if (!found.has(key)) found.set(key, `${q.prompt} → ${q.answer}`);
          }
        }
      }
      assert.deepEqual([...found.entries()], [], 'problems found (first example of each)');
    });
  }
}

test('topic ids are unique across grades', () => {
  const ids = Object.values(TOPICS).flat().filter((t) => !t.extra).map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('speed facts are whole numbers and right', () => {
  for (const grade of GRADES) {
    for (const level of [1, 2, 3]) {
      for (let i = 0; i < 2000; i++) {
        const f = speedFact(grade, level);
        const [a, op, b] = f.text.split(' ');
        const want = { '+': +a + +b, '−': a - b, '×': a * b, '÷': a / b }[op];
        assert.equal(f.answer, String(want), f.text);
        assert.match(f.answer, /^\d+$/);
        if (grade === 3) assert.ok(op === '÷' || (+a <= 10 && +b <= 10), `grade 3 stays within 10 × 10: ${f.text}`);
      }
    }
  }
});
