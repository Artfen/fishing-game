// Less text on the screen (docs/TEXT.md, the art bible's rule in docs/ART.md): every message in the
// source, read from the source itself, puts no more on the screen than the rule allows. A toast or a
// tip two lines (its first sentence, the rest kept whole in the journal), a hint one line, a
// question or a card a handful of sentences. And the splitting itself: the first sentence on the
// screen, the whole kept, nothing cut mid-thought. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const W = await import('../src/screenwords.js');
const root = new URL('..', import.meta.url).pathname;
const SOURCES = [...fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.js')).map((f) => `src/${f}`),
  ...fs.readdirSync(path.join(root, 'src/world')).filter((f) => f.endsWith('.js')).map((f) => `src/world/${f}`)];

// The calls that put words on the screen, and which of their arguments is the message.
const CALLS = [
  { re: /hud\.toast\(/g, kind: 'toast', arg: 0 },
  { re: /this\.hooks\.toast\??\.?\(/g, kind: 'toast', arg: 0 },
  { re: /hud\.flash\(/g, kind: 'hint', arg: 0 },
  { re: /\blater\(/g, kind: 'toast', arg: 0 },
  { re: /\bteach\(/g, kind: 'tip', arg: 1 },
  { re: /\bask\(/g, kind: 'ask', arg: 1 },
  { re: /\bshowNote\(/g, kind: 'note', arg: 1 },
];
// What fits: on the screen (characters of what's shown), and in a question or a card (sentences).
const MAX = { toast: W.TOAST_MAX, tip: W.TOAST_MAX, hint: W.HINT_MAX };
const SENTENCES = { ask: 6, note: 5 };
// Pages you stop to read, not messages over the sea (a card's limit doesn't apply): each with why.
const PAGES = new Set([
  'The bothy book', // a page of visitors' entries, scrolled in its card (docs/NORTH.md)
]);

// A call's arguments, split at the top level (strings, templates and brackets honoured).
function args(src, i) {
  const out = [];
  let depth = 0, cur = '';
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === "'" || c === '"') {
      let k = j + 1;
      while (k < src.length && src[k] !== c) { if (src[k] === '\\') k++; k++; }
      cur += src.slice(j, k + 1); j = k; continue;
    }
    if (c === '`') {
      let k = j + 1, d = 0;
      while (k < src.length) {
        if (src[k] === '\\') { k += 2; continue; }
        if (src[k] === '$' && src[k + 1] === '{') { d++; k += 2; continue; }
        if (src[k] === '}' && d > 0) { d--; k++; continue; }
        if (src[k] === '`' && d === 0) break;
        k++;
      }
      cur += src.slice(j, k + 1); j = k; continue;
    }
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) { if (depth === 0) { out.push(cur.trim()); break; } depth--; }
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  return out;
}
// The words of a message: each string or template at the top of its expression (a ?: between
// two: each is checked), a template's ${…} read as the longest words inside it (a ?: there shows one
// of them), or as eight characters when it's a value.
function scan(src, i, quote) {
  // From just after an opening quote: { text, end } (end: the index of the closing quote).
  let text = '', k = i;
  while (k < src.length) {
    const c = src[k];
    if (c === '\\') { text += src[k + 1] === 'n' ? '\n' : src[k + 1]; k += 2; continue; }
    if (c === quote) return { text, end: k };
    if (quote === '`' && c === '$' && src[k + 1] === '{') {
      const e = exprEnd(src, k + 2);
      text += longest(src.slice(k + 2, e));
      k = e + 1;
      continue;
    }
    text += c;
    k++;
  }
  return { text, end: k };
}
// The index of the } that closes an expression starting at i.
function exprEnd(src, i) {
  let d = 0, k = i;
  while (k < src.length) {
    const c = src[k];
    if (c === "'" || c === '"' || c === '`') { k = scan(src, k + 1, c).end + 1; continue; }
    if (c === '{') d++;
    if (c === '}') { if (d === 0) return k; d--; }
    k++;
  }
  return k;
}
// The literals at the top of an expression (not inside a template's ${…}).
function literals(expr) {
  const out = [];
  let k = 0;
  while (k < expr.length) {
    const c = expr[k];
    if (c === "'" || c === '"' || c === '`') {
      const r = scan(expr, k + 1, c);
      out.push(r.text);
      k = r.end + 1;
      continue;
    }
    k++;
  }
  return out;
}
function longest(expr) {
  // (A single word is a key's name or a setting, 'anchor' or 'touch': words have spaces.)
  const L = literals(expr).filter((t) => /[A-Za-z]/.test(t) && /\s/.test(t.trim()));
  return L.length ? L.reduce((a, b) => (b.length > a.length ? b : a)) : 'XXXXXXXX';
}
function texts(expr) {
  return literals(expr).filter((t) => /[a-z]{3}/.test(t));
}
function messages() {
  const out = [];
  for (const f of SOURCES) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    for (const C of CALLS) {
      C.re.lastIndex = 0;
      let m;
      while ((m = C.re.exec(src))) {
        if (/function\s+$/.test(src.slice(Math.max(0, m.index - 12), m.index))) continue;
        const a = args(src, m.index + m[0].length);
        const title = (a[0] || '').replace(/^['"`]|['"`]$/g, '');
        const line = src.slice(0, m.index).split('\n').length;
        for (const t of texts(a[C.arg] || '')) out.push({ at: `${f}:${line}`, kind: C.kind, title, text: t });
      }
    }
  }
  return out;
}
const sentences = (t) => (t.match(/[.!?][”’)]?(\s|$)/g) || []).length;

test('the splitting: the first sentence on the screen, the whole kept, short ones whole, nothing cut mid-thought', () => {
  assert.deepEqual(W.split('Short and done.'), { screen: 'Short and done.', whole: null });
  const t = 'Tacked: the bow went through the wind and the boom came across. Sail on, close-hauled the other way.';
  assert.deepEqual(W.split(t), { screen: 'Tacked: the bow went through the wind and the boom came across.', whole: t });
  // (A number, a decimal, a quotation: not a sentence's end.)
  assert.equal(W.firstSentence('She makes 8.5 knots at full ahead, and the rest. More.'), 'She makes 8.5 knots at full ahead, and the rest.');
  assert.equal(W.firstSentence('“Hello there.” Then she was gone.'), '“Hello there.”');
  // One long sentence: shown whole rather than broken off.
  const long = 'A single sentence that runs on and on past two lines of a toast because nobody stopped it in time';
  assert.deepEqual(W.split(long), { screen: long, whole: null });
  // A key chip in a hint isn't counted as words.
  assert.equal(W.split(`Press <kbd>E</kbd> to step ashore.`, W.HINT_MAX).whole, null);
  // The journal's list: newest first, the same words not kept twice in a row, forty at most.
  const L = [];
  W.tell(L, 'One.', 1);
  W.tell(L, 'Two.', 2, true);
  W.tell(L, 'Two.', 3, true);
  assert.deepEqual(L, [{ at: 3, text: 'Two.', tip: true }, { at: 1, text: 'One.' }]);
  for (let i = 0; i < 60; i++) W.tell(L, `Message ${i}.`, 10 + i);
  assert.equal(L.length, W.TOLD_MAX);
  assert.deepEqual(W.cleanTold([...L, { at: 'x', text: 'bad' }, null, { at: 4, text: '' }]).length, W.TOLD_MAX);
});

test('every message in the source puts no more on the screen than the rule allows', () => {
  const all = messages();
  assert.ok(all.length > 500, `found ${all.length} messages`);
  const over = [];
  for (const m of all) {
    if (MAX[m.kind]) {
      // (A message that begins with a value and then a new sentence: the value is a sentence of
      // its own, a tip or a line held in a variable, and that's what's shown.)
      if (/^XXXXXXXX\s+[A-Z(]/.test(m.text)) continue;
      const shown = W.split(m.text, MAX[m.kind]).screen.replace(/<[^>]+>/g, '');
      if (shown.length > MAX[m.kind]) over.push(`${m.at} ${m.kind} ${shown.length}: ${shown.slice(0, 110)}`);
    } else if (SENTENCES[m.kind] && !PAGES.has(m.title)) {
      const n = sentences(m.text);
      if (n > SENTENCES[m.kind]) over.push(`${m.at} ${m.kind} ${n} sentences: ${m.text.slice(0, 110)}`);
    }
  }
  assert.deepEqual(over, [], `${over.length} messages over the rule:\n${over.join('\n')}`);
});

test('the first sight of anything has a line of its own for the screen; what you only hear, the same', async () => {
  const { SEA_LIFE } = await import('../src/world/sealife.js');
  const { SEEN, seenLine } = await import('../src/seenWords.js');
  const over = [];
  for (const [k, v] of Object.entries(SEA_LIFE)) {
    assert.ok(SEEN[k], `${k}: a line for the screen`);
    if (SEEN[k].length > W.TOAST_MAX) over.push(`${k}: ${SEEN[k]}`);
    // (The line is what's shown: the whole note comes after it, into the journal.)
    assert.equal(W.split(`${seenLine(k, v.name)} ${v.note}`).screen, SEEN[k], k);
    if (v.heard && W.split(v.heard).screen.length > W.TOAST_MAX) over.push(`${k} heard: ${v.heard}`);
  }
  assert.deepEqual(over, []);
  assert.equal(seenLine('nothing', 'Sea monsters'), 'New in your notes: sea monsters.');
});
