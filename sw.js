// Offline shell: app files are network-first (always fresh when online), CDN libs cache-first.
const CACHE = "att-v5";
const SHELL = ["./", "./index.html", "./css/styles.css", "./js/app.js"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.hostname.endsWith("supabase.co")) return; // never cache API/auth
  const isLib = /unpkg\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(url.hostname);
  e.respondWith(isLib
    ? caches.match(e.request).then((r) => r || fetch(e.request).then((n) => { const c = n.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return n; }))
    : fetch(e.request).then((n) => { const c = n.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return n; }).catch(() => caches.match(e.request)));
});
