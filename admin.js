// ===== АДМИН-РЕЖИМ КАТАЛОГА МОНЕТ =====
// После входа по паролю (хранится только хэш) редактирование доступно прямо
// в каталоге: ✎ у монет и эпох, кнопки «＋ Монета» в шапке эпохи и
// панель внизу страницы. PIN — защита от случайного входа, не от взлома:
// приложение целиком работает в браузере.
//
// Что и где хранится (localStorage):
//   adminSecret   — соль + SHA-256 пароля админки (сам пароль не хранится)
//   coinEdits     — правки базовых монет и правителей (пофildовым diff)
//   customGroups  — созданные правители/эпохи (id начинается с "cust")
//   customCoins   — созданные монеты (id начинается с "custom")
// Базовый каталог coins.js не изменяется: «Оригинал» всегда доступен.

const ADMIN_PIN_KEY = "adminPin";
const EDITS_KEY = "coinEdits";
const CUSTOM_GROUPS_KEY = "customGroups";
const CUSTOM_COINS_KEY = "customCoins";

let adminUnlocked = false;
window.adminIsOn = () => adminUnlocked;

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || fallback) || fallback; }
  catch (e) { return fallback; }
}
function saveJson(key, val, what) {
  try { localStorage.setItem(key, JSON.stringify(val)); }
  catch (e) { if (typeof toast === "function") toast("Не удалось сохранить " + what + ": хранилище переполнено"); }
}

function loadCoinEdits()    { return loadJson(EDITS_KEY, {}); }
function saveCoinEdits(ed)  { saveJson(EDITS_KEY, ed, "правки"); window.__markCatalogDirty(); }
function loadCustomGroups() { return loadJson(CUSTOM_GROUPS_KEY, "[]"); }
function saveCustomGroups(a){ saveJson(CUSTOM_GROUPS_KEY, a, "правителей"); window.__markCatalogDirty(); }
function loadCustomCoins()  { return loadJson(CUSTOM_COINS_KEY, "[]"); }
function saveCustomCoins(a) { saveJson(CUSTOM_COINS_KEY, a, "монеты"); window.__markCatalogDirty(); }

// ===== НЕОПУБЛИКОВАННЫЕ ПРАВКИ (каталог.json) =====
// Любое сохранение в админке помечает состояние «грязным»: на кнопке
// «📤 GitHub» загорается красная точка, пока файл не отправлен в репозиторий.
window.__markCatalogDirty = function () {
  if (window.__suppressDirty) return;
  try { localStorage.setItem("catalogDirty", "1"); } catch (e) {}
  window.__updateDirtyBadge();
};
window.__clearCatalogDirty = function () {
  try { localStorage.removeItem("catalogDirty"); } catch (e) {}
  window.__updateDirtyBadge();
};
window.__updateDirtyBadge = function () {
  const dirty = !!localStorage.getItem("catalogDirty");
  ["adm-export-gh", "a-export-gh"].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.classList.toggle("dirty", dirty);
  });
};
window.__updateDirtyBadge();

// ===== ИСХОДНЫЕ ЗНАЧЕНИЯ И ПРИМЕНЕНИЕ ПРАВОК =====
function rememberOrig(c) {
  if (c._orig) return;
  c._orig = { n: c.n, y: c.y, m: c.m, w: c.w, s: c.s, r: c.r,
              d: c.d, q: c.q, q2: c.q2, img: c.img };
}
function applyEditToCoin(c, e) {
  ["n", "y", "m", "w", "s", "d", "q", "q2"].forEach(k => {
    if (typeof e[k] === "string") c[k] = e[k];
  });
  if (typeof e.r === "number" && e.r >= 0 && e.r <= 3) c.r = e.r;
  if (e.img === null) { delete c.img; c._imgs = []; }               // фото убрано намеренно
  else if (typeof e.img === "string" && e.img) { c.img = e.img; c._imgs = undefined; }
}
function restoreCoin(c) {
  if (!c._orig) return;
  Object.assign(c, c._orig);
  delete c.img;
  if (c._orig.img) c.img = c._orig.img;
  c._imgs = undefined;
}

function rememberGroupOrig(g) {
  if (g._gorig) return;
  g._gorig = { name: g.name, short: g.short, wiki: g.wiki, u: g.u, img: g.img };
}
function applyEditToGroup(g, e) {
  ["name", "short", "wiki", "u"].forEach(k => {
    if (typeof e[k] === "string") g[k] = e[k];
  });
  // Пустая строка снимает ссылку: возвращается портрет из Википедии
  if (typeof e.img === "string") {
    if (e.img) g.img = e.img; else delete g.img;
  }
}
function restoreGroup(g) {
  if (!g._gorig) return;
  Object.assign(g, g._gorig);
  if (!g._gorig.img) delete g.img;
}

// Идентификатор базовой монеты — g#индекс: стабилен между сеансами,
// поэтому название монеты можно менять свободно, не теряя правки.
// Кастомные монеты несут свой _id ("custom" + время создания) в записи.
function applyCoinEdits() {
  const edits = loadCoinEdits();
  COINS.forEach((c, i) => {
    rememberOrig(c);
    if (!c._id) c._id = c.g + "#" + i;
    const e = edits[c._id];
    if (e) applyEditToCoin(c, e);
  });
  GROUPS.forEach(g => {
    rememberGroupOrig(g);
    const ge = edits["grp:" + g.id];
    if (ge) applyEditToGroup(g, ge);
  });
}

