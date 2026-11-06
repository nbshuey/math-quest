// Each file in js/ must import every shared name it uses. (A missing import only fails when
// that line runs, so this catches it early.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../js/', import.meta.url);
const files = readdirSync(DIR).filter((f) => f.endsWith('.js'));
const src = Object.fromEntries(files.map((f) => [f, readFileSync(new URL(f, DIR), 'utf8')]));

// Code only: no comments, no string text, no regex literals (template ${...} parts are kept).
function codeOnly(s) {
  let out = '';
  const stack = [];
  const prev = () => out.trimEnd().slice(-1);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (stack.at(-1) === 'tpl') {
      if (c === '\\') i++;
      else if (c === '`') { stack.pop(); out += ' '; }
      else if (c === '$' && s[i + 1] === '{') { stack.push('{'); out += ' '; i++; }
      continue;
    }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i + 2) + 1; continue; }
    if (c === "'" || c === '"') { for (i++; i < s.length && s[i] !== c; i++) if (s[i] === '\\') i++; out += ' 0 '; continue; }
    if (c === '`') { stack.push('tpl'); continue; }
    if (c === '/' && '(,=:[!&|?{};'.includes(prev() || ';')) {
      let inClass = false;
      for (i++; i < s.length; i++) {
        if (s[i] === '\\') { i++; continue; }
        if (s[i] === '[') inClass = true;
        else if (s[i] === ']') inClass = false;
        else if (s[i] === '/' && !inClass) break;
      }
      while (/[a-z]/.test(s[i + 1] ?? '')) i++;
      out += ' 0 ';
      continue;
    }
    if (c === '{') stack.push('{');
    if (c === '}' && stack.at(-1) === '{') {
      stack.pop();
      if (stack.at(-1) === 'tpl') continue;
    }
    out += c;
  }
  return out;
}

const exportsOf = (s) => [...s.matchAll(/^export (?:async )?(?:function|const|let) (\w+)/gm)].map((m) => m[1]);
const owner = new Map();
for (const f of files) for (const name of exportsOf(src[f])) owner.set(name, f);

for (const f of files) {
  test(`${f} imports what it uses`, () => {
    const code = codeOnly(src[f]);
    const imported = new Set([...src[f].matchAll(/^import \{([^}]*)\} from/gm)].flatMap((m) => m[1].split(',').map((x) => x.trim())));
    const own = new Set(exportsOf(src[f]));
    const missing = [];
    for (const [name, from] of owner) {
      if (from === f || own.has(name) || imported.has(name)) continue;
      // Used as a name (or spread with ...name), not as a property (.name) or a local of the same name.
      // (An object key like { speed: ... } is not a use.)
      const used = new RegExp(`(^|[^\\w$.]|\\.\\.\\.)${name}(?![\\w$])(?!\\s*:(?!:))`).test(code);
      const local = new RegExp(`(const|let|var|function)\\s+${name}\\b|[({,]\\s*${name}\\s*[,)=}]`).test(code);
      if (used && !local) missing.push(`${name} (from ${from})`);
    }
    assert.deepEqual(missing, []);
  });
}
