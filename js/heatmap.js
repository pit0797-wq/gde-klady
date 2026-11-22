// ===== ТЕПЛОВАЯ КАРТА НАХОДОК =====
// Своя сетка плотности без внешних библиотек: точки собираются в ячейки
// (размер зависит от зума), каждая ячейка рисуется кругом.
// Зелёный — редкие места, жёлтый — средние, красный — самые уловистые.

let heatOn = false;
let heatLayer = null;
let heatTimer = null;

function heatColor(t) {
  const g = [46, 204, 113], y = [241, 196, 15], r = [231, 76, 60];
  const p = t <= .5 ? t / .5 : (t - .5) / .5;
  const a = t <= .5 ? g : y;
  const b = t <= .5 ? y : r;
  const c = [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * p));
  return "rgb(" + c.join(",") + ")";
}

function buildHeat() {
  const z = map.getZoom();
  const cellM = z >= 16 ? 20 : z >= 14 ? 80 : z >= 12 ? 300 : 1200;
  const buckets = new Map();
  (typeof spots !== "undefined" ? spots : []).forEach(s => {
    if (!Array.isArray(s.ll) || !isFinite(s.ll[0]) || !isFinite(s.ll[1])) return;
    const lat = +s.ll[0], lng = +s.ll[1];
    const mLat = 111320;
    const mLng = 111320 * Math.cos(lat * Math.PI / 180) || 1;
    const gx = Math.round(lng * mLng / cellM);
    const gy = Math.round(lat * mLat / cellM);
    const key = gx + ":" + gy;
    const b = buckets.get(key) || { lat: 0, lng: 0, n: 0 };
    b.lat += lat; b.lng += lng; b.n++;
    buckets.set(key, b);
  });
  let maxN = 1;
  buckets.forEach(b => { if (b.n > maxN) maxN = b.n; });
  const arr = [];
  buckets.forEach(b => {
    const t = Math.pow((b.n - 1) / Math.max(1, maxN - 1), 0.8);
    arr.push(L.circle([b.lat / b.n, b.lng / b.n], {
      radius: Math.max(14, cellM * 0.55),
      stroke: false,
      fillColor: heatColor(t),
      fillOpacity: .18 + .34 * t,
      interactive: false,
    }));
  });
  return L.layerGroup(arr);
}

function refreshHeat() {
  if (!heatOn) return;
  if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
  const list = (typeof spots !== "undefined") ? spots : [];
  if (!list.length) return;
  heatLayer = buildHeat().addTo(map);
}
window.__heatRefresh = refreshHeat;

function heatMoveHandler() {
  clearTimeout(heatTimer);
  heatTimer = setTimeout(refreshHeat, 250);
}

document.getElementById("btn-heat").onclick = function () {
  heatOn = !heatOn;
  this.classList.toggle("rec", heatOn);
  if (heatOn) {
    refreshHeat();
    let lg = document.getElementById("heat-legend");
    if (!lg) {
      lg = document.createElement("div");
      lg.id = "heat-legend";
      lg.innerHTML = `<i style="background:#2ecc71"></i> редко` +
        ` <i style="background:#f1c40f"></i> средне` +
        ` <i style="background:#e74c3c"></i> часто`;
      document.body.appendChild(lg);
    }
    lg.classList.remove("hidden");
    map.on("moveend", heatMoveHandler);
    map.on("zoomend", heatMoveHandler);
    if (typeof toast === "function")
      toast("Тепловая карта: зелёный — редко, красный — часто");
    if (!(typeof spots !== "undefined" && spots.length) && typeof toast === "function")
      toast("Пока нет точек для карты");
  } else {
    if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
    map.off("moveend", heatMoveHandler);
    map.off("zoomend", heatMoveHandler);
    const lg = document.getElementById("heat-legend");
    if (lg) lg.classList.add("hidden");
  }
};
