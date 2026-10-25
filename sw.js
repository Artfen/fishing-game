// Slow Tide's service worker: keeps a copy of the whole game on the device so it can be
// played offline.
//
// - On the first visit it downloads every file in FILES into a cache named after VERSION.
// - Afterwards the game loads from that cache, so it starts with or without a connection.
// - A new deployment changes VERSION (tools/build-sw.mjs works it out from the files), so
//   the browser installs the new version alongside the old one. The old version keeps
//   running until the player updates (or closes every Slow Tide tab); then the new one
//   takes over and the old cache is removed.
// - It never touches saved games: those live in the browser's local storage, not here.

// <precache> Written by tools/build-sw.mjs: do not edit by hand.
const VERSION = '136648b328ee';
const FILES = [
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './src/adventures.js',
  './src/advice.js',
  './src/anatomy.js',
  './src/anatomyAtlantic.js',
  './src/atlantic.js',
  './src/audio.js',
  './src/boat.js',
  './src/camera.js',
  './src/camp.js',
  './src/campView.js',
  './src/campsite.js',
  './src/car.js',
  './src/cloud-config.js',
  './src/cloud.js',
  './src/dive.js',
  './src/diver.js',
  './src/effects.js',
  './src/fight.js',
  './src/firstTrip.js',
  './src/firstperson.js',
  './src/fish.js',
  './src/fishing.js',
  './src/fuel.js',
  './src/gamepad.js',
  './src/gearArt.js',
  './src/gearView.js',
  './src/guide.js',
  './src/habits.js',
  './src/harbour.js',
  './src/input.js',
  './src/journal.js',
  './src/lever.js',
  './src/main.js',
  './src/map.js',
  './src/memories.js',
  './src/mooring.js',
  './src/offline.js',
  './src/outing.js',
  './src/pack.js',
  './src/photos.js',
  './src/placement.js',
  './src/post.js',
  './src/props.js',
  './src/quality.js',
  './src/register.js',
  './src/registerData.js',
  './src/rope.js',
  './src/sailing.js',
  './src/sailui.js',
  './src/save.js',
  './src/settings.js',
  './src/siteWorld.js',
  './src/sonar.js',
  './src/tackle.js',
  './src/tackleModels.js',
  './src/throttle.js',
  './src/touch.js',
  './src/trip.js',
  './src/ui.js',
  './src/util.js',
  './src/walker.js',
  './src/workbench.js',
  './src/world/calf.js',
  './src/world/caustics.js',
  './src/world/coast.js',
  './src/world/coldwater.js',
  './src/world/conditions.js',
  './src/world/ecosystem.js',
  './src/world/fell.js',
  './src/world/fishRender.js',
  './src/world/habitat.js',
  './src/world/home.js',
  './src/world/mist.js',
  './src/world/regions.js',
  './src/world/riverwater.js',
  './src/world/shore.js',
  './src/world/sky.js',
  './src/world/surface.js',
  './src/world/terrain.js',
  './src/world/underwater.js',
  './src/world/water.js',
  './src/world/waterfx.js',
  './src/world/windlines.js',
  './src/world/world.js',
  './vendor/three/three.module.min.js',
  './assets/fonts/caveat-latin.woff2',
  './assets/fonts/kalam-400-latin.woff2',
  './assets/fonts/kalam-700-latin.woff2',
  './assets/fonts/nunito-latin.woff2',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
];
// </precache>

const CACHE = `slow-tide-${VERSION}`;
const RUNTIME = 'slow-tide-runtime'; // small extras, such as the cloud save settings

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Straight from the network, not the browser's ordinary cache, so every file is this version.
    await Promise.all(FILES.map(async (file) => {
      const res = await fetch(new Request(file, { cache: 'reload' }));
      if (!res.ok) throw new Error(`${file}: ${res.status}`);
      await cache.put(file, res);
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('slow-tide-') && key !== CACHE && key !== RUNTIME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'update') self.skipWaiting();
  if (msg.type === 'status') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const keys = await cache.keys();
      event.source?.postMessage({ type: 'status', version: VERSION, cached: keys.length, total: FILES.length });
    })());
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // other sites (a cloud save backend) go straight to the network

  // The cloud save settings: fresh when online, the last known answer when offline.
  if (url.pathname.endsWith('/api/cloud-config')) {
    event.respondWith((async () => {
      const runtime = await caches.open(RUNTIME);
      try {
        const res = await fetch(req);
        if (res.ok) await runtime.put(url.pathname, res.clone());
        return res;
      } catch {
        return (await runtime.match(url.pathname)) || new Response('{"enabled":false}', { headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Opening the game (with or without ?something on the address): the stored page.
    if (req.mode === 'navigate' && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) {
      const page = await cache.match('./index.html');
      if (page) return page;
    }
    const hit = await cache.match(req);
    if (hit) return hit;
    // Not part of the game files: try the network, and remember it for next time.
    const runtime = await caches.open(RUNTIME);
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') await runtime.put(req, res.clone());
      return res;
    } catch {
      const kept = await runtime.match(req);
      if (kept) return kept;
      throw new Error('offline and not stored');
    }
  })());
});
