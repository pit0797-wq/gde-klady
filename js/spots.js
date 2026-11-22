// ===== КАТЕГОРИИ ТОЧЕК =====
// Иконка — эмодзи (попап, списки, фильтр), цвет — для маркеров и точек
const SPOT_TYPES = {
  find:      { name: "Находка",    icon: "💰", color: "#f80" },
  coin:      { name: "Монета",     icon: "🪙", color: "#c9a227" },
  stash:     { name: "Клад",       icon: "💎", color: "#8a2be2" },
  pit:       { name: "Яма",        icon: "🕳", color: "#8b4513" },
  building:  { name: "Фундамент",  icon: "🧱", color: "#666" },
  road:      { name: "Дорога",     icon: "🛤", color: "#228b22" },
  weapon:    { name: "Оружие",     icon: "⚔️", color: "#c0392b" },
  tool:      { name: "Инструмент", icon: "🔨", color: "#6b8e23" },
  jewel:     { name: "Украшение",  icon: "📿", color: "#e91e8c" },
  relic:     { name: "Религия",    icon: "✝️", color: "#946b4a" },
  ammo:      { name: "Военное",    icon: "💣", color: "#556b2f" },
  household: { name: "Бытовое",    icon: "🏺", color: "#d35400" },
  other:     { name: "Прочее",     icon: "❓", color: "#1f6feb" },
};

// Периоды находок: подсказки в поле + свободный ввод своего
const SPOT_PERIODS = [
  "Не определён",
  "Древность (до IX века)",
  "Древняя Русь (IX–XIII вв)",
  "Орда (XIII–XV вв)",
  "Московская Русь (XV–XVII вв)",
  "Петровская эпоха (кон. XVII–1725)",
  "XVIII век",
  "XIX век",
  "Начало XX века",
  "СССР",
  "Современность",
];

// Материалы находок — для статистики «на какой глубине что лежит»
const SPOT_MATERIALS = [
  "Медь", "Серебро", "Золото", "Железо", "Алюминий", "Олово/свинец",
  "Никель", "Латунь", "Стекло", "Керамика", "Кость", "Другое",
];

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

// ===== ПОПАП ТОЧКИ: описание, глубина, материал, привязанная монета =====
function spotPopupHtml(s) {
  const extras = [];
  if (s.dep != null) extras.push(s.dep + " см");
  if (s.mat) extras.push(escHtml(s.mat));
  if (s.period) extras.push("📅 " + escHtml(s.period));
  const coinLine = s.coin
    ? `<br>🪙 <a href="#" onclick="window.__openSpotCoin(${s.id});return false">${escHtml(s.coin.n || "монета")}</a>` +
      ` <a href="#" onclick="window.__unbindSpotCoin(${s.id});return false" title="Снять привязку">✂</a>` +
      ` · <a href="#" onclick="window.__bindSpotFromPopup(${s.id});return false">заменить</a>`
    : "";
  const tinfo = SPOT_TYPES[s.type] || SPOT_TYPES.other;
  return (
    `<b>${tinfo.icon || ""} ${tinfo.name}</b> — ${escHtml(s.note)}` +
    `<br><small>${escHtml(s.ts || "")}${extras.length ? " · " + extras.join(" · ") : ""}</small>` +
    coinLine +
    `<div class="spot-thumbs" id="sp-thumbs-${s.id}"></div>` +
    `<a href="#" onclick="window.__navSpotById(${s.id});return false">🧭 К точке</a> · ` +
    `<a href="#" onclick="window.__copySpotCoords(${s.id});return false">📋 Координаты</a> · ` +
    `<a href="#" onclick="window.__addPhotoToSpot(${s.id});return false">📷 Фото</a> · ` +
    `<a href="#" onclick="window.__editSpot(${s.id});return false">✎ Править</a> · ` +
    `<a href="#" onclick="window.__bindSpotFromPopup(${s.id});return false">🪙 Монета</a> · ` +
    `<a href="#" onclick="window.__removeSpot(${s.id});return false">🗑 Удалить</a>`
  );
}

function addSpotMarker(s) {
  const m = L.circleMarker(s.ll, { radius: 7, color: spotColor(s.type), fillOpacity: .9 })
    .addTo(map)
    .bindPopup(spotPopupHtml(s));
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
  if (window.__heatRefresh) window.__heatRefresh();
}

