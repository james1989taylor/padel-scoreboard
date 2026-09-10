const CACHE_NAME = "padel-scoreboard-v11";
const FILES_TO_CACHE = [
  "./",
  "index.html",
  "style.css",
  "script.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "fonts/Geist-Regular.woff2",
  "fonts/Geist-Medium.woff2",
  "fonts/Geist-SemiBold.woff2",
  "fonts/Geist-Bold.woff2",
  "fonts/Geist-Black.woff2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  // Activate this new service worker immediately instead of waiting for
  // every open tab/PWA instance to be fully closed first.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
