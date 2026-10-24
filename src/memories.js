import { fishById } from './fish.js';
import { TACKLE } from './tackle.js';
import { PLACES } from './world/terrain.js';
import { formatClock } from './world/sky.js';
import { PHOTO_MAX } from './save.js';
import { ADVENTURES, KEEPSAKES, PAGES } from './adventures.js';
import { TENTS } from './campsite.js';

// The journal's Memories pages: your photographs, the adventures you've come across and what
// they left you, your marks on the map (favourite spots with what they've given you), your camp,
// and the landmarks you've found, each with the catches made there and the tackle that worked.

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function btn(text, run, cls = 'pk-btn quiet') {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    run();
  });
  return b;
}
const whenText = (r) => (r ? `day ${r.day}, ${formatClock(r.hour)}` : '');

// Catches near a point, and what they say: how many, the best, the tackle that took most.
export function catchesNear(log, x, z, r = 40, placeName = null) {
  const list = log.filter((e) => (e.x != null && Math.hypot(e.x - x, e.z - z) < r) || (placeName && e.place === placeName));
  const best = list.reduce((b, e) => (!b || e.size > b.size ? e : b), null);
  const by = {};
  for (const e of list) if (e.item) by[e.item] = (by[e.item] || 0) + 1;
  const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
  return { n: list.length, best, tackle: top ? { id: top[0], n: top[1] } : null };
}

export function linkText(c) {
  if (!c.n) return 'Nothing caught here yet.';
  const best = c.best ? `best: ${fishById[c.best.sp]?.name.toLowerCase() || c.best.sp}, ${c.best.size} cm` : '';
  const tk = c.tackle && TACKLE[c.tackle.id] ? `; ${c.tackle.n} on ${TACKLE[c.tackle.id].on}` : '';
  return `${c.n} caught here (${best}${tk}).`;
}

export class Memories {
  // hooks: { photos (PhotoStore), adventures, showOnMap(x, z), removePhoto(id), renamePhoto(id, t),
  //          downloadPhoto(id), downloadAlbum(), editPin(pin), deletePin(id), markHere(), pinWall(id),
  //          takePhoto(), photoHint() }
  constructor(state, hooks) {
    this.state = state;
    this.h = hooks;
    $('mem-take').addEventListener('click', () => hooks.takePhoto());
    $('mem-album-dl').addEventListener('click', () => hooks.downloadAlbum());
    $('mem-mark-here').addEventListener('click', () => hooks.markHere());
    $('mem-viewer-close').addEventListener('click', () => this.closeViewer());
    $('mem-viewer').addEventListener('click', (e) => { if (e.target === $('mem-viewer')) this.closeViewer(); });
  }

  render() {
    this.renderPhotos();
    this.renderAdventures();
    this.renderMarks();
    this.renderCamp();
    this.renderPlaces();
  }

  renderPhotos() {
    const st = this.state, list = [...st.photos].reverse();
    $('mem-photo-count').textContent = `${st.photos.length} of ${PHOTO_MAX}`;
    $('mem-photo-note').textContent = !this.h.photos.persistent
      ? 'This browser isn’t keeping pictures between visits (a private window?): download the ones you want before you go.'
      : st.photos.length >= PHOTO_MAX ? 'The album is full: download or delete some to make room.' : this.h.photoHint();
    $('mem-album-dl').disabled = !st.photos.length;
    const grid = $('mem-photos');
    if (!list.length) {
      grid.replaceChildren(el('p', 'j-empty', 'No photographs yet.'));
      return;
    }
    grid.replaceChildren(...list.map((p) => {
      const f = el('button', 'mem-photo');
      f.type = 'button';
      f.setAttribute('aria-label', `Photograph: ${p.title || 'untitled'}`);
      const img = el('img');
      img.alt = '';
      img.loading = 'lazy';
      this.h.photos.url(p.id, 'thumb').then((u) => {
        if (u) img.src = u;
        else f.classList.add('away');
      });
      f.append(img, el('span', '', p.title || whenText(p)));
      f.addEventListener('click', () => this.openViewer(p));
      return f;
    }));
  }

  describe(p) {
    const sp = p.subjects.species.map((id) => fishById[id]?.name).filter(Boolean);
    const pl = p.subjects.places.map((id) => PLACES.find((q) => q.id === id)?.name).filter(Boolean);
    const what = [...sp, ...pl, ...(p.subjects.birds ? ['gulls diving'] : [])];
    return `Day ${p.day}, ${formatClock(p.hour)}${p.place ? `, ${p.place}` : ''}${what.length ? `. In the picture: ${what.join(', ')}` : ''}.`;
  }

  async openViewer(p) {
    const v = $('mem-viewer');
    v.hidden = false;
    $('mem-viewer-img').src = (await this.h.photos.url(p.id, 'blob')) || (await this.h.photos.url(p.id, 'thumb')) || '';
    $('mem-viewer-img').alt = p.title || 'A photograph';
    const title = $('mem-viewer-title');
    title.value = p.title || '';
    title.onchange = () => {
      this.h.renamePhoto(p.id, title.value);
      this.renderPhotos();
    };
    $('mem-viewer-text').textContent = this.describe(p);
    const acts = [btn('Download', () => this.h.downloadPhoto(p.id)), btn('Show where on the map', () => { this.closeViewer(); this.h.showOnMap(p.x, p.z); })];
    if (this.h.canPinWall(p)) acts.push(btn('Pin it up on the chandlery wall', () => { this.h.pinWall(p.id); this.closeViewer(); }, 'pk-btn'));
    acts.push(btn('Delete…', () => {
      const yes = $('mem-viewer-acts').querySelector('.mem-really');
      if (yes) {
        this.h.removePhoto(p.id);
        this.closeViewer();
        this.renderPhotos();
      } else {
        const b = btn('Yes, delete it', () => {
          this.h.removePhoto(p.id);
          this.closeViewer();
          this.renderPhotos();
        }, 'pk-btn mem-really');
        $('mem-viewer-acts').append(b);
      }
    }));
    $('mem-viewer-acts').replaceChildren(...acts);
  }

