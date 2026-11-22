// Чёрный ящик: любая ошибка JS покажется красной плашкой сверху
window.onerror = function (msg, src, line) {
  const b = document.getElementById("err-banner");
  if (!b) return;
  b.style.display = "block";
  b.textContent = "Ошибка: " + msg + " (строка " + line + ")\nНажмите, чтобы скрыть";
  b.onclick = () => { b.style.display = "none"; };
  clearTimeout(window.__errTimer);
  window.__errTimer = setTimeout(() => { b.style.display = "none"; }, 12000);
};

const START_POINT = [55.4068, 42.5183];
const APP_NAME = "ГдеКлады";
const APP_VERSION = "1.0.0";
const APP_AUTHOR = "Александр Л.";
// версия, изменённая через админку, перекрывает базовую
const APP_VER_RE = /^\d+\.\d+(\.\d+)?$/;
function getAppVersion() {
  const v = localStorage.getItem("appVersion");
  return v && APP_VER_RE.test(v.trim()) ? v.trim() : APP_VERSION;
}
window.getAppVersion = getAppVersion;
console.log(APP_NAME + " v" + getAppVersion() + " · автор: " + APP_AUTHOR);
const map = L.map("map", { zoomControl: false }).setView(START_POINT, 13);
window.map = map; // доступ из любых модулей (погода, навигация)
// Зум-кнопки вниз слева: вверху слева они прятались под верхней панелью
L.control.zoom({ position: "bottomleft" }).addTo(map);

// ===== ПОДЛОЖКИ =====
const bases = {};
let currentBase = null;
let currentBaseId = null;

function selectBase(b) {
  if (currentBase) map.removeLayer(currentBase);
  if (!bases[b.id]) {
    bases[b.id] = L.tileLayer(b.url, {
      maxZoom: 20, maxNativeZoom: b.zoom, attribution: "© " + b.name,
    });
  }
  currentBase = bases[b.id].addTo(map);
  currentBaseId = b.id;
  watchBase(b, currentBase);
}

// Если подложка молчит (провайдер закрыл источник, сеть упала) —
// автоматически переходим на первую живую и показываем подсказку.
let baseFallbackBusy = false;
function watchBase(b, layer) {
  if (!layer || !layer.on) return;
  let ok = 0, err = 0, done = false;
  layer.on("tileload", () => { ok = 1; });
  layer.on("tileerror", () => {
    if (ok || done) return;
    err++;
    if (err >= 10 && !baseFallbackBusy) {
      done = true;
      baseFallbackBusy = true;
      fallbackBase(b);
    }
  });
}

async function fallbackBase(bad) {
  for (const cand of BASE_LAYERS) {
    if (cand.id === bad.id) continue;
    if (await probeTile(cand.url)) {
      selectBase(cand);
      const labels = Array.from(document.querySelectorAll("#base-layers label"));
      labels.forEach(l => { const inp = l.querySelector("input"); if (inp) inp.checked = false; });
      const lbl = labels.find(l => l.textContent.includes(cand.name));
      if (lbl && lbl.querySelector("input")) lbl.querySelector("input").checked = true;
      if (typeof toast === "function")
        toast("«" + bad.name + "» не отвечает — включил «" + cand.name + "»");
      baseFallbackBusy = false;
      return;
    }
  }
  baseFallbackBusy = false;
}

// Стартовая подложка — сразу, чтобы карта не мигала пустотой
const defLayer = BASE_LAYERS.find(b => b.def);
if (defLayer) {
  const layer = L.tileLayer(defLayer.url, {
    maxZoom: 20, maxNativeZoom: defLayer.zoom, attribution: "© " + defLayer.name,
  });
  bases[defLayer.id] = layer;
  selectBase(defLayer);
}

// Остальные подложки проверяются живым запросом тайла: мёртвые не попадают в панель
(async () => {
  const okLayers = [];
  for (const b of BASE_LAYERS) {
    if (b === defLayer) { okLayers.push(b); continue; }
    if (await probeTile(b.url)) okLayers.push(b);
  }
  if (!okLayers.length) okLayers.push(...BASE_LAYERS); // сеть не отвечает — показать всё

  const box = document.getElementById("base-layers");
  box.innerHTML = "";
  let lastGroup = null;
  okLayers.forEach(b => {
    if (b.group !== lastGroup) {
      const h = document.createElement("div");
      h.className = "lg-head";
      h.textContent = b.group;
      box.appendChild(h);
      lastGroup = b.group;
    }
    const layer = L.tileLayer(b.url, {
      maxZoom: 20, maxNativeZoom: b.zoom, attribution: "© " + b.name,
    });
    bases[b.id] = layer;
    const el = document.createElement("label");
    el.innerHTML = `<input type="radio" name="base" ${b.id === currentBaseId ? "checked" : ""}> ${b.name}`;
    el.querySelector("input").onchange = () => selectBase(b);
    box.appendChild(el);
  });
})();

