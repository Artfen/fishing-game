// Languages (docs/LANGUAGES.md): the game in English, Spanish or French.
//
// Every word the game puts on the screen is written in English in the source and passed through $t:
// $t('Pack') for a plain string, or as a tag, $t`Drop the anchor first (${key}).` for one with parts
// filled in. With Spanish or French chosen, $t looks the English up in that language's book
// (src/i18n/es.js, src/i18n/fr.js) and gives its words instead, each part ({0}, {1}…) put where
// that language wants it. Anything not in the book stays as it was, in English.
//
// The language is chosen before the game loads (src/boot.js reads it, loads the book, then the
// game), so words set up as the game starts (the fish, the places, Settings) come in it too.
// Changing it in Settings saves the game and starts it again.

export const LANGS = [['en', 'English'], ['es', 'Español'], ['fr', 'Français']];
export const LANG_IDS = LANGS.map(([id]) => id);
const KEY = 'slow-tide-lang';

let book = null;
let lang = 'en';

// The book in use (null: English).
export function setBook(code, b) {
  lang = LANG_IDS.includes(code) && b ? code : 'en';
  book = lang === 'en' ? null : b;
}
export const langNow = () => lang;

// A tag's key: its English with each part numbered, as the books have it.
export function keyOf(parts) {
  let k = parts[0];
  for (let i = 1; i < parts.length; i++) k += `{${i - 1}}${parts[i]}`;
  return k;
}

// The words, in the language chosen. (A tag's key worked out once for each place it's written.)
const KEYS = new WeakMap();
export function $t(s, ...vals) {
  if (Array.isArray(s)) {
    if (book) {
      let k = KEYS.get(s);
      if (k === undefined) KEYS.set(s, (k = keyOf(s)));
      const tr = book[k];
      if (typeof tr === 'string') return tr.replace(/\{(\d+)\}/g, (m, i) => (+i < vals.length ? String(vals[+i]) : m));
    }
    let out = s[0];
    for (let i = 1; i < s.length; i++) out += String(vals[i - 1]) + s[i];
    return out;
  }
  if (!book || typeof s !== 'string') return s;
  const tr = book[s];
  return typeof tr === 'string' ? tr : s;
}

// The language to start in: the one chosen in Settings; a new player (nothing saved yet), the
// browser's own if it's one of these; otherwise English.
export function pickLang(store = globalThis.localStorage, nav = globalThis.navigator) {
  let chosen = null, saved = false;
  try {
    chosen = store?.getItem(KEY);
    saved = !!store?.getItem('slow-tide-save');
  } catch { /* no storage */ }
  if (LANG_IDS.includes(chosen)) return chosen;
  if (saved) return 'en';
  for (const l of nav?.languages || [nav?.language || '']) {
    const code = String(l).slice(0, 2).toLowerCase();
    if (LANG_IDS.includes(code)) return code;
  }
  return 'en';
}

export function keepLang(code, store = globalThis.localStorage) {
  try { store?.setItem(KEY, code); } catch { /* no storage */ }
}

// The words already in the page (index.html: the title screen, the panels' headings and buttons),
// put into the language chosen: each piece of text, and the labels a screen reader reads.
const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
export function translatePage(root = globalThis.document?.body) {
  if (!book || !root) return;
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  for (const n of nodes) {
    const p = n.parentElement;
    if (!p || p.closest('script, style, kbd, [data-i18n-skip]')) continue;
    const raw = n.nodeValue, key = raw.replace(/\s+/g, ' ').trim();
    if (!key) continue;
    const tr = book[key];
    if (typeof tr !== 'string') continue;
    const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
    n.nodeValue = lead + tr + trail;
  }
  for (const el of root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(','))) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && typeof book[v] === 'string') el.setAttribute(a, book[v]);
    }
  }
}