// Перерисовать маркер точки (после правки или привязки монеты)
function refreshSpotMarker(id) {
  const s = spots.find(x => x.id === id);
  if (!s) return;
  const m = spotMarkers[id];
  const wasOpen = m && m.isPopupOpen && m.isPopupOpen();
  if (m) map.removeLayer(m);
  addSpotMarker(s);
  if (wasOpen) spotMarkers[id].openPopup();
}
window.__refreshSpotMarker = refreshSpotMarker;

function removeSpot(id) {
  spots = spots.filter(s => s.id !== id);
  if (spotMarkers[id]) { map.removeLayer(spotMarkers[id]); delete spotMarkers[id]; }
  if (window.__deleteSpotPhotos) window.__deleteSpotPhotos(id);
  saveSpots();
  renderFinds();
}
window.__removeSpot = removeSpot;

// ===== МОДАЛКА НОВОЙ ТОЧКИ / ПРАВКИ =====
const modal = document.getElementById("spot-modal");
const selType = document.getElementById("spot-type");
const selMat = document.getElementById("spot-material");
const modalTitle = document.getElementById("spot-modal-title");

(function fillTypes() {
  if (!selType) return;
  Object.entries(SPOT_TYPES).forEach(([k, v]) => {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = (v.icon ? v.icon + " " : "") + v.name;
    selType.appendChild(opt);
  });
})();

(function fillMaterials() {
  if (!selMat) return;
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "— не указано";
  selMat.appendChild(opt0);
  SPOT_MATERIALS.forEach(m => {
    const o = document.createElement("option");
    o.value = m;
    o.textContent = m;
    selMat.appendChild(o);
  });
})();

let pendingLL = null;
let placing = false;
let editingSpotId = null;

function resetSpotFields() {
  document.getElementById("spot-name").value = "";
  document.getElementById("spot-depth").value = "";
  document.getElementById("spot-period").value = "";
  if (selMat) selMat.value = "";
}

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

function openSpotModal(isEdit) {
  editingSpotId = isEdit;
  modalTitle.textContent = isEdit ? "Правка отметки" : "Новая отметка";
  if (window.__renderPending) window.__renderPending(); // пустой список фото
  modal.classList.remove("hidden");
}

document.getElementById("place-ok").onclick = () => {
  const c = map.getCenter(); // центр экрана = перекрестие
  pendingLL = [c.lat, c.lng];
  setPlacing(false);
  editingSpotId = null;
  resetSpotFields();
  document.getElementById("spot-name").value = "Найдено №" + (spots.length + 1);
  openSpotModal(false);
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
  editingSpotId = null;
  resetSpotFields();
  document.getElementById("spot-name").value = "Найдено №" + (spots.length + 1);
  openSpotModal(false);
});

document.getElementById("spot-cancel").onclick = () => {
  editingSpotId = null;
  modal.classList.add("hidden");
};
// Тап по тёмному фону тоже закрывает модалку
modal.onclick = e => {
  if (e.target === modal) {
    editingSpotId = null;
    modal.classList.add("hidden");
  }
};

// ===== ПРАВКА СУЩЕСТВУЮЩЕЙ ТОЧКИ =====
window.__editSpot = function (id) {
  const s = spots.find(x => x.id === id);
  if (!s) return;
  editingSpotId = id;
  modalTitle.textContent = "Правка отметки";
  selType.value = (s.type in SPOT_TYPES) ? s.type : "other";
  document.getElementById("spot-name").value = s.note || "";
  document.getElementById("spot-depth").value = (s.dep != null) ? s.dep : "";
  document.getElementById("spot-period").value = s.period || "";
  if (selMat) selMat.value = s.mat || "";
  if (window.__renderPending) window.__renderPending();
  modal.classList.remove("hidden");
};

