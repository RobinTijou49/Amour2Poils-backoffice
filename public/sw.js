// Service worker du back-office. Écrit à la main (une soixantaine de lignes) pour pouvoir le relire en entier.
//
// Stratégies :
//  - fichiers statiques de Next (/_next/static, icônes) : cache d'abord, ils sont versionnés par leur nom
//    (ceux de /offline sont préchargés à l'installation) ;
//  - navigations : réseau d'abord ; hors connexion, page /offline. On ne met JAMAIS en cache les pages
//    du back-office : elles contiennent des données de clients et resteraient lisibles après déconnexion.
//  - tout le reste (API, Server Actions, POST) : jamais intercepté.
// Les données consultables hors ligne (planning, fiches chiens) sont lues dans IndexedDB par la page /offline.

const VERSION = "v4";
const STATIC_CACHE = `a2p-static-${VERSION}`;
const SHELL_CACHE = `a2p-shell-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

// La page /offline lit IndexedDB avec du JavaScript : on met aussi en cache les fichiers /_next/static
// qu'elle référence (sinon elle s'afficherait hors connexion, mais sans pouvoir s'exécuter).
async function precache() {
  const shell = await caches.open(SHELL_CACHE);
  // cache: "reload" : on ignore le cache HTTP du navigateur, sinon on pourrait précacher une ancienne version.
  await shell.addAll([OFFLINE_URL, "/icons/icon-192.png"].map((url) => new Request(url, { cache: "reload" })));
  const html = await (await shell.match(OFFLINE_URL)).text();
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s\)]+/g) ?? [])];
  const statics = await caches.open(STATIC_CACHE);
  await Promise.all(assets.map((a) => statics.add(a).catch(() => undefined)));
}

self.addEventListener("activate", (event) => {
  // Supprime les caches des anciennes versions.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, SHELL_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Notifications push : le serveur envoie { title, body, url, tag } (voir src/lib/push.ts).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Message illisible : on affiche tout de même une notification générique.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Amour 2 Poils", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag, // une notification de même tag remplace la précédente au lieu de s'empiler
      data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Réutilise un onglet déjà ouvert sur l'application, sinon en ouvre un.
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      return open ? open.focus().then((w) => w.navigate(target)) : self.clients.openWindow(target);
    }),
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
