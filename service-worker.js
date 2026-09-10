const CACHE_NAME = "padel-scoreboard-v6";
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
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
