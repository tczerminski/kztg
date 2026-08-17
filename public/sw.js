// Hand-written service worker (no Workbox/vite-plugin-pwa dependency — the
// Astro integration for that doesn't yet support Astro 7). Strategy: cache
// pages/assets/media as the visitor actually browses them, so previously
// visited content works offline on a repeat visit. This does NOT precache
// the whole site (1300+ pages, many MB of sermon audio on R2) up front —
// EXCEPT the śpiewnik (song pages), which is small, text-only, and gets
// warmed in full so it's always available offline. That warm-up is driven
// from the page (see src/scripts/pwa.ts), not from here: cramming ~680
// fetches into install/activate's waitUntil risked exceeding the browser's
// background-execution budget for those lifecycle events on real devices.

const VERSION = "v1";
const SHELL_CACHE = `kztg-shell-${VERSION}`;
const PAGES_CACHE = `kztg-pages-${VERSION}`;
const ASSETS_CACHE = `kztg-assets-${VERSION}`;
const MEDIA_CACHE = `kztg-media-${VERSION}`;
const KNOWN_CACHES = [SHELL_CACHE, PAGES_CACHE, ASSETS_CACHE, MEDIA_CACHE];

// Small, stable-URL app shell so the site can at least open offline even on
// a first visit that never fully completed. Hashed build assets (JS/CSS)
// aren't listed here since their filenames change per deploy — they get
// cached opportunistically the first time they're requested instead.
const SHELL_URLS = ["/", "/manifest.json", "/images/logo.jpg", "/images/icons/icon-192x192.png"];

// Never cache the live radio proxy or its status endpoint — both are
// inherently dynamic/streaming and caching them would break live listening.
const NEVER_CACHE_PATHS = ["/stream", "/radio-status"];

const STATIC_ASSET_RE = /\.(?:js|css|woff2?|png|jpe?g|webp|svg|ico|gif)$/i;
const AUDIO_RE = /\.opus$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !KNOWN_CACHES.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isNavigationRequest(request) {
  return request.mode === "navigate" || (request.method === "GET" && (request.headers.get("accept") || "").includes("text/html"));
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await caches.open(SHELL_CACHE);
    const fallback = await shell.match("/");
    if (fallback) return fallback;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Cross-origin (R2) responses fetched in no-cors mode come back "opaque"
  // (status 0, body unreadable) but are still safe and useful to cache.
  if (response && (response.ok || response.type === "opaque")) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin === self.location.origin && NEVER_CACHE_PATHS.some((path) => url.pathname.startsWith(path))) {
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirst(request, PAGES_CACHE));
    return;
  }

  if (url.origin === self.location.origin && STATIC_ASSET_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  if (AUDIO_RE.test(url.pathname) || url.hostname.endsWith(".r2.dev") || url.hostname.endsWith(".r2.cloudflarestorage.com")) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
  }
});