// ===== КАСТОМНЫЕ ПРАВИТЕЛИ И МОНЕТЫ =====
function isCustomGroup(g) { return String(g.id || "").startsWith("cust"); }
function isCustomCoin(c)  { return !!c._custom; }

function applyCustomData() {
  loadCustomGroups().forEach(g => {
    g._custom = true;
    if (!GROUPS.some(x => x.id === g.id)) GROUPS.push(g);
  });
  loadCustomCoins().forEach(cc => {
    if (COINS.some(x => x._id === cc._id)) return;
    COINS.push(cc);
  });
}

function removeCustomFromLive() {
  for (let i = COINS.length - 1; i >= 0; i--)
    if (isCustomCoin(COINS[i])) COINS.splice(i, 1);
  for (let i = GROUPS.length - 1; i >= 0; i--)
    if (isCustomGroup(GROUPS[i])) GROUPS.splice(i, 1);
  COINS.forEach(restoreCoin);
  GROUPS.forEach(restoreGroup);
}

// Применяем всё один раз при загрузке — до первой отрисовки каталога
applyCustomData();
applyCoinEdits();

// ===== ОБЩИЙ КАТАЛОГ: catalog.json из репозитория =====
// Файл выкладывается рядом с приложением (например, на GitHub Pages).
// Правки и созданные монеты из него видны всем посетителям; локальные
// правки устройства остаются поверх общего каталога.
// Фото монет: можно указывать и data-URL (как в админке), и путь к файлу
// в репозитории — например "img/moya-moneta.jpg".
(function loadSharedCatalog() {
  if (!/^https?:$/.test(location.protocol)) return; // при file:// не бывает
  fetch("catalog.json", { cache: "no-store" })
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(data => {
      if (!data || typeof data !== "object") return;
      if (data.app && data.app !== "kopar-catalog-edit") return;
      // правки: общий файл как база, локальные правки устройства поверх
      const mergedEdits = Object.assign({}, data.edits || {}, loadCoinEdits());
      const sharedGroups = Array.isArray(data.customGroups) ? data.customGroups : [];
      const sharedCoins = Array.isArray(data.customCoins) ? data.customCoins : [];
      const groups = loadCustomGroups();
      const gids = new Set(groups.map(g => g.id));
      let newGroups = 0;
      sharedGroups.forEach(g => {
        if (g && g.id && !gids.has(g.id)) { groups.push(g); newGroups++; }
      });
      const coinsArr = loadCustomCoins();
      const cids = new Set(coinsArr.map(c => c.id));
      let newCoins = 0;
      sharedCoins.forEach(c => {
        if (c && c.id && !cids.has(c.id)) { coinsArr.push(c); newCoins++; }
      });
      const aShared = window.__antiquesImport ? window.__antiquesImport(data) : 0;
      const needApply =
        Object.keys(data.edits || {}).length || newGroups || newCoins || aShared;
      if (!needApply) return;
      window.__suppressDirty = true;
      try {
        saveCoinEdits(mergedEdits);
        saveCustomGroups(groups);
        saveCustomCoins(coinsArr);
        removeCustomFromLive();
        applyCustomData();
        applyCoinEdits();
      } finally { window.__suppressDirty = false; }
      if (typeof toast === "function")
        toast("Общий каталог обновлён: правок " + Object.keys(mergedEdits).length +
          ", монет добавлено " + newCoins + ", правителей " + newGroups +
          (aShared ? ", старины " + aShared : ""));
    })
    .catch(() => {}); // файла нет или сеть недоступна — обычный локальный каталог
})();

// ===== ВХОД И ВЫХОД ИЗ АДМИН-РЕЖИМА =====
function enterAdminMode() {
  adminUnlocked = true;
  document.getElementById("admin-bar").classList.remove("hidden");
  const t = document.getElementById("admin-toggle");
  t.textContent = "⚙";
  t.classList.add("on");
  if (typeof renderCoins === "function") renderCoins();
  if (typeof toast === "function") toast("Админ-режим включён: у монет и эпох появились ✎");
}

function exitAdminMode() {
  adminUnlocked = false;
  document.getElementById("admin-bar").classList.add("hidden");
  const t = document.getElementById("admin-toggle");
  t.textContent = "🔒";
  t.classList.remove("on");
  closeAdminEditor();
  if (typeof renderCoins === "function") renderCoins();
}

function askPin() {
  const m = document.getElementById("pin-modal");
  const inp = document.getElementById("pin-input");
  inp.value = "";
  m.classList.remove("hidden");
  setTimeout(() => inp.focus(), 60);
}
function closePin() {
  document.getElementById("pin-modal").classList.add("hidden");
}

document.getElementById("admin-toggle").onclick = () => {
  if (adminUnlocked) exitAdminMode();
  else window.adminAuth.enter(enterAdminMode);
};
document.getElementById("pin-cancel").onclick = closePin;
document.getElementById("pin-eye").onclick = () => {
  const i = document.getElementById("pin-input");
  i.type = i.type === "password" ? "text" : "password";
};
document.getElementById("pin-input").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("pin-ok").onclick();
});

// ===== ЗАЩИТА АДМИНКИ =====
// Пароль в чистом виде нигде не хранится: в localStorage лежит только
// случайная соль и SHA-256 от "соль:пароль:соль". Подобрать по хэшу
// можно только перебором, в коде пароля нет.
const ADMIN_SECRET_KEY = "adminSecret"; // соль + SHA-256; ADMIN_PIN_KEY выше — старый формат для миграции

