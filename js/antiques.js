// ===== КАТАЛОГ СТАРИНЫ (Меднолит-стиль) =====
// Всё создаётся ТОЛЬКО через админку: эпохи, предметы, фото по ссылкам.
// Данные лежат в localStorage и попадают в общий catalog.json.

const A_GROUPS_KEY = "antiqueGroups";
const A_ITEMS_KEY = "antiqueItems";

// Редкость по шкале каталогов старины: R1 — очень часто ... R10 — единичные
const ARARE = [
  "R1 · очень часто", "R2 · очень часто", "R3 · часто", "R4 · часто",
  "R5 · нечасто", "R6 · нечасто", "R7 · редко", "R8 · редко",
  "R9 · крайне редко", "R10 · единичные экземпляры",
];

let A = { groups: [], items: [], current: null, curItem: null };
let aAdmin = false;
let aAdminJustOn = false;

function loadAntiques() {
  try { A.groups = JSON.parse(localStorage.getItem(A_GROUPS_KEY)) || []; } catch (e) { A.groups = []; }
  try { A.items = JSON.parse(localStorage.getItem(A_ITEMS_KEY)) || []; } catch (e) { A.items = []; }
}
function saveAntiques() {
  localStorage.setItem(A_GROUPS_KEY, JSON.stringify(A.groups));
  localStorage.setItem(A_ITEMS_KEY, JSON.stringify(A.items));
  if (window.__markCatalogDirty) window.__markCatalogDirty();
}
window.__moveAEra = function (id, dir) {
  const i = A.groups.findIndex(g => g.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= A.groups.length) return;
  const t = A.groups[i]; A.groups[i] = A.groups[j]; A.groups[j] = t;
  saveAntiques(); renderAntiques();
};
window.__moveAItem = function (id, dir) {
  const it = A.items.find(x => x.id === id);
  if (!it) return;
  const same = A.items.filter(x => x.g === it.g);
  const p = same.findIndex(x => x.id === id);
  const q = p + dir;
  if (p < 0 || q < 0 || q >= same.length) return;
  const other = same[q];
  const i = A.items.indexOf(it), j = A.items.indexOf(other);
  const t = A.items[i]; A.items[i] = A.items[j]; A.items[j] = t;
  saveAntiques(); renderAntiques();
};
loadAntiques();

