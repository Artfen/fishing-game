// Privacy and the online services (docs/ONLINE.md): the privacy page lists everything the game keeps
// on your device (read from the code, so a new key can't go unmentioned), and says what cloud saves
// and playing together send; the cloud gives you your save, and deletes it with your account (or
// your save alone, on a backend set up before that); the database lets only the signed-in player
// delete their own; and a paused or full service is said in plain words. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const page = read('privacy.html');

test('the privacy page names everything the game keeps on your device, read from the code itself', () => {
  const src = [...fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.js')).map((f) => read(`src/${f}`)), read('desktop/main.cjs'), read('desktop/updates.cjs'), read('sw.js')].join('\n');
  // Every slow-tide-… name in a string in the code: a storage key, a database, a cache, a file.
  const names = new Set([...src.matchAll(/['`](slow-tide-[a-z0-9-]+)(?:\$\{[^}]*\})?['`:]/g)].map((m) => m[1]));
  // (Not kept anywhere: names for what you download, the benchmark's own save, the storage probe
  // that's written and removed at once, the cache prefix, and a friend code's fingerprint text,
  // which is hashed, not stored: the fingerprints themselves are in the save.)
  const NOT_KEPT = /^slow-tide-(day|album|game|cloud-save|bench|bench-results|test|gift)$|^slow-tide-$|^slow-tide-(day|album|game|cloud-save)-/;
  const save = ['slow-tide-save', 'slow-tide-save-backup', 'slow-tide-save-unreadable', 'slow-tide-save-before-new-game', 'slow-tide-save-v1'];
  const missing = [...new Set([...names, ...save])].filter((n) => !NOT_KEPT.test(n) && !page.includes(n));
  assert.deepEqual(missing, [], 'every key on the page');
  for (const n of ['slow-tide-slots', 'slow-tide-slot-2', 'slow-tide-slot-3', 'slow-tide-photos', 'slow-tide-cloud', 'slow-tide-session', 'slow-tide-offline-ready']) assert.ok(page.includes(n), n);
  // The desktop app's files too.
  for (const f of ['slow-tide-save.json', 'settings.json', 'updates.log']) assert.ok(page.includes(f), f);
  // What the online services send, and what's not done.
  for (const words of ['email address', 'Supabase', 'real-time', 'isn’t written to any database', 'no cookies', 'no analytics', 'Download my cloud save', 'Delete my cloud data', 'GitHub']) assert.ok(page.toLowerCase().includes(words.toLowerCase()), words);
  // The blanks for whoever runs it, marked so they can't be missed.
  assert.ok((page.match(/class="fill"/g) || []).length >= 4);
  // Linked from the game, its journal and the download page.
  assert.ok(read('index.html').includes('href="privacy.html"'));
  assert.ok(read('download.html').includes('href="privacy.html"'));
  assert.ok(read('src/main.js').includes("href: 'privacy.html'"));
});

// A stand-in for the browser and the Supabase API, enough for the cloud's own requests.
globalThis.location ??= { origin: 'https://slowtide.example', pathname: '/', search: '', hash: '' };
globalThis.history ??= { replaceState() {} };
globalThis.navigator ??= { onLine: true };
let calls = [], reply = () => ({ status: 200, json: [] });
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url: String(url), method: opts.method || 'GET', auth: opts.headers?.Authorization || '' });
  const r = reply(String(url), opts.method || 'GET');
  return { ok: r.status < 300, status: r.status, text: async () => (r.json === undefined ? '' : JSON.stringify(r.json)), headers: { get: () => 'application/json' } };
};
const { Cloud, explainCloud } = await import('../src/cloud.js');
const { parseSave, sanitize, DEFAULT_STATE, envelope } = await import('../src/save.js');
function signedIn() {
  const C = new Cloud();
  C.cfg = { url: 'https://abc.supabase.co', anonKey: 'anon' };
  C.session = { access_token: 'tok', refresh_token: 'r', expires_at: Date.now() / 1000 + 3600, user: { id: 'u-1', email: 'player@example.com' }, rev: 3 };
  C.state = 'signedIn';
  return C;
}

test('your cloud save, as a file you can load again', async () => {
  const s = sanitize(structuredClone(DEFAULT_STATE));
  s.day = 12;
  const env = envelope(s);
  reply = (url) => (url.includes('/rest/v1/slow_tide_saves') ? { status: 200, json: [{ version: env.version, saved_at: '2026-11-19T10:00:00Z', data: env.data }] } : { status: 200, json: [] });
  const C = signedIn();
  calls = [];
  const text = await C.exportCloud();
  assert.equal(parseSave(text).state.day, 12, 'the same form as Download a copy');
  assert.ok(calls[0].url.includes('user_id=eq.u-1') && calls[0].auth === 'Bearer tok', 'only your own, signed in');
  reply = () => ({ status: 200, json: [] });
  assert.equal(await signedIn().exportCloud(), null, 'none yet');
});

test('deleting your cloud data: your save and your account; on an older backend, your save, and it says what’s left', async () => {
  calls = [];
  reply = () => ({ status: 204 });
  let C = signedIn();
  let r = await C.deleteCloud();
  assert.deepEqual(r, { ok: true, account: true });
  assert.ok(calls.some((c) => c.method === 'POST' && c.url.endsWith('/rest/v1/rpc/delete_my_account') && c.auth === 'Bearer tok'));
  assert.ok(!calls.some((c) => c.method === 'DELETE'), 'the function does it all');
  assert.equal(C.signedIn, false, 'signed out here');
  assert.equal(C.session, null);
  assert.match(C.message, /deleted/);
  // A backend set up before the function: the save alone, and a word about the email address.
  calls = [];
  reply = (url, method) => (url.includes('/rpc/') ? { status: 404, json: { message: 'Could not find the function public.delete_my_account' } } : { status: 204 });
  C = signedIn();
  r = await C.deleteCloud();
  assert.deepEqual(r, { ok: true, account: false });
  assert.ok(calls.some((c) => c.method === 'DELETE' && c.url.includes('slow_tide_saves?user_id=eq.u-1')));
  assert.match(C.message, /email address/);
  // The service not answering: nothing changed, still signed in, and the reason in plain words.
  reply = () => ({ status: 540, json: { message: 'Project paused' } });
  C = signedIn();
  await assert.rejects(() => C.deleteCloud());
  assert.equal(C.signedIn, true);
  // Signed out: nothing to delete.
  assert.deepEqual(await new Cloud().deleteCloud(), { ok: false, account: false });
});

test('a paused, full or busy service said in plain words', () => {
  assert.match(explainCloud({ status: 540, message: 'Project paused' }), /paused/);
  assert.match(explainCloud({ status: 503 }), /paused/);
  assert.match(explainCloud({ status: 402, message: 'Payment required' }), /limits/);
  assert.match(explainCloud({ status: 400, message: 'egress quota exceeded' }), /limits/);
  assert.match(explainCloud({ status: 429 }), /too many/);
  assert.equal(explainCloud({ status: 0, message: 'no connection' }), 'no connection');
  assert.equal(explainCloud({ status: 400, message: 'Bad thing' }), 'Bad thing');
});

test('the database lets a signed-in player delete their own account, and nothing else', () => {
  const sql = read('supabase/schema.sql');
  const fn = sql.slice(sql.indexOf('create or replace function public.delete_my_account'));
  assert.match(fn, /security definer/);
  assert.match(fn, /set search_path = ''/, 'no search path to hijack');
  assert.match(fn, /if auth\.uid\(\) is null then\s+raise exception/, 'refused when signed out');
  assert.match(fn, /delete from public\.slow_tide_saves where user_id = auth\.uid\(\)/);
  assert.match(fn, /delete from auth\.users where id = auth\.uid\(\)/);
  assert.doesNotMatch(fn, /delete from auth\.users(?! where id = auth\.uid\(\))/, 'only the caller');
  assert.match(fn, /revoke all on function public\.delete_my_account\(\) from anon/);
  assert.match(fn, /grant execute on function public\.delete_my_account\(\) to authenticated/);
});
