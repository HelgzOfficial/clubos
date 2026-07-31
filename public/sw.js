// Minimal service worker for ClubOS's "Add to Home Screen" PWA install.
//
// Deliberately conservative: this app is almost entirely live Supabase data
// behind auth, so aggressively caching pages would risk showing someone
// stale fixtures, bookings, or messages. Instead this only pre-caches the
// static app shell (icons, manifest, the offline fallback) and otherwise
// always goes to the network first — cache is only a fallback for when a
// page load fails outright (e.g. a brief signal drop), not the primary
// source of truth for anything.
const CACHE_NAME = "clubos-shell-v2";
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

// ---------------------------------------------------------------------------
// Web Push
//
// This is the part that works when ClubOS isn't open. The service worker is
// woken by the browser's push service, so there's no page and no React — it
// only gets the payload the server encrypted for it.
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "ClubOS", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "ClubOS";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // A tag means a second message from the same player replaces the first
    // rather than stacking up five notifications about one conversation.
    tag: payload.tag || "clubos",
    renotify: true,
    data: { url: payload.url || "/medical" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  // Focus an existing ClubOS tab if there is one rather than opening a
  // duplicate, then navigate it to the right place.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

// Chrome rotates subscriptions occasionally. Without this the old endpoint
// silently stops working and the physio just stops getting alerts.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription ? event.oldSubscription.options : { userVisibleOnly: true })
      .then((subscription) =>
        fetch("/api/push-subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subscription, renewalOf: event.oldSubscription ? event.oldSubscription.endpoint : null }),
        })
      )
      .catch(() => {})
  );
});
