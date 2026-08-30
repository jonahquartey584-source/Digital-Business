// Minimal service worker — its only job is to make the site installable as
// a PWA (Chrome/Android requires a registered service worker with a fetch
// handler before it will show an install prompt).
//
// It deliberately does NOT cache dashboard/API/auth responses: this is a
// live multi-tenant SaaS, and serving a stale or cross-session cached
// response for /dashboard or /api/* would be a correctness and privacy bug,
// not a convenience. Only the static app shell (icons, manifest, built
// JS/CSS chunks) is cached, and even that is a cache-first-then-network
// strategy that always revalidates in the background.

const CACHE_NAME = "qp-digital-shell-v1";
const STATIC_PATH_PREFIXES = ["/_next/static/", "/icons/", "/manifest.json"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return STATIC_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!isStaticAsset(url)) return; // let everything else hit the network normally

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
