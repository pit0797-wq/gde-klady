// ===== КАТЕГОРИИ ТОЧЕК =====
const SPOT_TYPES = {
  find:     { name: "Находка",   color: "#f80" },
  coin:     { name: "Монета",    color: "#c9a227" },
  stash:    { name: "Клад",      color: "#8a2be2" },
  pit:      { name: "Яма",       color: "#8b4513" },
  building: { name: "Фундамент", color: "#666" },
  road:     { name: "Дорога",    color: "#228b22" },
  other:    { name: "Прочее",    color: "#1f6feb" },
};

// Экранирование пользовательского текста для вставки в HTML
function escHtml(t) {
  return String(t ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function llValid(ll) {
  return Array.isArray(ll) && ll.length === 2 &&
    isFinite(ll[0]) && isFinite(ll[1]) &&
    Math.abs(ll[0]) <= 90 && Math.abs(ll[1]) <= 180;
}

// Загружаем точки (старые тоже: им автоматически присвоится тип "other").
// Битые записи без валидных координат отфильтровываем, чтобы не роняли рендер.
let spots = [];
try {
  spots = (JSON.parse(localStorage.getItem("spots") || "[]"))
    .map(s => ({ type: "other", note: "", ...s }))
    .filter(s => llValid(s.ll));
} catch (e) {
  spots = [];
}

const spotMarkers = {};

function spotColor(type) {
  return (SPOT_TYPES[type] || SPOT_TYPES.other).color;
}

function addSpotMarker(s) {
  const m = L.circleMarker(s.ll, { radius: 7, color: spotColor(s.type), fillOpacity: .9 })
    .addTo(map)
    .bindPopup(
      `<b>${(SPOT_TYPES[s.type] || SPOT_TYPES.other).name}</b> — ${escHtml(s.note)}<br>` +
      `<small>${escHtml(s.ts || "")}</small>` +
      `<div class="spot-thumbs" id="sp-thumbs-${s.id}"></div>` +
      `<a href="#" onclick="window.__navSpotById(${s.id});return false">🧭 К точке</a> · ` +
      `<a href="#" onclick="window.__addPhotoToSpot(${s.id});return false">📷 Фото</a> · ` +
      `<a href="#" onclick="window.__openCoinCatalog && window.__openCoinCatalog();return false">🪙 Каталог</a> · ` +
      `<a href="#" onclick="window.__removeSpot(${s.id});return false">🗑 Удалить</a>`
    );
  m.on("popupopen", () => {
    if (window.__renderPopupThumbs) window.__renderPopupThumbs(s.id);
  });
  spotMarkers[s.id] = m;
}
spots.forEach(addSpotMarker);

function saveSpots() {
  try {
    localStorage.setItem("spots", JSON.stringify(spots));
  } catch (e) {
    if (typeof toast === "function") toast("Не удалось сохранить данные: хранилище переполнено");
  }
}

function removeSpot(id) {
  spots = spots.filter(s => s.id !== id);
  if (spotMarkers[id]) { map.removeLayer(spotMarkers[id]); delete spotMarkers[id]; }
  if (window.__deleteSpotPhotos) window.__deleteSpotPhotos(id);
  saveSpots();
  renderFinds();
}
window.__removeSpot = removeSpot;

// ===== МОДАЛКА НОВОЙ ТОЧКИ =====
const modal = document.getElementById("spot-modal");
const selType = document.getElementById("spot-type");

Object.entries(SPOT_TYPES).forEach(([k, v]) => {
  const opt = document.createElement("option");
  opt.value = k;
  opt.textContent = v.name;
  selType.appendChild(opt);
});

let pendingLL = null;
let placing = false;

function setPlacing(on) {
  placing = on;
  document.getElementById("crosshair").classList.toggle("hidden", !on);
  document.getElementById("place-bar").classList.toggle("hidden", !on);
  document.getElementById("btn-spot").classList.toggle("rec", on);
}

// Смена страницы через меню сбрасывает режим прицела
window.__cancelPlacing = () => { if (placing) setPlacing(false); };

document.getElementById("btn-spot").onclick = () => {
  if (placing) return; // подтверждение — через панель «Готово/Отмена»
  setPlacing(true);
  if (typeof toast === "function")
    toast("Наведите перекрестие на место — двигайте карту и нажмите «Готово»");
};

document.getElementById("place-ok").onclick = () => {
  const c = map.getCenter(); // центр экрана = перекрестие
  pendingLL = [c.lat, c.lng];
  setPlacing(false);
  document.getElementById("spot-name").value = "Найдено №" + (spots.length + 1);
  if (window.__renderPending) window.__renderPending(); // пустой список фото
  modal.classList.remove("hidden");
};

document.getElementById("spot-photo").onclick = () => {
  if (window.__addPendingPhoto) window.__addPendingPhoto();
};

document.getElementById("place-cancel").onclick = () => setPlacing(false);

// ПК: правый клик по карте — окно отметки прямо в точке курсора,
// прицел не нужен, точность задаёт сам курсор
map.on("contextmenu", e => {
  if (typeof e.originalEvent === "object" && e.originalEvent.preventDefault)
    e.originalEvent.preventDefault();
  if (placing) setPlacing(false);
  pendingLL = [e.latlng.lat, e.latlng.lng];
  document.getElementById("spot-name").value = "Найдено №" + (spots.length + 1);
  if (window.__renderPending) window.__renderPending();
  modal.classList.remove("hidden");
});

document.getElementById("spot-cancel").onclick = () => modal.classList.add("hidden");
// Тап по тёмному фону тоже закрывает модалку
modal.onclick = e => { if (e.target === modal) modal.classList.add("hidden"); };

document.getElementById("spot-save").onclick = () => {
  const s = {
    id: Date.now(),
    ll: pendingLL,
    type: selType.value,
    note: document.getElementById("spot-name").value.trim() || "Точка",
    ts: new Date().toLocaleString(),
  };
  spots.push(s);
  addSpotMarker(s);
  saveSpots();
  if (window.__commitPendingPhotos) window.__commitPendingPhotos(s.id);
  modal.classList.add("hidden");
};

// ===== СТРАНИЦА «СПИСОК НАХОДОК»: статистика, фильтр, список =====
let findsFilter = "all";

function renderFinds() {
  // Статистика по типам
  const statsEl = document.getElementById("finds-stats");
  const byType = {};
  spots.forEach(s => { byType[s.type] = (byType[s.type] || 0) + 1; });
  statsEl.innerHTML = "Всего находок: <b>" + spots.length + "</b> · " +
    Object.entries(byType).map(([t, n]) =>
      (SPOT_TYPES[t] || SPOT_TYPES.other).name + ": " + n).join(" · ");

  // Фильтр по типам
  const flt = document.getElementById("finds-filter");
  flt.innerHTML = "";
  const mkChip = (label, key, active) => {
    const b = document.createElement("button");
    b.className = "chip" + (active ? " active" : "");
    b.textContent = label;
    b.onclick = () => { findsFilter = key; renderFinds(); };
    return b;
  };
  flt.appendChild(mkChip("Все", "all", findsFilter === "all"));
  Object.entries(SPOT_TYPES).forEach(([k, v]) => {
    flt.appendChild(mkChip(v.name, k, findsFilter === k));
  });

  // Список с учётом фильтра
  const ul = document.getElementById("finds-list");
  ul.innerHTML = "";
  const shown = spots.filter(s => findsFilter === "all" || s.type === findsFilter);
  if (!shown.length) {
    ul.innerHTML = "<li style='color:#999'>Пока пусто. Отмечайте находки кнопкой 🎯 на карте.</li>";
    return;
  }
  shown.slice().reverse().forEach(s => {
    const li = document.createElement("li");
    li.innerHTML =
      `<span class="dot" style="background:${spotColor(s.type)}"></span>` +
      `<b>${escHtml(s.note)}</b>` +
      `${window.__photoBadge ? window.__photoBadge(s.id) : ""}` +
      `<span class="li-nav" data-nav="${s.id}">🧭</span>` +
      `<span class="li-del" data-del="${s.id}">🗑</span>` +
      `<small>${(SPOT_TYPES[s.type] || SPOT_TYPES.other).name} · ${escHtml(s.ts || "")} · ` +
      `${s.ll[0].toFixed(5)}, ${s.ll[1].toFixed(5)}</small>`;
    li.querySelector(".li-del").onclick = e => {
      e.stopPropagation();
      if (confirm("Удалить точку?")) removeSpot(s.id);
    };
    li.querySelector(".li-nav").onclick = e => {
      e.stopPropagation();
      if (window.__navTo) window.__navTo(s.ll, s.note);
    };
    li.onclick = () => {
      showView("map");
      setTimeout(() => map.setView(s.ll, 17), 50);
    };
    ul.appendChild(li);
  });
}

// Совместимость со старым вызовом из import.js
function renderSpots() { renderFinds(); }
