// Minimal service worker for ClubOS's "Add to Home Screen" PWA install.
//
// Deliberately conservative: this app is almost entirely live Supabase data
// behind auth, so aggressively caching pages would risk showing someone
// stale fixtures, bookings, or messages. Instead this only pre-caches the
// static app shell (icons, manifest, the offline fallback) and otherwise
// always goes to the network first — cache is only a fallback for when a
// page load fails outright (e.g. a brief signal drop), not the primary
// source of truth for anything.
const CACHE_NAME = "clubos-shell-v1";
const SHELL_ASSETS = ["/manifest.json", "/icon-192.png", "/icon-512.png", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Only ever intervene for page navigations — leave every API/data call
  // (Supabase, /api/*, etc.) to hit the network completely untouched.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match("/offline.html"))
      )
    );
    return;
  }

  // Static shell assets: try the network first so a redeploy is picked up
  // immediately, but fall back to the cached copy if offline.
  if (SHELL_ASSETS.some((a) => request.url.endsWith(a))) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
  }
});