const AK = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];

function sha256hex(msg) {
  const bytes = new TextEncoder().encode(msg);
  const l = bytes.length;
  const total = Math.ceil((l + 9) / 64) * 64;
  const m = new Uint8Array(total);
  m.set(bytes);
  m[l] = 0x80;
  const bl = l * 8;
  for (let i = 0; i < 8; i++) m[total - 8 + i] = (bl / Math.pow(2, (7 - i) * 8)) & 255;
  let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const w = new Array(64);
  const rr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++)
      w[i] = (m[off + 4*i] << 24) | (m[off + 4*i + 1] << 16) | (m[off + 4*i + 2] << 8) | m[off + 4*i + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i-15], 7) ^ rr(w[i-15], 18) ^ (w[i-15] >>> 3);
      const s1 = rr(w[i-2], 17) ^ rr(w[i-2], 19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    const hv = [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + AK[i] + w[i]) | 0;
      const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H = [0,1,2,3,4,5,6,7].map(i => (H[i] + [a,b,c,d,e,f,g,h][i]) | 0);
  }
  return H.map(x => ("00000000" + ((x >>> 0).toString(16))).slice(-8)).join("");
}

function adminSalt() {
  let s = "";
  for (let i = 0; i < 24; i++) s += "0123456789abcdef"[(Math.random() * 16) | 0];
  return s;
}
function adminHash(salt, pw) { return sha256hex(salt + ":" + pw + ":" + salt); }
function adminSetSecret(pw) {
  const s = adminSalt();
  localStorage.setItem(ADMIN_SECRET_KEY, JSON.stringify({ s, h: adminHash(s, pw) }));
}
function adminGetSecret() {
  try { return JSON.parse(localStorage.getItem(ADMIN_SECRET_KEY) || "null"); } catch (e) { return null; }
}
function adminVerify(pw) {
  const sec = adminGetSecret();
  return !!sec && adminHash(sec.s, pw) === sec.h;
}
// миграция: старый открытый PIN превращаем в хэш и стираем
(function () {
  const old = localStorage.getItem(ADMIN_PIN_KEY);
  if (old) { adminSetSecret(old); localStorage.removeItem(ADMIN_PIN_KEY); }
})();

// Единый вход в админку для всех каталогов (монеты, старина)
window.adminAuth = {
  enter(onOk) {
    const modal = document.getElementById("pin-modal");
    const inp = document.getElementById("pin-input");
    const create = !adminGetSecret();
    document.getElementById("pin-title").textContent = create ? "Придумайте пароль админки" : "Вход в админку";
    document.getElementById("pin-label").textContent = create ? "Пароль (минимум 4 символа)" : "PIN-код или пароль";
    inp.value = "";
    modal.classList.remove("hidden");
    setTimeout(() => inp.focus(), 60);
    document.getElementById("pin-ok").onclick = () => {
      const v = inp.value;
      if (create) {
        if (v.trim().length < 4) return alert("Слишком короткий: минимум 4 символа");
        adminSetSecret(v);
        closePin();
        if (typeof toast === "function") toast("Пароль админки установлен");
        onOk();
      } else {
        const lock = sessionStorage.getItem("adminLockUntil");
        if (lock && +lock > Date.now())
          return alert("Слишком много попыток. Подождите " + Math.ceil((+lock - Date.now()) / 1000) + " с.");
        if (adminVerify(v)) {
          sessionStorage.removeItem("adminFails");
          closePin();
          onOk();
        } else {
          const fails = (+sessionStorage.getItem("adminFails") || 0) + 1;
          sessionStorage.setItem("adminFails", fails);
          if (fails >= 5) {
            sessionStorage.setItem("adminLockUntil", Date.now() + 60000);
            sessionStorage.removeItem("adminFails");
            alert("5 неверных попыток — вход заблокирован на минуту");
          } else {
            alert("Неверный пароль. Попыток до блокировки: " + (5 - fails));
          }
        }
      }
    };
  },
  changePin() {
    const p = prompt("Новый пароль админки (минимум 4 символа):");
    if (p === null) return;
    if (p.trim().length < 4) return alert("Слишком короткий: минимум 4 символа");
    adminSetSecret(p.trim());
    alert("Пароль изменён и хранится только в виде хэша. Запишите его — без него админка не откроется.");
  },
};

document.getElementById("adm-pin-change").onclick = () => window.adminAuth.changePin();

// ===== ВЕРСИЯ ПРИЛОЖЕНИЯ: менять через админку =====
function askAppVersion() {
  const cur = (typeof getAppVersion === "function") ? getAppVersion() : APP_VERSION;
  const p = prompt("Номер версии приложения (например 1.1.0):", cur);
  if (p === null) return;
  const v = p.trim();
  if (!/^\d+\.\d+(\.\d+)?$/.test(v))
    return alert("Формат: цифры и точки, например 1.2.0 или 2.0");
  localStorage.setItem("appVersion", v);
  const el = document.getElementById("about-version");
  if (el) el.textContent = v;
  if (typeof toast === "function") toast("Версия приложения: " + v);
}
document.getElementById("adm-version").onclick = askAppVersion;
document.getElementById("a-version").onclick = askAppVersion;
document.getElementById("adm-off").onclick = exitAdminMode;

