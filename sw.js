const CACHE = "jarvis-shell-recovery-v1";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./ui-polish.css",
  "./library-v2.css",
  "./intelligence.css",
  "./lab-builder.css",
  "./config.js",
  "./answer-ui.js",
  "./app.js",
  "./weather.js",
  "./chat-memory.js",
  "./context-bridge.js",
  "./briefly-timeline.js",
  "./briefly-live-summary.js",
  "./moves-context.js",
  "./personal-memory.js",
  "./tasks.js",
  "./today.js",
  "./capture.js",
  "./library-v2.js",
  "./learn.js",
  "./discover-plus.js",
  "./spreadsheet.js",
  "./universal-search.js",
  "./lab-builder.js",
  "./pwa.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/Jarvis/")) return;

  const isNavigation = request.mode === "navigate";
  const isLiveAsset = /\.(?:js|css)$/i.test(url.pathname);

  if (isNavigation || isLiveAsset) {
    event.respondWith(networkFirst(request, isNavigation ? "./index.html" : null));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

async function networkFirst(request, fallbackKey = null) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.ok) {
      const copy = response.clone();
      const cache = await caches.open(CACHE);
      await cache.put(request, copy);
      if (fallbackKey) await cache.put(fallbackKey, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackKey) {
      const fallback = await caches.match(fallbackKey);
      if (fallback) return fallback;
    }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}
