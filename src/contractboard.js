// The work on Willowhaven's notice board (see contracts.js): today's offers, each with who it's for,
// what to do and where, what to take, how hard and how long, what it pays and whether friends can
// help; and the jobs you've taken, where each stands, to give up or be paid for.
//
// It only draws and says what was chosen: hooks.take(id), hooks.drop(id), hooks.claim(id).

import { CATEGORIES, GIVERS, CONTRACT_MAX, standing } from './contracts.js';

// (G4) A giver's standing on a job's line: "(trusted)", nothing while you're new to them.
const withThem = (S) => (S && S.id !== 'new' ? ` (you're ${S.name})` : '');

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const button = (text, cls, run) => {
  const b = el('button', `pk-btn ${cls || ''}`, text);
  b.type = 'button';
  b.addEventListener('click', run);
  return b;
};
const dots = (n) => '●'.repeat(n) + '○'.repeat(3 - n);

// root: the element to fill; offers, active: from contracts.js; money(v): how a sum is written;
// payOf(a): what a finished job pays now (with any bonus); career: contracts.js's career(C).
export function renderWork(root, { offers, active, money, payOf, hooks, career = null, done = 0, standingOf = null }) {
  const out = [];
  if (career) {
    const { rank, next, toGo } = career;
    const p = el('p', 'board-career');
    p.append(el('b', '', rank.name), el('span', 'j-faint', ` · ${done} job${done === 1 ? '' : 's'} done${next ? ` · ${next.name} after ${toGo} more: ${next.says}` : ': trusted with anything on the board'}`));
    out.push(p);
  }
  if (active.length) {
    out.push(el('h4', 'board-work-h', `Your jobs (${active.length} of ${CONTRACT_MAX})`));
    for (const a of active) {
      const d = el('div', `board-job mine${a.ready ? ' ready' : ''}`);
      d.append(el('b', '', a.title), el('span', 'j-faint', ` · ${CATEGORIES[a.cat]} · for ${GIVERS[a.giver]}${withThem(standingOf?.(a.giver))}`));
      d.append(el('p', '', standing(a)));
      const acts = el('div', 'cp-row');
      if (a.ready && !a.onSpot) acts.append(button(`Collect ${money(payOf(a))}`, '', () => hooks.claim(a.id)));
      else acts.append(button('Give it up', 'quiet', () => hooks.drop(a.id)));
      d.append(acts);
      out.push(d);
    }
  }
  out.push(el('h4', 'board-work-h', offers.length ? 'Work going today' : 'No work posted today'));
  if (!offers.length) out.push(el('p', 'j-faint', 'Nothing new today: come back tomorrow, or take a favour from the harbour’s people.'));
  for (const o of offers) {
    const d = el('div', 'board-job');
    const S = standingOf?.(o.giver);
    d.append(el('b', '', o.title), el('span', 'j-faint', ` · ${CATEGORIES[o.cat]} · for ${GIVERS[o.giver]}${withThem(S)}`));
    d.append(el('p', '', o.story));
    d.append(el('p', 'board-job-goal', o.goal + (o.where?.name ? ` (${o.where.name})` : '')));
    const k = S?.k || 1;
    const bits = [`${dots(o.difficulty)} ${['', 'easy', 'steady', 'demanding'][o.difficulty]}`, `about ${o.minutes} min`, `pays ${money(Math.round(o.pay * k))}${k > 1 ? ` (${Math.round((k - 1) * 100)}% more: they know your work)` : ''}`];
    if (o.rep) bits.push(`+${o.rep} standing`);
    if (o.coop) bits.push('friends can help');
    d.append(el('p', 'j-faint', bits.join(' · ')));
    const take = [o.boat && `Take ${o.boat}`, o.gear && `Bring ${o.gear}`].filter(Boolean).join('. ');
    if (take) d.append(el('p', 'j-faint', `${take}.`));
    const acts = el('div', 'cp-row');
    const full = active.length >= CONTRACT_MAX;
    const b = button(full ? `${CONTRACT_MAX} jobs on already` : 'Take it', '', () => hooks.take(o.id));
    b.disabled = full;
    acts.append(b);
    d.append(acts);
    out.push(d);
  }
  root.replaceChildren(...out);
}