// ===== РЕДАКТОР МОНЕТЫ =====
function updateAdminPreview(url, boxId) {
  const prev = document.getElementById(boxId || "adm-img-prev");
  if (!prev) return;
  prev.innerHTML = url
    ? `<img src="${escA(url)}" alt="">`
    : `<span class="admin-hint">Фото подгружается автоматически<br>либо будет честная заглушка</span>`;
}

function fillAdminPicks(imgs) {
  const box = document.getElementById("adm-picks");
  if (!box) return;
  box.innerHTML = (imgs && imgs.length)
    ? imgs.map(im =>
        `<div class="pick"><img src="${escA(im.t)}" data-full="${escA(im.f)}" alt=""></div>`).join("")
    : `<div class="admin-hint">Варианты не нашлись — попробуйте другой поисковый запрос.</div>`;
  box.querySelectorAll(".pick").forEach(pick => {
    pick.onclick = () => {
      document.getElementById("adm-img").value = pick.querySelector("img").dataset.full;
      box.querySelectorAll(".pick").forEach(p => p.classList.remove("sel"));
      pick.classList.add("sel");
      updateAdminPreview(pick.querySelector("img").dataset.full);
    };
  });
}

function groupOptions(selected) {
  return GROUPS.map(x =>
    `<option value="${escA(x.id)}" ${x.id === selected ? "selected" : ""}>${escHtml(x.name)}</option>`
  ).join("");
}

// Редактирование существующей монеты
window.__adminEditCoin = function (c) { openCoinEditor(c, false); };
window.__adminEditCoinById = function (id) {
  const c = COINS.find(x => x._id === id);
  if (c) openCoinEditor(c, false);
};

// Создание новой монеты (из панели или из шапки эпохи)
window.__adminNewCoin = function (g) {
  const draft = {
    g: g ? g.id : (currentGroup ? currentGroup.id : GROUPS[0].id),
    _custom: true,
    _id: "custom" + Date.now(),
    n: "", y: "", m: "", w: "", s: "", r: 0, d: "", q: "", q2: "",
  };
  openCoinEditor(draft, true);
};