const aEsc = t => String(t ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const aUid = p => p + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
const aEra = id => A.groups.find(g => g.id === id);
function aIsAdmin() { return window.__coinsAdminOn ? window.__coinsAdminOn() : aAdmin; }

// ===== РЕНДЕР =====
function renderAntiques() {
  const ul = document.getElementById("a-list");
  const q = (document.getElementById("a-search").value || "").toLowerCase().trim();
  const det = document.getElementById("a-detail");
  det.classList.add("hidden");
  A.curItem = null;
  ul.innerHTML = "";
  document.getElementById("a-admin-bar").classList.toggle("hidden", !aAdmin);

  if (!A.groups.length) {
    ul.innerHTML = `<li class="a-empty">Каталог пока пуст.<br>Включи админ-режим (🔒) и добавь первую эпоху — потом предметы и фото по ссылкам.</li>`;
    if (aAdmin) renderAEraAddCard();
    return;
  }

  if (q) {
    A.items.forEach(it => {
      const g = aEra(it.g);
      const hay = ((it.n || "") + " " + (it.e || "") + " " + (it.t || "") + " " +
        (it.o || "") + " " + (it.m || "") + " " + (g ? g.name : "")).toLowerCase();
      if (!hay.includes(q)) return;
      ul.appendChild(aItemLi(it));
    });
    if (!ul.children.length)
      ul.innerHTML = "<li class='a-empty'>Ничего не найдено по запросу.</li>";
    if (aAdmin) renderAEraAddCard();
    return;
  }

  if (!A.current) {
    A.groups.forEach(g => {
      const cnt = A.items.filter(c => c.g === g.id).length;
      const li = document.createElement("li");
      li.className = "group-card";
      li.innerHTML =
        (g.img ? `<div class="gport"><img src="${aEsc(g.img)}" alt=""></div>` : `<div class="gport">🏺</div>`) +
        `<div class="ginfo"><b>${aEsc(g.name)}</b><small>${aEsc(g.short || "")}</small></div>` +
        `<div class="gcount">${cnt}</div>`;
      li.onclick = () => { A.current = g; renderAntiques(); };
      if (aAdmin) {
        const ed = document.createElement("span");
        ed.className = "admin-edit";
        ed.textContent = "✎";
        ed.onclick = e => { e.stopPropagation(); openAEraEditor(g, false); };
        li.appendChild(ed);
        if (window.__moveAEra) {
          ["↑", "↓"].forEach((ar, k) => {
            const mv = document.createElement("span");
            mv.className = "admin-move";
            mv.textContent = ar;
            mv.title = k === 0 ? "Выше в списке" : "Ниже в списке";
            mv.onclick = e => { e.stopPropagation(); window.__moveAEra(g.id, k === 0 ? -1 : 1); };
            li.appendChild(mv);
          });
        }
      }
      ul.appendChild(li);
    });
    if (aAdmin) renderAEraAddCard();
    return;
  }

  // внутри эпохи
  const g = A.current;
  const crumb = document.createElement("li");
  crumb.className = "group-header";
  crumb.innerHTML = `<b>← Все эпохи</b>`;
  crumb.onclick = () => { A.current = null; renderAntiques(); };
  ul.appendChild(crumb);
  A.items.filter(it => it.g === g.id).forEach(it => ul.appendChild(aItemLi(it)));
  if (!ul.querySelector(".item-card"))
    ul.innerHTML = `<li class="a-empty">В эпохе пока нет предметов.${aAdmin ? " Добавь первый — кнопка «＋ Предмет»." : ""}</li>`;
  if (aAdmin) {
    const add = document.createElement("li");
    add.className = "group-header";
    add.innerHTML = `<a class="gh-link a-new-item" href="javascript:void(0)">＋ Предмет</a>`;
    add.querySelector(".a-new-item").onclick = () => openAItemEditor(null, true);
    ul.appendChild(add);
  }
}

function renderAEraAddCard() {
  const ul = document.getElementById("a-list");
  const add = document.createElement("li");
  add.className = "group-card a-add-card";
  add.innerHTML = `<div class="gport">＋</div><div class="ginfo"><b>Добавить эпоху</b><small>категория предметов</small></div>`;
  add.onclick = () => openAEraEditor(null, true);
  ul.appendChild(add);
}

function aItemLi(it) {
  const g = aEra(it.g);
  const li = document.createElement("li");
  li.className = "item-card";
  const thumb = (it.img && it.img.length)
    ? `<div class="coin-thumb"><img src="${aEsc(it.img[0])}" alt=""></div>`
    : `<div class="coin-thumb noimg">🏺</div>`;
  const rare = ARARE[(it.r || 1) - 1] || ("R" + (it.r || 1));
  li.innerHTML =
    thumb +
    `<div class="coin-body"><b>${aEsc(it.n)}</b><span class="rare-${Math.min(3, Math.max(0, Math.floor((it.r || 1) / 4)))}">(${rare.split(" · ")[0]})</span>` +
    `<small>${aEsc(it.e || "")}${it.e ? " · " : ""}${aEsc(it.m || "")}</small>` +
    (it.d ? `<span class="cd-snip">${aEsc(String(it.d).length > 110 ? String(it.d).slice(0, 110).trim() + "…" : it.d)}</span>` : "") +
    `</div>`;
  li.onclick = () => { A.curItem = it; renderAItem(it, g); };
  if (aAdmin) {
    const ed = document.createElement("span");
    ed.className = "admin-edit";
    ed.textContent = "✎";
    ed.onclick = e => { e.stopPropagation(); openAItemEditor(it, false); };
    li.appendChild(ed);
    if (window.__moveAItem) {
      ["↑", "↓"].forEach((ar, k) => {
        const mv = document.createElement("span");
        mv.className = "admin-move";
        mv.textContent = ar;
        mv.title = k === 0 ? "Выше в списке" : "Ниже в списке";
        mv.onclick = e => { e.stopPropagation(); window.__moveAItem(it.id, k === 0 ? -1 : 1); };
        li.appendChild(mv);
      });
    }
  }
  return li;
}

function renderAItem(it, g) {
  const ul = document.getElementById("a-list");
  ul.innerHTML = "";
  const det = document.getElementById("a-detail");
  det.classList.remove("hidden");
  det.innerHTML = `
    <div class="page-head">
      <button class="btn-back" id="a-back-list">←</button>
      <h3>${aEsc(it.n)}</h3>
      <span></span>
    </div>
    ${(it.img && it.img.length) ? `
      <img id="a-main-img" class="a-hero-img" src="${aEsc(it.img[0])}" alt="">
      ${(it.img.length > 1) ? `<div class="a-thumbs">${it.img.map((u, i) =>
        `<img class="a-thumb${i === 0 ? " on" : ""}" src="${aEsc(u)}" data-i="${i}" alt="">`).join("")}</div>` : ""}
    ` : `<div class="a-empty">Фото пока не добавлены — их можно поставить через админку.</div>`}
    <div class="a-fields">
      <div class="a-row"><span>Эпоха</span><b>${aEsc(g ? g.name : "")}</b></div>
      <div class="a-row"><span>Датировка</span><b>${aEsc(it.e || "—")}</b></div>
      <div class="a-row"><span>Тип</span><b>${aEsc(it.t || "—")}</b></div>
      <div class="a-row"><span>Основные образы</span><b>${aEsc(it.o || "—")}</b></div>
      <div class="a-row"><span>Материал</span><b>${aEsc(it.m || "—")}</b></div>
      <div class="a-row"><span>Редкость</span><b>${aEsc(ARARE[(it.r || 1) - 1] || "R" + (it.r || 1))}</b></div>
      <div class="a-row"><span>Состояние</span><b>${aEsc(it.st || "—")}</b></div>
      <div class="a-row"><span>Габариты</span><b>${aEsc(it.sz || "—")}</b></div>
      <div class="a-row"><span>Вес</span><b>${aEsc(it.w || "—")}</b></div>
    </div>
    ${it.d ? `<p class="a-desc">${aEsc(it.d)}</p>` : ""}
  `;
  document.getElementById("a-back-list").onclick = () => { A.curItem = null; renderAntiques(); };
  det.querySelectorAll(".a-thumb").forEach(t => t.onclick = () => {
    document.getElementById("a-main-img").src = t.src;
    det.querySelectorAll(".a-thumb").forEach(x => x.classList.remove("on"));
    t.classList.add("on");
  });
}

// ===== АДМИН: вход через общую защиту (admin.js) =====
function enterAAdmin() {
  aAdmin = true;
  document.getElementById("a-admin-toggle").textContent = "⚙";
  document.getElementById("a-admin-toggle").classList.add("on");
  renderAntiques();
  if (typeof toast === "function") toast("Админ-режим включён: у эпох и предметов появились ✎");
}
function exitAAdmin() {
  aAdmin = false;
  const t = document.getElementById("a-admin-toggle");
  t.textContent = "🔒";
  t.classList.remove("on");
  closeAEditor();
  renderAntiques();
}

document.getElementById("a-admin-toggle").onclick = () => {
  if (aAdmin) { exitAAdmin(); return; }
  if (window.adminAuth) window.adminAuth.enter(enterAAdmin);
  else enterAAdmin();
};
document.getElementById("a-off").onclick = exitAAdmin;

// ===== АДМИН: РЕДАКТОРЫ =====
function closeAEditor() {
  const ov = document.getElementById("admin-editor");
  ov.classList.add("hidden");
  ov.innerHTML = "";
}

function openAEraEditor(g, isNew) {
  isNew = !!isNew;
  if (!g) g = { id: aUid("ep"), name: "", short: "", img: "" };
  const ov = document.getElementById("admin-editor");
  const delBtn = !isNew ? `<div class="row"><button id="ae-del" class="btn-danger">🗑 Удалить эпоху и её предметы</button></div>` : "";
  ov.innerHTML = `
    <div class="modal-card admin-card">
      <h3>${isNew ? "Новая эпоха" : "Эпоха"}</h3>
      <label>Название эпохи</label>
      <input id="ae-name" value="${aEsc(g.name || "")}" placeholder="например: Древняя Русь · домонгол">
      <label>Годы (кратко)</label>
      <input id="ae-short" value="${aEsc(g.short || "")}" placeholder="IX–XIII вв">
      <label>Картинка эпохи (ссылка)</label>
      <input id="ae-img" type="text" value="${aEsc(g.img || "")}" placeholder="https://…jpg или img/имя.jpg">
      <div class="admin-img-preview" id="ae-img-prev"></div>
      <div class="admin-hint">Показывается на карточке эпохи. Оставь пустым — будет 🏺.</div>
      <div class="row">
        <button id="ae-save">Сохранить</button>
        <button id="ae-cancel" class="btn-grey">Отмена</button>
      </div>
      ${delBtn}
    </div>`;
  ov.classList.remove("hidden");
  const prev = () => {
    const v = document.getElementById("ae-img").value.trim();
    document.getElementById("ae-img-prev").innerHTML = v ? `<img src="${aEsc(v)}" alt="">` : "";
  };
  document.getElementById("ae-img").addEventListener("input", prev);
  prev();
  document.getElementById("ae-cancel").onclick = closeAEditor;
  ov.onclick = e => { if (e.target === ov) closeAEditor(); };
  document.getElementById("ae-save").onclick = () => {
    const nv = {
      name: document.getElementById("ae-name").value.trim(),
      short: document.getElementById("ae-short").value.trim(),
      img: document.getElementById("ae-img").value.trim(),
    };
    if (!nv.name) return alert("Название эпохи не может быть пустым");
    if (isNew) { A.groups.push({ id: g.id, ...nv }); }
    else { const rec = A.groups.find(x => x.id === g.id); if (rec) Object.assign(rec, nv); }
    saveAntiques();
    closeAEditor();
    renderAntiques();
    if (typeof toast === "function") toast(isNew ? "Эпоха добавлена" : "Сохранено");
  };
  if (document.getElementById("ae-del")) {
    document.getElementById("ae-del").onclick = () => {
      if (!confirm("Удалить эпоху и ВСЕ её предметы? Действие не отменить.")) return;
      const gid = g.id;
      A.groups = A.groups.filter(x => x.id !== gid);
      A.items = A.items.filter(x => x.g !== gid);
      saveAntiques();
      closeAEditor();
      renderAntiques();
      if (typeof toast === "function") toast("Эпоха удалена");
    };
  }
}

function openAItemEditor(it, isNew) {
  isNew = !!isNew;
  if (!it) it = { id: aUid("it"), g: A.current ? A.current.id : (A.groups[0] ? A.groups[0].id : ""), n: "", e: "", t: "", o: "", m: "", r: 1, st: "", sz: "", w: "", d: "", img: [] };
  if (!A.groups.length) return alert("Сначала добавь хотя бы одну эпоху");
  const ov = document.getElementById("admin-editor");
  const delBtn = !isNew ? `<div class="row"><button id="ai-del" class="btn-danger">🗑 Удалить предмет</button></div>` : "";
  ov.innerHTML = `
    <div class="modal-card admin-card">
      <h3>${isNew ? "Новый предмет" : "Редактирование предмета"}</h3>
      <label>Эпоха</label>
      <select id="ai-g">${A.groups.map(g => `<option value="${aEsc(g.id)}" ${g.id === it.g ? "selected" : ""}>${aEsc(g.name)}</option>`).join("")}</select>
      <label>Название</label>
      <input id="ai-n" value="${aEsc(it.n || "")}" placeholder="например: Перстень «Засеянное поле»">
      <label>Датировка</label>
      <input id="ai-e" value="${aEsc(it.e || "")}" placeholder="XVII век">
      <label>Тип</label>
      <input id="ai-t" value="${aEsc(it.t || "")}" placeholder="Украшение / Пластика / Бытовое…">
      <label>Основные образы</label>
      <input id="ai-o" value="${aEsc(it.o || "")}" placeholder="Засеянное поле, птицы…">
      <label>Материал</label>
      <input id="ai-m" value="${aEsc(it.m || "")}" placeholder="Медный сплав, серебро…">
      <label>Редкость</label>
      <select id="ai-r">${ARARE.map((r, i) => `<option value="${i + 1}" ${(it.r || 1) === i + 1 ? "selected" : ""}>${r}</option>`).join("")}</select>
      <label>Состояние</label>
      <input id="ai-st" value="${aEsc(it.st || "")}" placeholder="Нормальное [VG]…">
      <label>Габариты</label>
      <input id="ai-sz" value="${aEsc(it.sz || "")}" placeholder="1.9 × 2 × 0.1 см">
      <label>Вес</label>
      <input id="ai-w" value="${aEsc(it.w || "")}" placeholder="3.9 г">
      <label>Описание</label>
      <textarea id="ai-d">${aEsc(it.d || "")}</textarea>
      <label>Фото по ссылкам (можно несколько)</label>
      <div class="a-imgrows" id="ai-imgs"></div>
      <div class="row"><button id="ai-addimg" class="btn-grey">＋ Ссылка на фото</button></div>
      <div class="admin-hint">Вставь прямые ссылки (https://…jpg) или пути к файлам репозитория (img/имя.jpg). Первая картинка — главная.</div>
      <div class="row">
        <button id="ai-save">Сохранить</button>
        <button id="ai-cancel" class="btn-grey">Отмена</button>
      </div>
      ${delBtn}
    </div>`;
  ov.classList.remove("hidden");

  const box = document.getElementById("ai-imgs");
  const addImgRow = (url) => {
    const row = document.createElement("div");
    row.className = "a-imgrow";
    row.innerHTML = `<img alt=""><input type="text" placeholder="https://…jpg" value="${aEsc(url || "")}"><button class="btn-grey" title="Убрать">✕</button>`;
    const upd = () => { const v = row.querySelector("input").value.trim(); row.querySelector("img").style.display = v ? "" : "none"; if (v) row.querySelector("img").src = v; };
    row.querySelector("input").addEventListener("input", upd);
    row.querySelector("button").onclick = () => row.remove();
    upd();
    box.appendChild(row);
  };
  (it.img || []).forEach(u => addImgRow(u));
  if (!it.img || !it.img.length) addImgRow("");
  document.getElementById("ai-addimg").onclick = () => addImgRow("");

  document.getElementById("ai-cancel").onclick = closeAEditor;
  ov.onclick = e => { if (e.target === ov) closeAEditor(); };
  document.getElementById("ai-save").onclick = () => {
    const nv = {
      g: document.getElementById("ai-g").value,
      n: document.getElementById("ai-n").value.trim(),
      e: document.getElementById("ai-e").value.trim(),
      t: document.getElementById("ai-t").value.trim(),
      o: document.getElementById("ai-o").value.trim(),
      m: document.getElementById("ai-m").value.trim(),
      r: parseInt(document.getElementById("ai-r").value, 10) || 1,
      st: document.getElementById("ai-st").value.trim(),
      sz: document.getElementById("ai-sz").value.trim(),
      w: document.getElementById("ai-w").value.trim(),
      d: document.getElementById("ai-d").value.trim(),
      img: Array.from(box.querySelectorAll("input"))
        .map(x => x.value.trim()).filter(Boolean),
    };
    if (!nv.n) return alert("Название предмета не может быть пустым");
    if (isNew) A.items.push({ id: it.id, ...nv });
    else { const rec = A.items.find(x => x.id === it.id); if (rec) Object.assign(rec, nv); }
    saveAntiques();
    closeAEditor();
    A.current = aEra(nv.g) || A.current;
    renderAntiques();
    if (typeof toast === "function") toast(isNew ? "Предмет добавлен" : "Сохранено");
  };
  if (document.getElementById("ai-del")) {
    document.getElementById("ai-del").onclick = () => {
      if (!confirm("Удалить предмет? Действие не отменить.")) return;
      A.items = A.items.filter(x => x.id !== it.id);
      saveAntiques();
      closeAEditor();
      renderAntiques();
      if (typeof toast === "function") toast("Предмет удалён");
    };
  }
}

// кнопки админ-бара
document.getElementById("a-new-era").onclick = () => openAEraEditor(null, true);
document.getElementById("a-new-item").onclick = () => openAItemEditor(null, true);

// ===== ЭКСПОРТ / ИМПОРТ / СБРОС (общий формат с монетами) =====
window.__antiquesExport = () => ({ antiqueGroups: A.groups.slice(), antiqueItems: A.items.slice() });
window.__antiquesImport = (data) => {
  if (!data || typeof data !== "object") return 0;
  const sg = Array.isArray(data.antiqueGroups) ? data.antiqueGroups : [];
  const si = Array.isArray(data.antiqueItems) ? data.antiqueItems : [];
  const gids = new Set(A.groups.map(g => g.id));
  const iids = new Set(A.items.map(x => x.id));
  let n = 0;
  sg.forEach(g => { if (g && g.id && !gids.has(g.id)) { A.groups.push(g); n++; } });
  si.forEach(x => { if (x && x.id && !iids.has(x.id)) { A.items.push(x); n++; } });
  if (n) { saveAntiques(); renderAntiques(); }
  return n;
};

document.getElementById("a-export").onclick = () => {
  const data = Object.assign({ app: "kopar-catalog-edit", ts: new Date().toISOString(),
    edits: (typeof loadCoinEdits === "function" ? loadCoinEdits() : {}),
    customGroups: (typeof loadCustomGroups === "function" ? loadCustomGroups() : []),
    customCoins: (typeof loadCustomCoins === "function" ? loadCustomCoins() : []) },
    window.__antiquesExport());
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = "kopar_catalog.json";
  a.click();
};

document.getElementById("a-export-gh").onclick = () => {
  const data = Object.assign({ app: "kopar-catalog-edit", ts: new Date().toISOString(),
    note: "Положите этот файл в корень репозитория рядом с index.html как catalog.json",
    edits: (typeof loadCoinEdits === "function" ? loadCoinEdits() : {}),
    customGroups: (typeof loadCustomGroups === "function" ? loadCustomGroups() : []),
    customCoins: (typeof loadCustomCoins === "function" ? loadCustomCoins() : []) },
    window.__antiquesExport());
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = "catalog.json";
  a.click();
};

document.getElementById("a-import").onclick = () => document.getElementById("a-file").click();
document.getElementById("a-file").onchange = function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== "object") throw new Error("это не файл правок приложения");
      // монеты (если функции доступны)
      let coinsInfo = "";
      if (typeof saveCoinEdits === "function") {
        saveCoinEdits(data.edits || {});
        saveCustomGroups(Array.isArray(data.customGroups) ? data.customGroups : []);
        saveCustomCoins(Array.isArray(data.customCoins) ? data.customCoins : []);
        if (typeof removeCustomFromLive === "function") removeCustomFromLive();
        if (typeof applyCustomData === "function") applyCustomData();
        if (typeof applyCoinEdits === "function") applyCoinEdits();
        if (typeof currentGroup !== "undefined") currentGroup = null;
        coinsInfo = ", монет " + (data.customCoins || []).length + ", правителей " + (data.customGroups || []).length;
        if (typeof renderCoins === "function") renderCoins();
      }
      const aN = window.__antiquesImport(data);
      alert("Импортировано: правок " + Object.keys(data.edits || {}).length +
        coinsInfo + ", эпох " + (data.antiqueGroups || []).length + ", предметов старины " + (data.antiqueItems || []).length +
        " (новых записей: " + aN + ")");
    } catch (e) {
      alert("Не удалось прочитать файл: " + e.message);
    }
    this.value = "";
  };
  reader.readAsText(file);
};

document.getElementById("a-reset").onclick = () => {
  if (!confirm("Сбросить ВЕСЬ каталог старины (эпохи и предметы)? Монеты не пострадают. Действие не отменить.")) return;
  localStorage.removeItem(A_GROUPS_KEY);
  localStorage.removeItem(A_ITEMS_KEY);
  loadAntiques();
  A.current = null;
  renderAntiques();
  if (typeof toast === "function") toast("Каталог старины очищен");
};

window.renderAntiques = renderAntiques;
