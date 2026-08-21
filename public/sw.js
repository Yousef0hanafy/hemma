// =====================================================================
// همّة Service Worker — PWA Offline Support + Push Notifications
// =====================================================================
// Strategies:
//   - Next.js build assets (_next/static/*):    CacheFirst (immutable)
//   - Google Fonts:                              CacheFirst
//   - Static media / icons / manifest:           CacheFirst
//   - Navigation (page HTML):                    NetworkFirst → shell fallback
//   - Server Action POST responses (data):       NetworkFirst → cache fallback
//   - Everything else:                           NetworkFirst → cache fallback
// =====================================================================

const CACHE_NAME = "hemma-cache-v2";
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
];

// Response types eligible for caching.
const CACHEABLE_TYPES = new Set(["basic", "cors"]);

// ── Helpers ──────────────────────────────────────────────────────────────

// ── Install ──────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate (clean stale caches) ────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Push ─────────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const options = {
      body: data.body ?? "",
      icon: data.icon ?? "/icon-512.png",
      badge: "/favicon-32x32.png",
      tag: data.tag ?? "hemma-push",
      data: data.data ?? {},
      requireInteraction: data.requireInteraction ?? false,
      dir: "rtl",
      lang: "ar",
    };
    event.waitUntil(
      self.registration.showNotification(data.title ?? "منصة همّة التعليمية", options)
    );
  } catch {
    // Payload may not be JSON; fall back to plain text
    const title = event.data.text() || "منصة همّة التعليمية";
    event.waitUntil(
      self.registration.showNotification(title, {
        icon: "/icon-512.png",
        badge: "/favicon-32x32.png",
        dir: "rtl",
        lang: "ar",
      })
    );
  }
});

// ── Notification Click ───────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Open or focus the app
  const urlToOpen = new URL("/", self.location.origin).href;

  const promiseChain = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((windowClients) => {
      // Focus an existing window if available
      for (const client of windowClients) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(urlToOpen);
    });

  event.waitUntil(promiseChain);
});

// ── Fetch ────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only cache http(s) requests
  if (!url.protocol.startsWith("http")) return;

  // ── Next.js build assets (hashed filenames → immutable) ──
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // ── Google Fonts ──
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // ── Static media / favicons / manifest ──
  if (/\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // ── Navigation (page shell) ──
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithShellFallback(request));
    return;
  }

  // Never cache POST requests. Server Actions include authenticated reads and
  // mutations; replaying or serving them from a shared cache can expose stale
  // user data or duplicate a write. Offline mutations must fail visibly and be
  // retried by the app with an idempotency key when supported.
  if (request.method !== "GET" && request.method !== "HEAD") {
    event.respondWith(fetch(request));
    return;
  }

  // ── Default: network-first with cache fallback ──
  event.respondWith(networkFirst(request));
});

// ── Cache-First Strategy ─────────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && CACHEABLE_TYPES.has(response.type)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request);
  }
}

// ── Network-First Strategy ───────────────────────────────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && CACHEABLE_TYPES.has(response.type)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request);
  }
}

// ── Network-First with App Shell Fallback ────────────────────────────────
async function networkFirstWithShellFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok && CACHEABLE_TYPES.has(response.type)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Try exact URL first, then app shell
    const cached =
      (await caches.match(request)) ||
      (await caches.match("/"));
    return cached;
  }
}