function openCoinEditor(c, isNew) {
  isNew = !!isNew;
  const ov = document.getElementById("admin-editor");
  const groupSel = (isNew || isCustomCoin(c))
    ? `<label>Эпоха / правитель</label><select id="adm-g">${groupOptions(c.g)}</select>`
    : "";
  const delBtn = isCustomCoin(c)
    ? `<div class="row"><button id="adm-del-coin" class="btn-danger">🗑 Удалить монету</button></div>` : "";

  ov.innerHTML =
    `<div class="modal-card admin-card">
      <h3>${isNew ? "Новая монета" : "Редактирование монеты"}</h3>
      <div class="admin-img-preview" id="adm-img-prev"></div>
      ${groupSel}
      <label>Название</label>
      <input id="adm-n" value="${escA(c.n || "")}">
      <label>Годы</label>
      <input id="adm-y" value="${escA(c.y || "")}">
      <label>Металл</label>
      <input id="adm-m" value="${escA(c.m || "")}">
      <label>Вес</label>
      <input id="adm-w" value="${escA(c.w || "")}">
      <label>Размер</label>
      <input id="adm-s" value="${escA(c.s || "")}">
      <label>Редкость</label>
      <select id="adm-r">
        ${RARE.map((r, i) => `<option value="${i}" ${i === c.r ? "selected" : ""}>${i} — ${r}</option>`).join("")}
      </select>
      <label>Описание</label>
      <textarea id="adm-d">${escHtml(c.d || "")}</textarea>
      <label>Поисковый запрос для фото (рус)</label>
      <input id="adm-q" value="${escA(c.q || "")}">
      <label>Поисковый запрос для фото (англ)</label>
      <input id="adm-q2" value="${escA(c.q2 || "")}">
      <label>Прямая ссылка на фото</label>
      <div class="row">
        <input id="adm-img" type="url" value="${escA(c.img || "")}" placeholder="https://…jpg">
        <button id="adm-check-img" class="btn-grey" title="Проверить, открывается ли ссылка">👁</button>
      </div>
      <div class="admin-hint">Оставьте поле пустым — фото возьмётся из Википедии/Commons автоматически.</div>
      <label>Поиск вариантов фото на Commons</label>
      <div class="row">
        <input id="adm-search-img" placeholder="например: 5 kopeks 1770 copper">
        <button id="adm-search-btn">Искать</button>
      </div>
      <div id="adm-picks" class="admin-picks"></div>
      <div class="row">
        <button id="adm-save">Сохранить</button>
        ${isNew ? "" : `<button id="adm-orig" class="btn-grey">Оригинал</button>`}
        <button id="adm-cancel" class="btn-grey">Отмена</button>
      </div>
      ${isNew ? "" : `<div class="row"><button id="adm-copy" class="btn-grey">⧉ Копия монеты</button></div>`}
      ${delBtn}
    </div>`;
  ov.classList.remove("hidden");

  // Превью и варианты фото — только для уже существующей монеты
  if (!isNew) {
    loadCoinImages(c).then(imgs => {
      if (!document.getElementById("adm-img-prev")) return; // редактор уже закрыли
      updateAdminPreview(imgs && imgs.length ? imgs[0].t : "");
      fillAdminPicks(imgs);
    });
  } else {
    updateAdminPreview("");
  }

  document.getElementById("adm-search-btn").onclick = () => {
    const q = document.getElementById("adm-search-img").value.trim();
    if (!q) return;
    fillAdminPicks([]);
    commonsQuery(q).then(imgs => {
      if (!document.getElementById("adm-picks")) return;
      fillAdminPicks(imgs);
    });
  };

  document.getElementById("adm-cancel").onclick = closeAdminEditor;
  ov.onclick = e => { if (e.target === ov) closeAdminEditor(); };

  const saveBtn = document.getElementById("adm-save");
  if (document.getElementById("adm-orig")) {
    document.getElementById("adm-orig").onclick = () => {
      if (!confirm("Вернуть заводские значения этой монеты?")) return;
      const edits = loadCoinEdits();
      delete edits[c._id];
      saveCoinEdits(edits);
      restoreCoin(c);
      closeAdminEditor();
      if (typeof renderCoins === "function") renderCoins();
    };
  }
  if (document.getElementById("adm-copy")) {
    document.getElementById("adm-copy").onclick = () => {
      const g = id => document.getElementById(id);
      const draft = {
        g: g("adm-g") ? g("adm-g").value : (c.g || (GROUPS[0] ? GROUPS[0].id : "")),
        _custom: true,
        _id: "custom" + Date.now(),
        n: (g("adm-n").value.trim() || c.n || "Монета") + " (копия)",
        y: g("adm-y").value.trim(), m: g("adm-m").value.trim(),
        w: g("adm-w").value.trim(), s: g("adm-s").value.trim(),
        r: parseInt(g("adm-r").value, 10) || 0,
        d: g("adm-d").value, q: g("adm-q").value.trim(), q2: g("adm-q2").value.trim(),
        img: g("adm-img").value.trim(),
      };
      closeAdminEditor();
      openCoinEditor(draft, true);
      if (typeof toast === "function") toast("Копия создана — проверь поля и нажми Сохранить");
    };
  }
  if (document.getElementById("adm-check-img")) {
    document.getElementById("adm-check-img").onclick = () => {
      const url = document.getElementById("adm-img").value.trim();
      if (!url) {
        updateAdminPreview("");
        if (typeof toast === "function") toast("Сначала вставь ссылку на фото");
        return;
      }
      const img = new Image();
      img.onload = () => {
        if (!document.getElementById("adm-img-prev")) return;
        updateAdminPreview(url);
        if (typeof toast === "function") toast("Фото открывается ✅");
      };
      img.onerror = () => {
        if (!document.getElementById("adm-img-prev")) return;
        if (typeof toast === "function") toast("Ссылка не открывается ❌");
      };
      img.src = url;
    };
  }
  if (document.getElementById("adm-del-coin")) {
    document.getElementById("adm-del-coin").onclick = () => {
      if (!confirm("Удалить эту монету навсегда?")) return;
      const arr = loadCustomCoins().filter(x => x._id !== c._id);
      saveCustomCoins(arr);
      const ci = COINS.findIndex(x => x._id === c._id);
      if (ci >= 0) COINS.splice(ci, 1);
      const edits = loadCoinEdits();
      delete edits[c._id];
      saveCoinEdits(edits);
      closeAdminEditor();
      if (typeof renderCoins === "function") renderCoins();
      if (typeof toast === "function") toast("Монета удалена");
    };
  }

  saveBtn.onclick = () => {
    const g = id => document.getElementById(id);
    const nv = {
      n: g("adm-n").value.trim(), y: g("adm-y").value.trim(),
      m: g("adm-m").value.trim(), w: g("adm-w").value.trim(),
      s: g("adm-s").value.trim(), r: parseInt(g("adm-r").value, 10),
      d: g("adm-d").value, q: g("adm-q").value.trim(), q2: g("adm-q2").value.trim(),
      img: g("adm-img").value.trim(),
    };
    if (!nv.n) return alert("Название не может быть пустым");
    if (!(nv.r >= 0 && nv.r <= 3)) return alert("Некорректная редкость");

    if (isNew) {
      // Новая монета — всегда кастомная, сохраняем запись целиком
      if (document.getElementById("adm-g")) c.g = document.getElementById("adm-g").value;
      Object.assign(c, nv);
      if (nv.img) c.img = nv.img; else delete c.img;
      c._imgs = undefined;
      const arr = loadCustomCoins();
      arr.push({
        _id: c._id, _custom: true, g: c.g, n: c.n, y: c.y, m: c.m,
        w: c.w, s: c.s, r: c.r, d: c.d, q: c.q, q2: c.q2,
        img: c.img !== undefined ? c.img : undefined,
      });
      saveCustomCoins(arr);
      COINS.push(c);
      closeAdminEditor();
      if (typeof renderCoins === "function") renderCoins();
      if (typeof toast === "function") toast("Монета добавлена");
      return;
    }

    // Существующая монета
    if (isCustomCoin(c) && document.getElementById("adm-g")) {
      // Перенос кастомной монеты в другую эпоху
      const ng = document.getElementById("adm-g").value;
      if (ng !== c.g) {
        c.g = ng;
        const arr = loadCustomCoins();
        const rec = arr.find(x => x._id === c._id);
        if (rec) rec.g = ng;
        saveCustomCoins(arr);
      }
    }

    const orig = c._orig;
    const e = {};
    ["n", "y", "m", "w", "s", "d", "q", "q2"].forEach(k => {
      if (nv[k] !== (orig[k] || "")) e[k] = nv[k];
    });
    if (nv.r !== orig.r) e.r = nv.r;
    const imgNew = nv.img || null;
    if (imgNew !== (orig.img || null)) e.img = imgNew;

    if (isCustomCoin(c)) {
      // Кастомная монета: правка хранится в самой записи
      const arr = loadCustomCoins();
      const rec = arr.find(x => x._id === c._id);
      if (rec) {
        Object.assign(rec, nv);
        rec.img = nv.img || undefined;
      }
      saveCustomCoins(arr);
      Object.assign(c, nv);
      if (nv.img) c.img = nv.img; else delete c.img;
      c._imgs = undefined;
    } else {
      const edits = loadCoinEdits();
      if (Object.keys(e).length) edits[c._id] = e; else delete edits[c._id];
      saveCoinEdits(edits);
      restoreCoin(c);
      if (Object.keys(e).length) applyEditToCoin(c, e);
      c._imgs = undefined;
    }
    closeAdminEditor();
    if (typeof renderCoins === "function") renderCoins();
    if (typeof toast === "function") toast("Правки сохранены");
  };
}

