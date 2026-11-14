const CACHE = "lyco-pwa-0.2.62-r2";
const ASSETS = [
  "/lyco-music/",
  "/lyco-music/index.html",
  "/lyco-music/app.js",
  "/lyco-music/manifest.webmanifest",
  "/lyco-music/icons/icon-192.png",
  "/lyco-music/icons/icon-512.png",
  "/lyco-music/icons/icon-maskable-512.png",
  "/assets/studio.css",
  "/assets/studio.js?v=revive-20261030-142831"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key !== CACHE && key.startsWith("lyco-pwa-")).map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isShell = url.pathname === "/lyco-music/" || url.pathname === "/lyco-music/index.html";
  const isAsset = ASSETS.some((a) => url.pathname === a.split("?")[0]);
  if (req.mode === "navigate" && isShell) {
    event.respondWith(caches.match("/lyco-music/index.html").then((hit) => hit || fetch(req)));
    return;
  }
  if (isAsset) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((cache) => cache.put(req, copy)); }
      return res;
    })));
  }
});
