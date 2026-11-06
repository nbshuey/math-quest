// Read-aloud turns math symbols into words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSpeech } from '../js/speech.js';

const cases = [
  ['3/8 = ?/16', '3 eighths equals blank over 16'],
  ['17 ÷ 5 = 3 R2', '17 divided by 5 equals 3 remainder 2'],
  ['4 × 6 = ?', '4 times 6 equals what?'],
  ['The two parts make a right angle (90°).', 'degrees'],
  ['75¢', '75 cents'],
  ['2 1/4 + 1 2/4', '2 and 1 fourth plus 1 and 2 fourths'],
  ['Which time makes the most sense to eat lunch?', 'eat lunch'],
];
for (const [text, want] of cases) {
  test(`reads "${text}"`, () => assert.ok(toSpeech(text).includes(want), toSpeech(text)));
}