// ===== РЕДАКТОР ПРАВИТЕЛЯ / ЭПОХИ =====
window.__adminEditGroup = function (g) { openGroupEditor(g, false); };

window.__adminNewGroup = function () {
  openGroupEditor({
    id: "cust" + Date.now(), _custom: true,
    name: "", short: "", wiki: "", u: "",
  }, true);
};

function openGroupEditor(g, isNew) {
  isNew = !!isNew;
  const ov = document.getElementById("admin-editor");
  const delBtn = (!isNew && isCustomGroup(g))
    ? `<div class="row"><button id="adg-del" class="btn-danger">🗑 Удалить правителя и его монеты</button></div>` : "";

  ov.innerHTML =
    `<div class="modal-card admin-card">
      <h3>${isNew ? "Новый правитель" : "Правитель / эпоха"}</h3>
      <label>Название эпохи</label>
      <input id="adg-name" value="${escA(g.name || "")}">
      <label>Годы (кратко)</label>
      <input id="adg-short" value="${escA(g.short || "")}">
      <label>Статья Википедии (для портрета)</label>
      <input id="adg-wiki" value="${escA(g.wiki || "")}" placeholder="Например: Пётр I">
      <div class="admin-hint">Портрет возьмётся из статьи Википедии, если она существует.</div>
      <label>Прямая ссылка на портрет (URL)</label>
      <input id="adg-img" type="url" value="${escA(g.img || "")}" placeholder="https://…jpg/png">
      <div class="admin-img-preview" id="adg-img-prev"></div>
      <div class="admin-hint">Ссылка перекроет портрет из Википедии. Оставь пустым — вернётся Википедия.</div>
      <label>Ссылка на каталог uCoin</label>
      <input id="adg-u" type="url" value="${escA(g.u || "")}" placeholder="https://…">
      <div class="row">
        <button id="adg-save">Сохранить</button>
        <button id="adg-cancel" class="btn-grey">Отмена</button>
      </div>
      ${delBtn}
    </div>`;
  ov.classList.remove("hidden");

  document.getElementById("adg-cancel").onclick = closeAdminEditor;
  ov.onclick = e => { if (e.target === ov) closeAdminEditor(); };
  updateAdminPreview(g.img || "", "adg-img-prev");
  document.getElementById("adg-img").addEventListener("input", e => {
    const v = e.target.value.trim();
    updateAdminPreview(v, "adg-img-prev");
  });

  if (document.getElementById("adg-del")) {
    document.getElementById("adg-del").onclick = () => {
      if (!confirm("Удалить правителя и ВСЕ его монеты? Действие не отменить.")) return;
      const gid = g.id;
      saveCustomGroups(loadCustomGroups().filter(x => x.id !== gid));
      const removedIds = COINS.filter(x => x.g === gid).map(x => x._id);
      saveCustomCoins(loadCustomCoins().filter(x => x.g !== gid));
      for (let i = COINS.length - 1; i >= 0; i--) if (COINS[i].g === gid) COINS.splice(i, 1);
      const gi = GROUPS.findIndex(x => x.id === gid);
      if (gi >= 0) GROUPS.splice(gi, 1);
      const edits = loadCoinEdits();
      removedIds.forEach(id => delete edits[id]);
      delete edits["grp:" + gid];
      saveCoinEdits(edits);
      currentGroup = null;
      closeAdminEditor();
      if (typeof renderCoins === "function") renderCoins();
      if (typeof toast === "function") toast("Правитель удалён");
    };
  }

  document.getElementById("adg-save").onclick = () => {
    const nv = {
      name: document.getElementById("adg-name").value.trim(),
      short: document.getElementById("adg-short").value.trim(),
      wiki: document.getElementById("adg-wiki").value.trim(),
      u: document.getElementById("adg-u").value.trim(),
      img: document.getElementById("adg-img") ?
        document.getElementById("adg-img").value.trim() : "",
    };
    if (!nv.name) return alert("Название эпохи не может быть пустым");

    if (isCustomGroup(g)) {
      Object.assign(g, nv);
      const arr = loadCustomGroups();
      const rec = arr.find(x => x.id === g.id);
      if (rec) Object.assign(rec, nv);
      saveCustomGroups(arr);
    } else {
      const orig = g._gorig;
      const diff = {};
      ["name", "short", "wiki", "u", "img"].forEach(k => {
        if (nv[k] !== (orig[k] || "")) diff[k] = nv[k];
      });
      const edits = loadCoinEdits();
      if (Object.keys(diff).length) edits["grp:" + g.id] = diff;
      else delete edits["grp:" + g.id];
      saveCoinEdits(edits);
      restoreGroup(g);
      applyEditToGroup(g, diff);
    }
    closeAdminEditor();
    if (typeof renderCoins === "function") renderCoins();
    if (typeof toast === "function") toast(isNew ? "Правитель добавлен" : "Правки сохранены");
  };
}