// ===== ЭКРАНИРОВАНИЕ ДЛЯ GPX/XML =====
function escXml(t) {
  return String(t ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// ===== ПРОВЕРКА ТАЙЛОВ СТАРЫХ КАРТ =====
function probeTile(tpl) {
  return new Promise(res => {
    const c = map.getCenter();
    const x = Math.floor((c.lng + 180) / 360 * Math.pow(2, 10));
    const y = Math.floor((1 - Math.log(Math.tan(c.lat * Math.PI / 180) +
      1 / Math.cos(c.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, 10));

    const img = new Image();
    const t = setTimeout(() => res(false), 7000);
    img.onload = () => { clearTimeout(t); res(true); };
    img.onerror = () => { clearTimeout(t); res(false); };
    img.src = tpl.replace("{z}", 10).replace("{x}", x).replace("{y}", y).replace("{s}", "a");
  });
}

function toast(msg) {
  const d = document.createElement("div");
  d.textContent = msg;
  d.style.cssText = "position:absolute;bottom:140px;right:12px;z-index:1300;" +
    "background:#fffbe6;color:#333;padding:8px 12px;border-radius:8px;" +
    "font-size:12px;max-width:65vw;box-shadow:0 2px 8px rgba(0,0,0,.4)";
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 6000);
}

let activeOverlay = null;
function setOpacityTarget(o) {
  activeOverlay = o;
  document.getElementById("opacity-box").classList.toggle("hidden", !o);
  if (o) {
    document.getElementById("opacity").value = Math.round(o.opacity * 100);
    document.getElementById("op-value").textContent = Math.round(o.opacity * 100) + "%";
  }
}

document.getElementById("opacity").oninput = e => {
  const v = e.target.value / 100;
  document.getElementById("op-value").textContent = e.target.value + "%";
  if (activeOverlay) {
    activeOverlay.opacity = v;
    const layerObj = OLD_LAYERS.find(l => l.id === activeOverlay.id)?._layer;
    if (layerObj) layerObj.setOpacity(v);
  }
};

// Включение/выключение наложения — общее для панели слоёв и «Исторических снимков»
function setOverlay(o, on) {
  o.on = !!on;
  const layer = o._layer;
  if (layer) {
    if (on) { layer.addTo(map); setOpacityTarget(o); }
    else {
      map.removeLayer(layer);
      // Ползунок прячем, только если он управляет именно этим слоем
      if (activeOverlay === o) setOpacityTarget(null);
    }
  }
  document.querySelectorAll(`input[data-overlay="${o.id}"]`).forEach(cb => { cb.checked = o.on; });
  document.querySelectorAll(`.hcard[data-overlay="${o.id}"]`).forEach(card => {
    card.classList.toggle("hcard-on", o.on);
    const b = card.querySelector(".hcard-btn");
    if (b) b.textContent = o.on ? "Выключить" : "Включить";
    const st = card.querySelector(".hcard-status");
    if (st) st.textContent = o.on ? "включено на карте" : "можно включить наложением";
  });
}
window.setOverlay = setOverlay;

let warned = false;
OLD_LAYERS.forEach(o => {
  const el = document.createElement("label");
  el.innerHTML = `<input type="checkbox" data-overlay="${o.id}" ${o.on ? "checked" : ""}> ${o.name}`;
  const cb = el.querySelector("input");
  cb.disabled = true;
  const status = document.createElement("small");
  status.textContent = " проверяется…";
  el.appendChild(status);
  document.getElementById("old-layers").appendChild(el);

  (async () => {
    for (const url of o.urls) {
      if (await probeTile(url)) {
        const layer = L.tileLayer(url, {
          maxZoom: 20, maxNativeZoom: o.zoom,
          opacity: o.opacity, attribution: "историческая карта",
        });
        o._layer = layer;
        status.textContent = "";
        cb.disabled = false;
        cb.onchange = ev => setOverlay(o, ev.target.checked);
        if (o.on) setOverlay(o, true);
        return;
      }
    }

    // Ни один адрес не работает — заметная надпись и кнопка на сервис
    o.on = false;
    cb.checked = false;
    cb.disabled = true;
    el.classList.add("dead");
    status.innerHTML =
      `<br><span style="color:#d33;font-weight:bold;">Слой недоступен в браузере</span>` +
      `<br><small style="color:#8ea0c0;">Переход на сайт — в 🕰 «Исторические снимки»</small>`;

    if (!warned) {
      warned = true;
      toast("Серверы старых карт закрыты для встраивания. Переходы на сайты — в 🕰 «Исторические снимки».");
    }
  })();
});

// ===== ПАНЕЛИ =====
document.getElementById("btn-layers").onclick = () => {
  const p = document.getElementById("layers-panel");
  p.classList.toggle("hidden");
  if (!p.classList.contains("hidden") && window.__offlineInfo) window.__offlineInfo();
};
// (кнопка #btn-list обрабатывается в menu.js — там переключение на страницу находок)

// ===== «ИСТОРИЧЕСКИЕ СНИМКИ»: панель наложений и переходов =====
// Внешние переходы пересобираются при каждом открытии — в ссылки
// подставляются координаты того места, что сейчас на экране.
document.getElementById("btn-history").onclick = () => {
  const p = document.getElementById("history-panel");
  p.classList.toggle("hidden");
  if (!p.classList.contains("hidden") && window.__historyRender) window.__historyRender();
};

document.getElementById("history-close").onclick = () =>
  document.getElementById("history-panel").classList.add("hidden");

function historyCenter() {
  const c = map.getCenter();
  return {
    lat: c.lat.toFixed(5),
    lon: c.lng.toFixed(5),
    z: Math.max(3, Math.min(18, Math.round(map.getZoom()))),
  };
}

window.__historyRender = function () {
  const box = document.getElementById("history-cards");
  if (!box) return;
  const c = historyCenter();

  // Наложения прямо в приложении: только живые слои (мёртвые — переходами ниже)
  const live = OLD_LAYERS.filter(o => o.id !== "hillshade" && o._layer);
  const overlayCards = live.map(o => `
      <div class="hcard ${o.on ? "hcard-on" : ""}" data-overlay="${o.id}">
        <div class="hcard-ico">🗺</div>
        <div class="hcard-body">
          <b>${o.name}</b>
          <small class="hcard-status">${o.on ? "включено на карте" : "можно включить наложением"}</small>
        </div>
        <button class="hcard-btn">${o.on ? "Выключить" : "Включить"}</button>
      </div>`).join("");

  // РККА и топокарты: прямого встраивания тайлов в открытых источниках нет —
  // переходы открывают карты с наложением на спутник на сервисе.
  const rkka = [
    {
      icon: "🎯", name: "РККА километровка: Муром и Меленки",
      desc: "листы N-38-13 и N-37-24 · 1:100 000 · 1936 г. — район Мурома и Меленок",
      url: "https://etomesto.com/map-rkka_n-38-13-murom/",
    },
    {
      icon: "🗺", name: "РККА 1:500 000 — вся Европейская часть",
      desc: "сборная довоенная карта 1937–1941 гг.",
      url: "https://etomesto.com/map-atlas_rkka/",
    },
    {
      icon: "📐", name: "Топокарта СССР 1:500 000",
      desc: "листы 1953–1989 гг.: высоты, горизонтали, рельеф",
      url: "https://etomesto.com/map-atlas_topo-5km/",
    },
    {
      icon: "🧭", name: "Лист N-37 РККА 1:200 000 (retromap)",
      desc: "Нижегородская область, издания 1936–1940 гг.",
      url: "https://retromap.ru/14194031",
    },
    {
      icon: "🧭", name: "Лист O-37 РККА 1:100 000 (retromap)",
      desc: "склейка километровок 1936–1940 гг.",
      url: "https://retromap.ru/14194050",
    },
  ];
  const rkkaCards = rkka.map(l => `
    <div class="hcard hlink" data-url="${l.url}">
      <div class="hcard-ico">${l.icon}</div>
      <div class="hcard-body">
        <b>${l.name}</b>
        <small>${l.desc}</small>
      </div>
      <span class="hcard-go">↗</span>
    </div>`).join("");

  // Переходы на внешние сервисы с историческими снимками
  const ext = [
    {
      icon: "🗺", name: "Менде НН 1850 · ЭтоМесто",
      desc: "старая карта с наложением на спутник",
      url: "https://etomesto.com/map-nn_mende/",
    },
    {
      icon: "📐", name: "Каталог Шуберта · ЭтоМесто",
      desc: "трёхверстовки 1860-х годов",
      url: "https://etomesto.com/katalog-kart-shuberta/",
    },
    {
      icon: "🏛", name: "Каталог ПГМ · ЭтоМесто",
      desc: "планы генерального межевания",
      url: "https://etomesto.com/katalog-kart-pgm/",
    },
    {
      icon: "📜", name: "retromap.ru",
      desc: "сервис старых карт России",
      url: "https://retromap.ru",
    },
    {
      icon: "📷", name: "PastVu — снимки прошлого",
      desc: "старые фотографии на карте мира",
      url: "https://pastvu.com",
    },
    {
      icon: "🌍", name: "Google Планета Земля — это место",
      desc: "исторические спутниковые снимки: иконка часов внизу",
      url: `https://earth.google.com/web/@${c.lat},${c.lon},200a,3000d,35y,0h,0t,0r`,
    },
    {
      icon: "🛰", name: "Яндекс Карты: спутник этого места",
      desc: "свежий спутник в высоком разрешении",
      url: `https://yandex.ru/maps/?l=sat&ll=${c.lon},${c.lat}&z=${c.z}`,
    },
    {
      icon: "🛰", name: "Google Maps: спутник этого места",
      desc: "тот же вид в сервисе Google",
      url: `https://www.google.com/maps/@?api=1&map_action=map&basemap=satellite&center=${c.lat},${c.lon}&zoom=${c.z}`,
    },
  ];
  const extCards = ext.map(l => `
    <div class="hcard hlink" data-url="${l.url}">
      <div class="hcard-ico">${l.icon}</div>
      <div class="hcard-body">
        <b>${l.name}</b>
        <small>${l.desc}</small>
      </div>
      <span class="hcard-go">↗</span>
    </div>`).join("");

  box.innerHTML =
    (overlayCards ? `<h4>Наложение прямо в приложении</h4>${overlayCards}` : "") +
    `<h4>РККА и топокарты (переход)</h4>${rkkaCards}` +
    `<h4>Старые карты на внешних сервисах</h4>${extCards}` +
    `<div class="hp-hint">Современные спутниковые снимки прошлых лет (до ~1980-х) есть в «Планете Земля» — иконка часов в правом нижнем углу.</div>`;

  box.querySelectorAll(".hcard[data-overlay]").forEach(card => {
    const btn = card.querySelector(".hcard-btn");
    if (btn) btn.onclick = () => {
      const o = OLD_LAYERS.find(x => x.id === card.dataset.overlay);
      if (o) setOverlay(o, !o.on);
    };
  });
  box.querySelectorAll(".hlink").forEach(card => {
    card.onclick = () => window.open(card.dataset.url, "_blank");
  });
};

// ===== GPS: маркер + трек одним watch =====
// Трек сохраняется в localStorage: перезагрузка страницы, звонок или
// свёрнутое приложение больше не стирают пройденное.
let userMarker = null, trackLine = null, track = [], tracking = false, watchId = null;
const TRACK_KEY = "track";

function saveTrack() {
  try { localStorage.setItem(TRACK_KEY, JSON.stringify(track.slice(-20000))); } catch (e) {}
}

function drawTrack() {
  if (!track.length) return;
  trackLine = L.polyline(track, { color: "#ff0" }).addTo(map);
}

function onPos(p) {
  const ll = [p.coords.latitude, p.coords.longitude];
  if (!userMarker) userMarker = L.circleMarker(ll, { radius: 8, color: "#00b", fillOpacity: .8 }).addTo(map);
  else userMarker.setLatLng(ll);
  if (tracking) {
    track.push(ll);
    if (trackLine) trackLine.setLatLngs(track);
    else trackLine = L.polyline(track, { color: "#ff0" }).addTo(map);
    if (track.length % 20 === 0) saveTrack(); // копим и пишем пачками
  }
  if (window.__navOnPos) window.__navOnPos(p);
}

// Восстанавливаем трек прошлых выходов
try {
  const savedTrack = JSON.parse(localStorage.getItem(TRACK_KEY) || "[]");
  if (Array.isArray(savedTrack) && savedTrack.length) {
    // строго числа: isFinite(null) = true — null-точка уехала бы в нули
    track = savedTrack.filter(ll =>
      Array.isArray(ll) && ll.length === 2 &&
      typeof ll[0] === "number" && typeof ll[1] === "number" &&
      isFinite(ll[0]) && isFinite(ll[1]));
    drawTrack();
    if (track.length)
      setTimeout(() => toast("Восстановлен трек прошлых выходов: " + track.length + " точек"), 800);
  }
} catch (e) {}

// Сохраняем трек при уходе со страницы и при сворачивании
window.addEventListener("pagehide", saveTrack);
document.addEventListener("visibilitychange", () => { if (document.hidden) saveTrack(); });

function startGpsWatch() {
  if (watchId || !("geolocation" in navigator)) return;
  watchId = navigator.geolocation.watchPosition(onPos,
    err => {
      if (window.__navGpsError) window.__navGpsError(err.message);
      else alert("Ошибка GPS: " + err.message);
    },
    { enableHighAccuracy: true, maximumAge: 3000 });
}

document.getElementById("btn-locate").onclick = function () {
  if (watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; return; }
  if (!("geolocation" in navigator)) return alert("GPS недоступен");
  startGpsWatch();
};

document.getElementById("btn-track").onclick = function () {
  if (!tracking && track.length) {
    const cont = confirm(
      "Продолжить текущий трек (" + track.length + " точек)?\n" +
      "«ОК» — продолжить, «Отмена» — начать новый трек.");
    if (!cont) {
      track = [];
      if (trackLine) { map.removeLayer(trackLine); trackLine = null; }
      saveTrack();
    }
  }
  tracking = !tracking;
  this.classList.toggle("rec", tracking);
};

// ===== ЭКСПОРТ GPX (точки + трек) =====
document.getElementById("btn-export").onclick = () => {
  const list = (typeof spots !== "undefined" ? spots : []);
  let gpx = '<?xml version="1.0"?><gpx version="1.1" creator="KoparApp">';
  list.forEach(s => {
    if (!Array.isArray(s.ll) || s.ll.length !== 2) return;
    gpx += `<wpt lat="${s.ll[0]}" lon="${s.ll[1]}"><name>${escXml(s.note)}</name></wpt>`;
  });
  if (track.length)
    gpx += `<trk><name>${escXml("Трек")}</name><trkseg>` +
      track.map(ll => `<trkpt lat="${ll[0]}" lon="${ll[1]}"/>`).join("") +
      `</trkseg></trk>`;
  gpx += "</gpx>";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([gpx], { type: "application/gpx+xml" }));
  a.download = "kopar_spots.gpx";
  a.click();
};

// ===== ЭКСПОРТ ТОЧЕК В JSON (кнопка «JSON») =====
document.getElementById("btn-export-json").onclick = () => {
  const data = { app: "kopar-spots", ts: new Date().toISOString(), spots: spots, track: track };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = "kopar_spots.json";
  a.click();
};

// ===== ГОРЯЧИЕ КЛАВИШИ (ПК) =====
// S — отметка, G — GPS, T — трек, L — слои, H — история, C — находки,
// M — меню, Esc — закрыть всё открытое. В полях ввода клавиши не работают.
document.addEventListener("keydown", e => {
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === "escape") {
    if (window.__cancelPlacing) window.__cancelPlacing();
    if (window.__navOff) window.__navOff();
    ["layers-panel", "history-panel", "spot-modal"].forEach(id =>
      document.getElementById(id).classList.add("hidden"));
    return;
  }
  const actions = {
    s: () => document.getElementById("btn-spot").click(),
    g: () => document.getElementById("btn-locate").click(),
    t: () => document.getElementById("btn-track").click(),
    l: () => document.getElementById("btn-layers").click(),
    h: () => document.getElementById("btn-history").click(),
    c: () => showView("finds"),
    m: () => document.getElementById("btn-menu").click(),
  };
  if (actions[k] && typeof showView === "function") actions[k]();
});

// ===== PWA: оффлайн и иконка на рабочий стол =====
// Работает при открытии по http(s) — хостинг или локальный сервер.
// При открытии файла напрямую (file://) регистрация тихо пропускается.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
