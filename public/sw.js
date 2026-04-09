const CACHE_NAME = "law-and-bar-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("/api/")) return;
  if (!event.request.url.startsWith("http://") && !event.request.url.startsWith("https://")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone))
            .catch(() => {
              // Ignore cache failures for unsupported or blocked requests.
            });
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === "navigate") {
            return new Response(
              '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#f8f9fa;color:#121f1d}div{text-align:center;padding:2rem}h1{font-size:1.5rem;margin-bottom:.5rem}p{opacity:.6;margin-bottom:1.5rem}button{background:#26d9c0;color:#121f1d;border:none;padding:.75rem 1.5rem;border-radius:.5rem;font-weight:600;cursor:pointer}</style></head><body><div><h1>You\'re Offline</h1><p>Check your connection and try again.</p><button onclick="location.reload()">Retry</button></div></body></html>',
              { headers: { "Content-Type": "text/html" } }
            );
          }
          return new Response("", { status: 408 });
        })
      )
  );
});