  closeViewer() {
    $('mem-viewer').hidden = true;
  }

  renderAdventures() {
    const adv = this.h.adventures, st = this.state;
    const out = [];
    for (const { A, r } of adv.list()) {
      const box = el('div', `mem-adv ${r.done ? 'done' : ''}`);
      box.append(el('h4', '', `${A.title}${r.done ? ' ✓' : ''}`));
      if (r.clue) box.append(el('p', 'mem-clue', A.clue));
      else box.append(el('p', 'mem-clue', 'Something you’ve come across, though you don’t yet know its story.'));
      const ul = el('ul', 'mem-steps');
      for (const S of A.steps) {
        const done = r.steps[S.id];
        if (!done && !r.clue) continue;
        const li = el('li', done ? 'on' : '', `${done ? '✓' : '○'} ${S.text}${done ? ` (${whenText(done)})` : ''}`);
        if (done && A.id === 'notebook' && PAGES[S.id]) {
          li.append(btn('Read', () => this.h.readPage(S.id)));
        }
        ul.append(li);
      }
      box.append(ul);
      if (r.done) box.append(el('p', 'mem-end', A.end));
      out.push(box);
    }
    const left = ADVENTURES.length - adv.list().length;
    if (!out.length) out.push(el('p', 'j-empty', 'Nothing yet. The notice board at Willowhaven is a good place to start, and there’s more to find round the cove.'));
    else if (left) out.push(el('p', 'j-faint', `${left} more to come across.`));
    const keeps = Object.entries(st.keepsakes || {}).filter(([k]) => KEEPSAKES[k]);
    if (keeps.length) {
      out.push(el('h3', '', 'Keepsakes'));
      for (const [k, r] of keeps) {
        const d = el('div', 'mem-keep');
        d.append(el('b', '', KEEPSAKES[k].name), el('span', '', ` · ${whenText(r)}`), el('p', '', KEEPSAKES[k].text));
        out.push(d);
      }
    }
    $('mem-adv').replaceChildren(...out);
  }

  renderMarks() {
    const st = this.state, out = [];
    const pins = [...st.pins].sort((a, b) => b.fav - a.fav);
    if (!pins.length) out.push(el('p', 'j-empty', 'No marks yet. Open the map and choose “Mark a spot”, or mark where you’re standing.'));
    for (const p of pins) {
      const d = el('div', 'mem-mark');
      d.append(el('b', '', `${p.fav ? '★ ' : '⚑ '}${p.title || 'A mark'}`));
      if (p.note) d.append(el('p', '', p.note));
      d.append(el('p', 'mem-link', linkText(catchesNear(st.log, p.x, p.z, 40))));
      const acts = el('div', 'mem-acts');
      acts.append(btn('On the map', () => this.h.showOnMap(p.x, p.z)), btn('Edit', () => this.h.editPin(p)));
      d.append(acts);
      out.push(d);
    }
    $('mem-marks').replaceChildren(...out);
  }

  renderCamp() {
    const st = this.state, out = [];
    if (!st.camps.length) out.push(el('p', 'j-empty', 'Your camping kit is rolled up in your backpack.'));
    for (const c of st.camps) {
      const d = el('div', 'mem-mark');
      d.append(el('b', '', `⛺ ${c.name}`), el('p', '', `${TENTS[c.tent]?.name || ''} tent, pitched day ${c.pitched.day} at ${formatClock(c.pitched.hour)}. ${c.visits ? `Back ${c.visits} time${c.visits === 1 ? '' : 's'}. ` : ''}${c.store.fish.length} fish in the cool box.`));
      d.append(el('p', 'mem-link', linkText(catchesNear(st.log, c.x, c.z, 60))));
      const acts = el('div', 'mem-acts');
      acts.append(btn('On the map', () => this.h.showOnMap(c.x, c.z)));
      d.append(acts);
      out.push(d);
    }
    $('mem-camp').replaceChildren(...out);
  }

  renderPlaces() {
    const st = this.state, out = [];
    const found = PLACES.filter((p) => st.places[p.id]).sort((a, b) => (st.places[b.id].day - st.places[a.id].day) || (st.places[b.id].hour - st.places[a.id].hour));
    for (const p of found) {
      const d = el('div', 'mem-place');
      d.append(el('b', '', p.name), el('span', 'j-faint', ` · found ${whenText(st.places[p.id])}`));
      const c = catchesNear(st.log, p.x, p.z, p.area ? 0 : 45, p.name);
      d.append(el('p', 'mem-link', linkText(c)));
      out.push(d);
    }
    if (!out.length) out.push(el('p', 'j-empty', 'Nowhere yet.'));
    $('mem-places').replaceChildren(...out);
  }
}
