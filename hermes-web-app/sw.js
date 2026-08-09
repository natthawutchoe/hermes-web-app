const CACHE_NAME = "hermes-university-agent-v9";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js?v=9",
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
