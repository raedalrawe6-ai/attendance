const C="att-v2";
const LIBS=["https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js","https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(["./","./index.html",...LIBS])).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const u=e.request.url;
 if(LIBS.includes(u)){e.respondWith(caches.match(u).then(r=>r||fetch(u).then(n=>{const cl=n.clone();caches.open(C).then(c=>c.put(u,cl));return n})));return}
 if(e.request.mode==="navigate"){e.respondWith(fetch(e.request).then(n=>{const cl=n.clone();caches.open(C).then(c=>c.put("./index.html",cl));return n}).catch(()=>caches.match("./index.html")));}
});
