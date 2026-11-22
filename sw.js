// ===== ГдеКлады: service worker =====
// Кэшируем оболочку приложения и тайлы карт по мере просмотра.
// Оффлайн доступны: само приложение, точки, треки, каталог и те места
// карты, которые уже открывали в этой зоне.

const SHELL = "kopar-shell-v15";
const TILES = "kopar-tiles-v3";

const SHELL_ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/style.css",
  "./js/layers.js", "./js/app.js", "./js/spots.js", "./js/photos.js",
  "./js/nav.js", "./js/offline.js", "./js/import.js",
  "./js/search.js", "./js/menu.js", "./js/weather.js", "./js/coins.js",
  "./js/antiques.js", "./js/admin.js",
  "./icon-192.png", "./icon-512.png",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(SHELL).then(c =>
      Promise.all(SHELL_ASSETS.map(u => c.add(u).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== SHELL && k !== TILES)
        .map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  let url;
  try { url = new URL(e.request.url); } catch (err) { return; }

  // GitHub API — мимо воркера: никакой кэш-оболочки, только сеть
  if (url.hostname === "api.github.com") return;

  // Тайлы карт: кэш первым — сеть только при промахе
  const isTile =
    /tile|basemap|arcgisonline|opentopomap|openstreetmap|cyclosm|retromap|google\.[a-z.]+\/vt|amazonaws/.test(url.hostname);
  if (isTile) {
    e.respondWith(
      caches.open(TILES).then(c =>
        c.match(e.request).then(hit =>
          hit || fetch(e.request).then(resp => {
            if (resp && resp.status === 200) c.put(e.request, resp.clone());
            return resp;
          }).catch(() => hit)
        )
      )
    );
    return;
  }

  // Всё остальное: сеть с откатом в кэш (оффлайн — из уже сохранённого)
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp && resp.status === 200 && url.origin === self.location.origin) {
        const copy = resp.clone();
        caches.open(SHELL).then(c => c.put(e.request, copy));
      }
      return resp;
    }).catch(() =>
      caches.match(e.request).then(hit => hit || caches.match("./index.html"))
    )
  );
});
