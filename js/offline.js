// ===== ОФФЛАЙН-КАРТА =====
// Сохраняет тайлы видимой области в кэш service worker (kopar-tiles-v3):
// каждый тайл грузится как обычная картинка, а SW, перехватывая запрос,
// сам кладёт его в кэш — ровно как при обычном просмотре. Без интернета
// SW отдаёт эти тайлы из кэша.

const OFFLINE_LIMIT = 600; // не даём сохранить половину области за один клик

function ll2tile(lat, lng, z) {
  const n = 2 ** z;
  const x = Math.max(0, Math.min(n - 1, Math.floor((lng + 180) / 360 * n)));
  const latRad = lat * Math.PI / 180;
  const y = Math.max(0, Math.min(n - 1,
    Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n)));
  return [x, y];
}

function fillTile(tpl, z, x, y) {
  return tpl.replace("{s}", "a").replace("{z}", z).replace("{x}", x).replace("{y}", y);
}

// Список тайлов видимой области: текущий зум + на уровень ниже (для контекста)
function offlineArea() {
  if (!currentBase || !currentBase._url) return null;
  const b = map.getBounds();
  const z = Math.round(map.getZoom());
  const countFor = zz => {
    const [x0, y0] = ll2tile(b.getNorth(), b.getWest(), zz);
    const [x1, y1] = ll2tile(b.getSouth(), b.getEast(), zz);
    return (x1 - x0 + 1) * (y1 - y0 + 1);
  };
  if (countFor(z) > OFFLINE_LIMIT) return null; // слишком широко
  const plan = [{ z }];
  if (z > 2 && countFor(z) + countFor(z - 1) <= OFFLINE_LIMIT) plan.push({ z: z - 1 });
  const urls = [];
  plan.forEach(p => {
    const [x0, y0] = ll2tile(b.getNorth(), b.getWest(), p.z);
    const [x1, y1] = ll2tile(b.getSouth(), b.getEast(), p.z);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        urls.push(fillTile(currentBase._url, p.z, x, y));
  });
  return urls;
}

let offlineSaving = false;

async function saveOffline() {
  if (offlineSaving) return;
  if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
    return alert("Оффлайн-карта работает при открытии приложения по адресу\n(хостинг, PWA-установка), а не с файла на диске.");
  }
  const urls = offlineArea();
  if (!urls) return alert("Слишком большая область для одного раза.\nПриблизьте карту и повторите.");
  offlineSaving = true;
  const btn = document.getElementById("btn-offline-save");
  let done = 0;
  const batch = 6; // не душим сеть
  for (let i = 0; i < urls.length; i += batch) {
    const chunk = urls.slice(i, i + batch);
    await Promise.all(chunk.map(u => new Promise(res => {
      const img = new Image();
      img.onload = img.onerror = () => { done++; res(); };
      img.src = u;
    })));
    btn.textContent = "💾 " + done + " / " + urls.length;
  }
  offlineSaving = false;
  btn.textContent = "💾 Сохранить видимую область";
  try {
    localStorage.setItem("offlineMeta", JSON.stringify({
      n: urls.length,
      base: (currentBase.options && currentBase.options.attribution) || "карта",
      z: Math.round(map.getZoom()),
      ts: new Date().toLocaleDateString("ru-RU"),
    }));
  } catch (e) {}
  if (typeof toast === "function") toast("Оффлайн-карта сохранена: " + urls.length + " тайлов");
  updateOfflineInfo();
}

async function clearOffline() {
  if (offlineSaving) return;
  if (!confirm("Удалить сохранённые оффлайн-тайлы?")) return;
  if ("caches" in window) {
    try { await caches.delete("kopar-tiles-v3"); } catch (e) {}
  }
  localStorage.removeItem("offlineMeta");
  if (typeof toast === "function") toast("Оффлайн-карта очищена");
  updateOfflineInfo();
}

function updateOfflineInfo() {
  const el = document.getElementById("offline-info");
  if (!el) return;
  let meta = null;
  try { meta = JSON.parse(localStorage.getItem("offlineMeta") || "null"); } catch (e) {}
  el.textContent = meta
    ? "В кэше ~" + meta.n + " тайлов · " + meta.ts + " · " + meta.base +
      ". Сохраняется текущая подложка: текущий зум + соседний."
    : "Откройте нужный участок на нужной подложке и нажмите «Сохранить». " +
      "Потом этот кусок карты будет открываться без интернета.";
}

document.getElementById("btn-offline-save").onclick = saveOffline;
document.getElementById("btn-offline-clear").onclick = clearOffline;
window.__offlineInfo = updateOfflineInfo;
updateOfflineInfo();
