// The game's words, as its books of Spanish and French have them (docs/LANGUAGES.md): every
// $t('…') and $t`…` in src, each as its key (its English, the parts of a $t`…` numbered {0}, {1}…),
// and the page's own words (index.html). Used by tests/i18n.test.mjs; run it to see what the
// books are missing:
//
//   node tools/i18n-keys.mjs            (counts, and the first keys missing from each book)
//   node tools/i18n-keys.mjs --missing  (every missing key, as JSON: ready to translate)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// A string literal starting at i ('…' or "…"): its value and where it ends.
function stringAt(src, i) {
  const q = src[i];
  let out = '', j = i + 1;
  for (; j < src.length && src[j] !== q; j++) {
    if (src[j] === '\\') {
      j++;
      const c = src[j];
      if (c === 'n') out += '\n';
      else if (c === 't') out += '\t';
      else if (c === 'u') {
        const m = src.slice(j + 1).match(/^\{([0-9a-fA-F]+)\}|^([0-9a-fA-F]{4})/);
        out += String.fromCodePoint(parseInt(m[1] || m[2], 16));
        j += m[0].length;
      } else if (c === '\n') { /* a line continued */ } else out += c;
    } else out += src[j];
  }
  return { value: out, end: j + 1 };
}

// A template literal starting at the backtick at i: its pieces between the ${…} and where it ends.
function templateAt(src, i) {
  const parts = [];
  let cur = '', j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '`') { parts.push(cur); return { parts, end: j + 1 }; }
    if (c === '\\') {
      const d = src[j + 1];
      if (d === 'n') cur += '\n';
      else if (d === 't') cur += '\t';
      else if (d === 'u') {
        const m = src.slice(j + 2).match(/^\{([0-9a-fA-F]+)\}|^([0-9a-fA-F]{4})/);
        cur += String.fromCodePoint(parseInt(m[1] || m[2], 16));
        j += m[0].length;
      } else cur += d;
      j += 2;
      continue;
    }
    if (c === '$' && src[j + 1] === '{') {
      parts.push(cur);
      cur = '';
      j = skipExpr(src, j + 2);
      continue;
    }
    cur += c;
    j++;
  }
  throw new Error(`unterminated template at ${i}`);
}

// Past a ${…} expression (strings, templates and braces inside it), to just after its }.
function skipExpr(src, j) {
  let depth = 1;
  while (j < src.length) {
    const c = src[j];
    if (c === "'" || c === '"') { j = stringAt(src, j).end; continue; }
    if (c === '`') { j = templateAt(src, j).end; continue; }
    if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); continue; }
    if (c === '/' && src[j + 1] === '*') { j = src.indexOf('*/', j) + 2; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return j + 1;
    j++;
  }
  throw new Error('unterminated ${');
}

export const keyOf = (parts) => parts.reduce((k, p, i) => k + (i ? `{${i - 1}}` : '') + p, '');

// Every key in one file's source.
export function keysIn(src) {
  const out = [];
  const re = /\$t(\(\s*['"]|`)/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const at = m.index + 2;
    if (m[1] === '`') out.push(keyOf(templateAt(src, at).parts));
    else out.push(stringAt(src, m.index + m[0].length - 1).value);
  }
  return out;
}

// The page's own words, as translatePage reads them (src/i18n.js).
export function pageKeys(html) {
  const body = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<kbd[^>]*>[\s\S]*?<\/kbd>/g, '<kbd></kbd>').replace(/<select[^>]*data-i18n-skip[\s\S]*?<\/select>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const ent = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&times;/g, '×').replace(/&middot;/g, '·').replace(/&hellip;/g, '…');
  const out = [];
  for (const m of body.split(/<[^>]+>/)) {
    const k = ent(m).replace(/\s+/g, ' ').trim();
    if (/[A-Za-z]{2}/.test(k)) out.push(k);
  }
  for (const m of body.matchAll(/\s(aria-label|title|placeholder|alt)="([^"]*)"/g)) if (/[A-Za-z]{2}/.test(m[2])) out.push(ent(m[2]));
  return out;
}

// Every key the game has: { key: the file it's first in }.
export function allKeys(root = ROOT) {
  const keys = new Map();
  const scan = (d) => {
    for (const f of fs.readdirSync(path.join(root, d), { withFileTypes: true })) {
      const p = `${d}/${f.name}`;
      if (f.isDirectory()) { if (f.name !== 'i18n') scan(p); } else if (f.name.endsWith('.js') && p !== 'src/i18n.js') {
        const src = fs.readFileSync(path.join(root, p), 'utf8');
        if (src.includes('$t')) for (const k of keysIn(src)) if (k.trim() && !keys.has(k)) keys.set(k, p);
      }
    }
  };
  scan('src');
  for (const k of pageKeys(fs.readFileSync(path.join(root, 'index.html'), 'utf8'))) if (!keys.has(k)) keys.set(k, 'index.html');
  return keys;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const keys = allKeys();
  const books = {};
  for (const l of ['es', 'fr']) books[l] = (await import(path.join(ROOT, 'src/i18n', `${l}.js`))).default;
  const missing = [...keys].filter(([k]) => !(k in books.es) || !(k in books.fr)).map(([k, f]) => ({ k, f }));
  if (process.argv.includes('--missing')) console.log(JSON.stringify(missing, null, 1));
  else {
    console.log(`${keys.size} keys · Spanish ${keys.size - [...keys.keys()].filter((k) => !(k in books.es)).length} · French ${keys.size - [...keys.keys()].filter((k) => !(k in books.fr)).length}`);
    for (const m of missing.slice(0, 20)) console.log(`missing: ${JSON.stringify(m.k).slice(0, 100)} (${m.f})`);
  }
}
