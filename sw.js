// Ponto de Viagem — modo offline.
// Troque VERSAO a cada atualização publicada para o celular baixar os arquivos novos.
const VERSAO = "pv-2026-10-14-2";
const ARQUIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./vendor/jspdf.umd.min.js",
  "./vendor/jspdf.plugin.autotable.min.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO && k !== "pv-fontes").map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Fontes do Google: guarda na primeira vez e usa offline depois
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open("pv-fontes").then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit))
      )
    );
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Página: tenta a internet (para pegar atualizações) e cai no cache se estiver offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => { const cp = res.clone(); caches.open(VERSAO).then((c) => c.put("./index.html", cp)); return res; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Demais arquivos: cache primeiro
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
