// The game's first step (docs/LANGUAGES.md): the language it's played in, and its book of words
// (src/i18n/), before anything else, so every word the game sets up as it starts comes in it.
// Then the page's own words, then the game.
import { pickLang, setBook, translatePage } from './i18n.js';

const lang = pickLang();
if (lang !== 'en') {
  try {
    const m = await import(`./i18n/${lang}.js`);
    setBook(lang, m.default);
  } catch {
    // (No book to hand, offline before it was kept: the game in English.)
    setBook('en', null);
  }
}
document.documentElement.lang = lang;
translatePage();
await import('./main.js');
