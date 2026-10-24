// Your photographs. The pictures themselves are JPEGs kept in the browser's own database
// (IndexedDB), never in the save: the save only lists them (title, when, where, what's in them),
// so it stays small and quick to sync. The album holds PHOTO_MAX; beyond that you're asked to
// download or delete some first. Each one downloads as a JPEG, and the whole album as a single
// web page you can keep. Where the browser has no database (some private windows), photos last
// until you close the tab, and the album says so.

export const PHOTO_W = 1280;   // pixels along the longer side (the other follows the screen's shape)
export const THUMB_W = 320;

const DB = 'slow-tide-photos', STORE = 'photos';

export class PhotoStore {
  constructor() {
    this.mem = new Map();
    this.urls = new Map();
    this.persistent = false;
    this.ready = this.open();
  }

  open() {
    return new Promise((resolve) => {
      let req;
      try {
        req = indexedDB.open(DB, 1);
      } catch {
        resolve(false);
        return;
      }
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => {
        this.db = req.result;
        this.persistent = true;
        resolve(true);
      };
      req.onerror = () => resolve(false);
      req.onblocked = () => resolve(false);
    });
  }

  tx(mode, fn) {
    return new Promise((resolve) => {
      try {
        const t = this.db.transaction(STORE, mode);
        const r = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(r?.result ?? true);
        t.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async put(id, blob, thumb) {
    await this.ready;
    this.mem.set(id, { id, blob, thumb });
    if (this.db) await this.tx('readwrite', (s) => s.put({ id, blob, thumb }));
  }

  async get(id) {
    await this.ready;
    if (this.mem.has(id)) return this.mem.get(id);
    if (!this.db) return null;
    const r = await this.tx('readonly', (s) => s.get(id));
    if (r && r.id) this.mem.set(id, r);
    return r && r.id ? r : null;
  }

  async remove(id) {
    await this.ready;
    this.mem.delete(id);
    for (const k of ['thumb', 'blob']) {
      const u = this.urls.get(`${id}:${k}`);
      if (u) URL.revokeObjectURL(u);
      this.urls.delete(`${id}:${k}`);
    }
    if (this.db) await this.tx('readwrite', (s) => s.delete(id));
  }

  // An object URL for a photo's picture ('thumb' or 'blob'), or null if it isn't on this device.
  async url(id, which = 'thumb') {
    const key = `${id}:${which}`;
    if (this.urls.has(key)) return this.urls.get(key);
    const r = await this.get(id);
    if (!r?.[which]) return null;
    const u = URL.createObjectURL(r[which]);
    this.urls.set(key, u);
    return u;
  }
}

// Take the picture: draw a fresh frame, then copy it straight off the canvas (in the same moment,
// before the browser clears it) into a JPEG and a small thumbnail.
export async function capture(canvas, drawFrame) {
  drawFrame();
  const k = Math.min(1, PHOTO_W / Math.max(canvas.width, canvas.height));
  const big = document.createElement('canvas');
  big.width = Math.round(canvas.width * k);
  big.height = Math.round(canvas.height * k);
  big.getContext('2d').drawImage(canvas, 0, 0, big.width, big.height);
  const t = THUMB_W / Math.max(big.width, big.height);
  const small = document.createElement('canvas');
  small.width = Math.round(big.width * t);
  small.height = Math.round(big.height * t);
  small.getContext('2d').drawImage(big, 0, 0, small.width, small.height);
  const blob = await new Promise((r) => big.toBlob(r, 'image/jpeg', 0.84));
  const thumb = await new Promise((r) => small.toBlob(r, 'image/jpeg', 0.8));
  return { blob, thumb, preview: small.toDataURL('image/jpeg', 0.8) };
}

export function photoId() {
  return `ph-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

const blobToDataURL = (b) => new Promise((r) => {
  const fr = new FileReader();
  fr.onload = () => r(fr.result);
  fr.onerror = () => r(null);
  fr.readAsDataURL(b);
});

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// The album as one web page (pictures inside it), to keep or share.
export async function albumPage(store, photos, describe) {
  const items = [];
  for (const p of photos) {
    const r = await store.get(p.id);
    const src = r?.blob ? await blobToDataURL(r.blob) : null;
    items.push(`<figure>${src ? `<img src="${src}" alt="${esc(p.title || 'A photograph')}">` : '<div class="gone">(taken on another device)</div>'}<figcaption><b>${esc(p.title || 'Untitled')}</b><br>${esc(describe(p))}</figcaption></figure>`);
  }
  return `<!doctype html><meta charset="utf-8"><title>Slow Tide: my album</title>
<style>body{margin:0;padding:24px;background:#efe3c6;color:#35291f;font:16px/1.4 Georgia,serif}h1{font-weight:normal}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:22px}figure{margin:0;background:#fbf8f0;padding:10px 10px 14px;box-shadow:0 2px 8px rgba(0,0,0,.15)}
img{width:100%;display:block}.gone{aspect-ratio:16/9;display:grid;place-items:center;background:#ddd2b8}figcaption{margin-top:8px;font-size:14px}</style>
<h1>My Slow Tide album</h1><main>${items.join('\n')}</main>`;
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}
