/* VYTRAFIT — service worker
   1) La app abre sin conexión: guarda la página y los archivos de la app.
   2) Notificaciones push: mensajes, pagos, recordatorios y fin de descanso. */
const CACHE = "vytrafit-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const STATIC = /\/assets\/|\/ejercicios\/|\.(png|webp|svg|woff2?|webmanifest)$/;
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return; // los datos siempre van al servidor
  if (req.mode === "navigate") {
    // Página: primero la red (versión nueva), si no hay señal la guardada
    e.respondWith(fetch(req).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); }
      return r;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  if (!STATIC.test(url.pathname)) return;
  // Archivos con nombre único por versión: primero lo guardado
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return r;
  })));
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "VYTRAFIT", {
    body: d.body || "", tag: d.tag, renotify: !!d.tag, icon: "icon-192.png", badge: "icon-192.png",
    vibrate: d.kind === "rest" ? [300, 150, 300, 150, 300] : [200, 100, 200],
    requireInteraction: d.kind === "rest", data: { page: d.page || "", params: d.params || null },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const { page, params } = e.notification.data || {};
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        c.postMessage({ type: "open", page, params });
        return;
      }
    }
    const q = page ? `?open=${encodeURIComponent(page)}${params?.clientId ? `&client=${params.clientId}` : ""}` : "";
    await self.clients.openWindow(`${self.registration.scope}${q}`);
  })());
});
