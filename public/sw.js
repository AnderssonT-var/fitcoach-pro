/* VYTRAFIT — service worker
   1) La app abre y funciona sin conexión (también instalada desde Safari en iPhone):
      al instalarse guarda TODOS los archivos de la app (lista generada al compilar).
   2) Imágenes de ejercicios y fotos privadas: se guardan al verlas para tenerlas sin señal.
   3) Notificaciones push: mensajes, pagos, recordatorios y fin de descanso. */
self.__BUILD__ = "dev";
self.__PRECACHE__ = [];
const APP = `vytrafit-app-${self.__BUILD__}`;
const IMG = "vytrafit-img-v1";     // imágenes de ejercicios (no cambian entre versiones)
const FILES = "vytrafit-files-v1"; // fotos privadas ya vistas (solo en este equipo)
const SHELL = ["./", "./manifest.webmanifest", "./icon-192.png", "./icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(APP);
    const list = [...new Set([...SHELL, ...self.__PRECACHE__])];
    // De a poco y sin fallar por un archivo: en celulares con poca señal no se corta la instalación
    for (let i = 0; i < list.length; i += 8) {
      await Promise.all(list.slice(i, i + 8).map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})));
    }
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    // Se conserva también la versión anterior: una pestaña abierta con ella sigue funcionando sin señal
    const old = (await caches.keys()).filter((k) => k.startsWith("vytrafit") && ![APP, IMG, FILES].includes(k));
    const prevApp = old.filter((k) => k.startsWith("vytrafit-app-")).pop();
    for (const k of old) if (k !== prevApp) await caches.delete(k);
    await self.clients.claim();
  })());
});

const STATIC = /\/assets\/|\.(png|webp|svg|woff2?|webmanifest|css|js)$/;
const EXIMG = /\/ejercicios\//;
const FILE = /^\/api\/files\/[^/]+$/;

/** Red con tiempo límite: con señal débil no se queda esperando, usa lo guardado. */
function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Fotos privadas (/api/files/…?exp&sig): se guardan por su id, la firma cambia pero el archivo no
  if (FILE.test(url.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(FILES);
      const key = new Request(url.origin + url.pathname);
      const hit = await c.match(key);
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r.ok) { await c.put(key, r.clone()); trim(FILES, 400); }
        return r;
      } catch { return new Response("", { status: 504 }); }
    })());
    return;
  }
  if (url.pathname.startsWith("/api/")) return; // los datos los maneja la app (guarda su propia copia)

  // Páginas de presentación de entrenadores (/<enlace>) y sus fotos: siempre del servidor, no son la app
  if (url.pathname.startsWith("/p/") || (req.mode === "navigate" && !/^\/(index\.html)?$/.test(url.pathname))) return;

  if (req.mode === "navigate") {
    // Página: la versión nueva si llega rápido; si no hay señal o tarda, la guardada al instante
    e.respondWith((async () => {
      const c = await caches.open(APP);
      const cached = (await c.match("./")) || (await c.match("./index.html")) || (await caches.match("./"));
      const net = fetch(req).then((r) => { if (r.ok) c.put("./", r.clone()); return r; });
      if (!cached) return net.catch(() => new Response("<h1>Sin conexión</h1><p>Abre la app con internet una vez para usarla sin señal.</p>", { headers: { "Content-Type": "text/html; charset=utf-8" } }));
      try { return await Promise.race([net, timeout(2500)]); } catch { return cached; }
    })());
    return;
  }

  if (EXIMG.test(url.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(IMG);
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; } catch { return new Response("", { status: 504 }); }
    })());
    return;
  }
  if (!STATIC.test(url.pathname)) return;
  // Archivos con nombre único por versión: primero lo guardado
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r.ok) { const c = await caches.open(APP); c.put(req, r.clone()); }
      return r;
    } catch { return new Response("", { status: 504 }); }
  })());
});

/* La app pide guardar de antemano las imágenes de los ejercicios de su rutina */
self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "warm" && Array.isArray(d.urls)) {
    e.waitUntil((async () => {
      const c = await caches.open(IMG);
      for (const u of d.urls.slice(0, 300)) {
        try { if (!(await c.match(u, { ignoreSearch: true }))) { const r = await fetch(u); if (r.ok) await c.put(u, r); } } catch { /* sin señal: luego */ }
      }
    })());
  }
  if (d.type === "skipWaiting") self.skipWaiting();
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "VYTRAFIT", {
    body: d.body || "", tag: d.tag, renotify: !!d.tag, icon: "icon-192.png", badge: "icon-192.png",
    vibrate: d.kind === "rest" ? [450, 180, 450, 180, 700] : [200, 100, 200],
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
