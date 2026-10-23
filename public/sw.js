// Service worker du back-office. Écrit à la main (une cinquantaine de lignes) pour pouvoir le relire en entier.
//
// Stratégies :
//  - fichiers statiques de Next (/_next/static, icônes) : cache d'abord, ils sont versionnés par leur nom ;
//  - navigations : réseau d'abord ; hors connexion, page /offline. On ne met JAMAIS en cache les pages
//    du back-office : elles contiennent des données de clients et resteraient lisibles après déconnexion.
//  - tout le reste (API, Server Actions, POST) : jamais intercepté.
// Les données consultables hors ligne (planning, fiches chiens) passeront par IndexedDB (tâche suivante).

const VERSION = "v1";
const STATIC_CACHE = `a2p-static-${VERSION}`;
const SHELL_CACHE = `a2p-shell-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  // Supprime les caches des anciennes versions.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, SHELL_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
