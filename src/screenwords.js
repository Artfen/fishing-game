// Less text on the screen (docs/TEXT.md): what a message puts on the screen, and what's kept whole
// for the journal. The art bible's rule (docs/ART.md): a toast two lines at most, a hint one; if it
// needs more, it belongs in the journal.
//
// A message's first sentence is its line for the screen: written so it says what matters (the
// rest, the why and the how, follows it). A message short enough is shown whole. Nothing else is
// cut: a first sentence that's still long is shown whole rather than broken off mid-thought (the
// test, tests/text.test.mjs, holds every message in the source to the rule).

// Two lines of a toast (340 px of the hand at 17 px), and one line of the hint at the bottom.
export const TOAST_MAX = 82;
export const HINT_MAX = 90;

const plain = (s) => String(s ?? '').replace(/<[^>]+>/g, '');

// The first sentence: up to the first . ! or ? that's followed by a space and a new sentence (a
// capital, a number, a quote, a bracket or a tag), or the whole if there's no such break.
export function firstSentence(text) {
  const t = String(text ?? '');
  const m = t.match(/^(.+?[.!?][”’)]?)\s+(?=[A-Z0-9“‘(<£])/s);
  return m ? m[1] : t;
}

// { screen, whole }: the words for the screen, and the whole message when that's more (else null).
export function split(text, max = TOAST_MAX) {
  const t = String(text ?? '');
  if (plain(t).length <= max) return { screen: t, whole: null };
  const first = firstSentence(t);
  return first.length < t.length ? { screen: first, whole: t } : { screen: t, whole: null };
}

// What the journal keeps of what you were told: the last TOLD_MAX, newest first.
export const TOLD_MAX = 40;
export function cleanTold(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e === 'object' && typeof e.text === 'string' && e.text.trim() && Number.isFinite(e.at))
    .slice(0, TOLD_MAX)
    .map((e) => ({ at: e.at, text: plain(e.text).slice(0, 800), ...(e.tip ? { tip: true } : {}) }));
}
// A message into the list (the same words as the newest aren't kept twice).
export function tell(list, text, at, tip = false) {
  const words = plain(text).trim();
  if (!words) return list;
  if (list[0]?.text === words) {
    list[0].at = at;
    return list;
  }
  list.unshift({ at, text: words.slice(0, 800), ...(tip ? { tip: true } : {}) });
  if (list.length > TOLD_MAX) list.length = TOLD_MAX;
  return list;
}