document.getElementById("spot-save").onclick = () => {
  const depRaw = document.getElementById("spot-depth").value;
  const dep = (depRaw !== "" && isFinite(+depRaw) && +depRaw >= 0)
    ? Math.min(999, Math.round(+depRaw)) : null;
  const mat = selMat ? selMat.value : "";
  const period = (document.getElementById("spot-period").value || "").trim().slice(0, 60);
  if (editingSpotId) {
    const s = spots.find(x => x.id === editingSpotId);
    if (s) {
      s.type = selType.value;
      s.note = document.getElementById("spot-name").value.trim() || "Точка";
      s.dep = dep;
      s.mat = mat;
      s.period = period;
      saveSpots();
      refreshSpotMarker(s.id);
      renderFinds();
      if (window.__commitPendingPhotos) window.__commitPendingPhotos(s.id);
    }
    editingSpotId = null;
    modal.classList.add("hidden");
    return;
  }
  const s = {
    id: Date.now(),
    ll: pendingLL,
    type: selType.value,
    note: document.getElementById("spot-name").value.trim() || "Точка",
    ts: new Date().toLocaleString(),
    iso: new Date().toISOString(),
    dep: dep,
    mat: mat,
    period: period,
  };
  spots.push(s);
  addSpotMarker(s);
  saveSpots();
  if (window.__commitPendingPhotos) window.__commitPendingPhotos(s.id);
  modal.classList.add("hidden");
};

// Копирование координат в буфер: клиппборд, а если браузер не даёт — через prompt
window.__copySpotCoords = function (id) {
  const s = spots.find(x => x.id === id);
  if (!s) return;
  const txt = s.ll[0].toFixed(6) + ", " + s.ll[1].toFixed(6);
  const done = () => { if (typeof toast === "function") toast("Скопировано: " + txt); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(done).catch(() => {
      window.prompt("Скопируй вручную:", txt);
    });
  } else {
    window.prompt("Скопируй вручную:", txt);
  }
};

// ===== ПРИВЯЗКА НАХОДКИ К МОНЕТЕ ИЗ КАТАЛОГА =====
// Жмёшь «🪙 Монета» в попапе → каталог открывается в режиме выбора.
window.__bindSpotFromPopup = function (id) {
  window.__bindSpotId = id;
  if (window.__openCoinCatalog) window.__openCoinCatalog();
  else if (window.showView) window.showView("coins");
};

window.__unbindSpotCoin = function (id) {
  const s = spots.find(x => x.id === id);
  if (!s) return;
  s.coin = null;
  saveSpots();
  refreshSpotMarker(id);
  renderFinds();
  if (typeof toast === "function") toast("Привязка снята");
};

// Открыть привязанную монету в каталоге (по id, иначе по группе+имени+году)
window.__openSpotCoin = function (id) {
  const sp = spots.find(x => x.id === id);
  if (!sp || !sp.coin) return;
  if (typeof COINS === "undefined" || typeof showCoin !== "function") return;
  let c = null;
  if (sp.coin._id) c = COINS.find(x => x._id === sp.coin._id);
  if (!c) c = COINS.find(x => x.g === sp.coin.g && x.n === sp.coin.n && x.y === sp.coin.y);
  if (!c) {
    if (typeof toast === "function") toast("Монета не найдена в каталоге");
    return;
  }
  window.showView("coins");
  if (typeof GROUPS !== "undefined" && typeof currentGroup !== "undefined") {
    currentGroup = GROUPS.find(g => g.id === c.g) || null;
  }
  if (typeof renderCoins === "function") renderCoins();
  showCoin(c);
};

