const CACHE_NAME = "hermes-university-agent-v12";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=13",
  "./app.js?v=12",
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