// ===== ПОРЯДОК КАСТОМНЫХ ЗАПИСЕЙ (стрелки ↑↓) =====
window.__moveCustomCoin = function (id, dir) {
  const arr = loadCustomCoins();
  const it = arr.find(x => x._id === id);
  if (!it) return;
  const same = arr.filter(x => x.g === it.g);
  const p = same.findIndex(x => x._id === id);
  const q = p + dir;
  if (q < 0 || q >= same.length) return;
  const other = same[q];
  const i = arr.indexOf(it), j = arr.indexOf(other);
  const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  saveCustomCoins(arr);
  removeCustomFromLive();
  applyCustomData();
  if (typeof renderCoins === "function") renderCoins();
};
window.__moveCustomGroup = function (id, dir) {
  const arr = loadCustomGroups();
  const i = arr.findIndex(x => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  saveCustomGroups(arr);
  removeCustomFromLive();
  applyCustomData();
  if (typeof renderCoins === "function") renderCoins();
};

// ===== ПРЯМАЯ ПУБЛИКАЦИЯ catalog.json НА GITHUB =====
// Через Contents API: GET получает sha файла, PUT отправляет новую версию.
// Токен (Fine-grained, право Contents: Read and write) хранится только
// в localStorage этого устройства.
function ghGuessRepo() {
  try {
    if (location.hostname.endsWith(".github.io")) {
      const owner = location.hostname.split(".")[0];
      const repo = location.pathname.split("/").filter(Boolean)[0] || "";
      if (repo) return owner + "/" + repo;
    }
  } catch (e) {}
  return "";
}
function ghPermissionHint() {
  return "GitHub отказал в записи (403: Resource not accessible by personal access token).\n\n" +
    "Токен есть, но у него нет права ПИСАТЬ в этот репозиторий. Как исправить:\n" +
    "1. github.com → аватар → Settings → Developer settings → Personal access tokens → Fine-grained tokens.\n" +
    "2. Открой свой токен (или создай новый: Generate new token).\n" +
    "3. Repository access: «Only select repositories» → выбери gde-klady (пустой список = нет доступа никуда).\n" +
    "4. Permissions → Repository permissions → Contents → «Read and write» (не «Read-only»!).\n" +
    "5. Если токен Classic — нужна галочка scope «repo».\n" +
    "6. Проверь, что срок действия не истёк.\n\n" +
    "Потом введи токен заново: админка → «🔑 Токен».";
}
async function ghJson(res) {
  const ct = (res.headers.get("content-type") || "");
  if (!ct.includes("json")) {
    throw new Error("GitHub API не ответил JSON (обычно это сеть или ограничение провайдера). Попробуй позже или с мобильного интернета, либо загрузи catalog.json в репозиторий через сайт.");
  }
  return res.json();
}
function ghHeaders(token) {
  return {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}
function ghCatalogBody() {
  return JSON.stringify({
    app: "kopar-catalog-edit",
    ts: new Date().toISOString(),
    edits: loadCoinEdits(),
    customGroups: loadCustomGroups(),
    customCoins: loadCustomCoins(),
    ...(window.__antiquesExport ? window.__antiquesExport() : {}),
  }, null, 2);
}
window.__adminGHPush = async function () {
  let repo = localStorage.getItem("ghRepo") || ghGuessRepo();
  let token = localStorage.getItem("ghToken");
  if (!token || !repo) {
    const r = prompt("Репозиторий (owner/repo):", repo || "");
    if (!r || !r.includes("/")) return;
    repo = r.trim();
    const t = prompt("Токен GitHub (Fine-grained, право Contents: Read and write). Хранится только в этом браузере:", "");
    if (!t) return;
    token = t.trim();
    localStorage.setItem("ghRepo", repo);
    localStorage.setItem("ghToken", token);
  }
  const btns = [document.getElementById("adm-github-push"), document.getElementById("a-github-push")];
  const oldText = btns.map(b => (b ? b.textContent : null));
  btns.forEach(b => { if (b) b.textContent = "⏳ …"; });
  try {
    const api = "https://api.github.com/repos/" + repo + "/contents/catalog.json";
    let sha = null;
    const gr = await fetch(api, { headers: ghHeaders(token) });
    if (gr.ok) sha = (await ghJson(gr)).sha;
    else if (gr.status === 401) {
      localStorage.removeItem("ghToken");
      alert("Токен не принят (401). Нажми «🔑 Токен» и введи свежий.");
      return;
    } else if (gr.status === 403) { alert(ghPermissionHint()); return; }
    else if (gr.status !== 404) throw new Error("GitHub ответил " + gr.status);
    const res = await fetch(api, {
      method: "PUT",
      headers: ghHeaders(token),
      body: JSON.stringify({
        message: "Обновление catalog.json из ГдеКлады · " + new Date().toLocaleString("ru-RU"),
        content: btoa(unescape(encodeURIComponent(ghCatalogBody()))),
        ...(sha ? { sha: sha } : {}),
      }),
    });
    if (res.ok) {
      window.__clearCatalogDirty();
      if (typeof toast === "function") toast("catalog.json обновлён на GitHub ✔");
    } else if (res.status === 401) {
      localStorage.removeItem("ghToken");
      alert("Токен не принят (401). Нажми «🔑 Токен» и введи свежий.");
    } else if (res.status === 403) {
      alert(ghPermissionHint());
    } else {
      const j = await res.json().catch(() => ({}));
      alert("GitHub не принял файл (" + res.status + (j && j.message ? ": " + j.message : "") + ")");
    }
  } catch (e) {
    alert("Не удалось отправить: " + e.message);
  } finally {
    btns.forEach((b, i) => { if (b) b.textContent = oldText[i]; });
  }
};
window.__adminGHToken = function () {
  const cur = localStorage.getItem("ghToken");
  const t = prompt("Токен GitHub для загрузки catalog.json.\n\nПустая строка — оставить прежний, «-» — удалить.", cur ? "●●●●●●●●" : "");
  if (t === null) return;
  const v = t.trim();
  if (v === "") return;
  if (v === "-") {
    localStorage.removeItem("ghToken");
    if (typeof toast === "function") toast("Токен удалён с этого устройства");
    return;
  }
  localStorage.setItem("ghToken", v);
  const r = prompt("Репозиторий (owner/repo):", localStorage.getItem("ghRepo") || ghGuessRepo());
  if (r && r.includes("/")) localStorage.setItem("ghRepo", r.trim());
  if (typeof toast === "function") toast("Токен сохранён — жми «☁ На GitHub»");
};
document.getElementById("adm-github-push").onclick = () => window.__adminGHPush();
document.getElementById("a-github-push").onclick = () => window.__adminGHPush();
document.getElementById("adm-token").onclick = () => window.__adminGHToken();
document.getElementById("a-token").onclick = () => window.__adminGHToken();

// ＋ Правитель / ＋ Монета в админ-баре (раньше не были подключены)
document.getElementById("adm-new-ruler").onclick = () => window.__adminNewGroup();
document.getElementById("adm-new-coin").onclick = () => window.__adminNewCoin(currentGroup || null);

function closeAdminEditor() {
  const ov = document.getElementById("admin-editor");
  ov.classList.add("hidden");
  ov.innerHTML = "";
}

// ===== ЭКСПОРТ / ИМПОРТ / СБРОС =====
document.getElementById("adm-export").onclick = () => {
  const data = {
    app: "kopar-catalog-edit",
    ts: new Date().toISOString(),
    edits: loadCoinEdits(),
    customGroups: loadCustomGroups(),
    customCoins: loadCustomCoins(),
    ...(window.__antiquesExport ? window.__antiquesExport() : {}),
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = "kopar_catalog.json";
  a.click();
};

// Экспорт общего каталога: файл кладётся в корень репозитория как catalog.json
document.getElementById("adm-export-gh").onclick = () => {
  const data = {
    app: "kopar-catalog-edit",
    ts: new Date().toISOString(),
    note: "Положите этот файл в корень репозитория рядом с index.html как catalog.json",
    edits: loadCoinEdits(),
    customGroups: loadCustomGroups(),
    customCoins: loadCustomCoins(),
    ...(window.__antiquesExport ? window.__antiquesExport() : {}),
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = "catalog.json";
  a.click();
  alert("Файл catalog.json скачан.\n\nПоложите его в корень репозитория " +
    "(рядом с index.html) и закоммитьте — после этого все посетители сайта " +
    "увидят ваш каталог.\n\nСовет: если фото монет встроены в файл, он может " +
    "весить десятки МБ. Легче — сохранить фото отдельными файлами в папку img/ " +
    "и в поле фото монеты указать путь вида img/имя.jpg — путь тоже работает.");
};

document.getElementById("adm-import").onclick = () => document.getElementById("admin-file").click();

document.getElementById("admin-file").onchange = function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== "object")
        throw new Error("это не файл правок приложения");
      saveCoinEdits(data.edits || {});
      saveCustomGroups(Array.isArray(data.customGroups) ? data.customGroups : []);
      saveCustomCoins(Array.isArray(data.customCoins) ? data.customCoins : []);
      const aN = window.__antiquesImport ? window.__antiquesImport(data) : 0;
      removeCustomFromLive();
      applyCustomData();
      applyCoinEdits();
      currentGroup = null;
      if (typeof renderCoins === "function") renderCoins();
      alert("Импортировано: правок " + Object.keys(data.edits || {}).length +
        ", правителей " + (data.customGroups || []).length +
        ", монет " + (data.customCoins || []).length +
        ", предметов старины " + (data.antiqueItems || []).length + " (новых: " + aN + ")");
    } catch (e) {
      alert("Не удалось прочитать файл: " + e.message);
    }
    this.value = "";
  };
  reader.readAsText(file);
};

document.getElementById("adm-reset-all").onclick = () => {
  if (!confirm("Сбросить ВСЕ правки, правителей и монеты каталога? Действие не отменить.")) return;
  localStorage.removeItem(EDITS_KEY);
  localStorage.removeItem(CUSTOM_GROUPS_KEY);
  localStorage.removeItem(CUSTOM_COINS_KEY);
  removeCustomFromLive();
  currentGroup = null;
  if (typeof renderCoins === "function") renderCoins();
  if (typeof toast === "function") toast("Каталог возвращён к исходному виду");
};