// ===== ДАТЫ И СЕЗОН =====
// Дата точки: новые хранят iso; старые — строку toLocaleString (ДД.ММ.ГГГГ, ЧЧ:ММ)
function parseSpotDate(s) {
  if (s.iso) {
    const d = new Date(s.iso);
    return isNaN(d) ? null : d;
  }
  const m = String(s.ts || "").match(/(\d{2})\.(\d{2})\.(\d{4}),?\s*(\d{1,2}):(\d{2})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
  const d = new Date(s.ts || "");
  return isNaN(d) ? null : d;
}

// ===== СТРАНИЦА «СПИСОК НАХОДОК»: статистика, сезон, фильтр, список =====
let findsFilter = "all";

function renderSeason() {
  const seasonEl = document.getElementById("finds-season");
  if (!seasonEl) return;
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1);
  let start = localStorage.getItem("seasonStart") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    start = now.getFullYear() + "-04-01";
    try { localStorage.setItem("seasonStart", start); } catch (e) {}
  }
  const s0 = new Date(start + "T00:00:00");
  let cToday = 0, cMonth = 0, cSeason = 0;
  spots.forEach(s => {
    const d = parseSpotDate(s);
    if (!d) return;
    if (d >= t0) cToday++;
    if (d >= m0) cMonth++;
    if (d >= s0) cSeason++;
  });
  // Средняя глубина по материалам: «на какой глубине что лежит»
  const byMat = {};
  spots.forEach(s => {
    if (!s.mat || s.dep == null || !(s.dep >= 0)) return;
    const b = byMat[s.mat] || { n: 0, sum: 0 };
    b.n++; b.sum += s.dep;
    byMat[s.mat] = b;
  });
  const matRows = Object.entries(byMat)
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 4)
    .map(([m, b]) => `${escHtml(m)}: ${b.n} · ср. ${Math.round(b.sum / b.n)} см`)
    .join(" · ");
  const km = window.__trackKm ? window.__trackKm() : 0;
  seasonEl.innerHTML =
    `<span>📈 Сегодня: <b>${cToday}</b></span>` +
    `<span>За месяц: <b>${cMonth}</b></span>` +
    `<span>За сезон: <b>${cSeason}</b></span>` +
    `<span>Всего: <b>${spots.length}</b></span>` +
    `<span>🧭 Трек: <b>${km.toFixed(1)} км</b></span>` +
    `${matRows ? `<small class="fs-mat">${matRows}</small>` : ""}` +
    `<button id="btn-season-set" class="chip">🗓 Начало сезона</button>`;
  const sb = document.getElementById("btn-season-set");
  if (sb) sb.onclick = () => {
    const p = prompt("Начало копательного сезона (ГГГГ-ММ-ДД):", start);
    if (p === null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.trim()))
      return alert("Формат даты: ГГГГ-ММ-ДД, например 2026-04-01");
    localStorage.setItem("seasonStart", p.trim());
    renderFinds();
  };
}

function renderFinds() {
  // Статистика по типам
  const statsEl = document.getElementById("finds-stats");
  const byType = {};
  spots.forEach(s => { byType[s.type] = (byType[s.type] || 0) + 1; });
  statsEl.innerHTML = "Всего находок: <b>" + spots.length + "</b> · " +
    Object.entries(byType).map(([t, n]) =>
      (SPOT_TYPES[t] || SPOT_TYPES.other).name + ": " + n).join(" · ");

  renderSeason();

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
    flt.appendChild(mkChip((v.icon ? v.icon + " " : "") + v.name, k, findsFilter === k));
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
    const extras = [];
    if (s.dep != null) extras.push(s.dep + " см");
    if (s.mat) extras.push(escHtml(s.mat));
    const coinTag = s.coin
      ? `<span class="s-coin" data-coin="${s.id}">🪙 ${escHtml(s.coin.n || "монета")}</span>`
      : "";
    const tInfo = SPOT_TYPES[s.type] || SPOT_TYPES.other;
    const li = document.createElement("li");
    li.innerHTML =
      `<span class="dot" style="background:${spotColor(s.type)}"></span>` +
      `<b>${escHtml(s.note)}</b>` +
      `${window.__photoBadge ? window.__photoBadge(s.id) : ""}` +
      `<span class="li-nav" data-nav="${s.id}">🧭</span>` +
      `<span class="li-del" data-del="${s.id}">🗑</span>` +
      `<small>${tInfo.icon || ""} ${tInfo.name} · ${escHtml(s.ts || "")}` +
      `${s.period ? " · 📅 " + escHtml(s.period) : ""} · ` +
      `${s.ll[0].toFixed(5)}, ${s.ll[1].toFixed(5)}` +
      `${extras.length ? " · " + extras.join(" · ") : ""} ${coinTag}</small>`;
    li.querySelector(".li-del").onclick = e => {
      e.stopPropagation();
      if (confirm("Удалить точку?")) removeSpot(s.id);
    };
    li.querySelector(".li-nav").onclick = e => {
      e.stopPropagation();
      if (window.__navTo) window.__navTo(s.ll, s.note);
    };
    const coinEl = li.querySelector(".s-coin");
    if (coinEl) coinEl.onclick = e => {
      e.stopPropagation();
      window.__openSpotCoin(s.id);
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
