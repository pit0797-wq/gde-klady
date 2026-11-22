// ===== МЕНЮ И ПЕРЕКЛЮЧЕНИЕ СТРАНИЦ =====
const drawer = document.getElementById("menu-drawer");
const backdrop = document.getElementById("menu-backdrop");

function toggleDrawer(force) {
  const show = force !== undefined ? force : drawer.classList.contains("hidden");
  drawer.classList.toggle("hidden", !show);
  backdrop.classList.toggle("hidden", !show);
}

document.getElementById("btn-menu").onclick = () => toggleDrawer();
backdrop.onclick = () => toggleDrawer(false);

function showView(name) {
  ["view-finds", "view-coins", "view-weather", "view-antiques"].forEach(id =>
    document.getElementById(id).classList.toggle("hidden", id !== "view-" + name));
  toggleDrawer(false);
  if (window.__cancelPlacing) window.__cancelPlacing();
  if (window.__navOff) window.__navOff();
  if (name === "finds" && typeof renderFinds === "function") renderFinds();
  if (name === "coins") {
    // coins.js может быть не загружен — не роняем приложение
    if (typeof currentGroup !== "undefined") {
      const searchEl = document.getElementById("coin-search");
      searchEl.value = currentGroup ? "" : searchEl.value;
    }
    if (typeof renderCoins === "function") renderCoins();
  }
  if (name === "antiques" && typeof renderAntiques === "function") renderAntiques();
}
window.showView = showView;

// Пункты меню
document.querySelectorAll(".menu-item[data-view]").forEach(el =>
  el.onclick = () => showView(el.dataset.view));

// Кнопки «назад»
document.querySelectorAll(".btn-back").forEach(el =>
  el.onclick = () => showView(el.dataset.view));

// Быстрая кнопка 📋 на карте открывает список находок
document.getElementById("btn-list").onclick = () => showView("finds");

// О приложении — красивая модалка вместо alert
function showAbout() {
  const v = document.getElementById("about-version");
  if (v && typeof getAppVersion === "function") v.textContent = getAppVersion();
  document.getElementById("about-modal").classList.remove("hidden");
}
document.getElementById("menu-about").onclick = () => {
  toggleDrawer(false);
  showAbout();
};
document.getElementById("about-close").onclick = () =>
  document.getElementById("about-modal").classList.add("hidden");
document.getElementById("about-modal").addEventListener("click", (e) => {
  if (e.target.id === "about-modal")
    document.getElementById("about-modal").classList.add("hidden");
});

// ===== Установка приложения (PWA): ярлык на рабочем столе =====
let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvt = e;
});
window.addEventListener("appinstalled", () => { installEvt = null; });

function showInstall() {
  const modal = document.getElementById("install-modal");
  const body = document.getElementById("install-body");
  const ua = navigator.userAgent || "";
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const standalone = window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (standalone) {
    body.innerHTML = `<p>Приложение уже установлено — открывай его с рабочего стола, камрад 🪙</p>`;
  } else if (installEvt) {
    body.innerHTML =
      `<p>Поставить «ГдеКлады» как приложение: ярлык на рабочем столе,` +
      ` открывается без адресной строки и вкладок — как настоящая программа.</p>` +
      `<button id="btn-install-go" class="btn-install-go">📲 Установить</button>`;
    document.getElementById("btn-install-go").onclick = async () => {
      try { installEvt.prompt(); await installEvt.userChoice; } catch (err) {}
      installEvt = null;
      modal.classList.add("hidden");
    };
  } else if (isIOS) {
    body.innerHTML =
      `<p>На iPhone ярлык ставится через Safari:</p>` +
      `<ol><li>Нажми кнопку <b>«Поделиться»</b> внизу экрана.</li>` +
      `<li>Выбери <b>«На экран „Домой“»</b>.</li>` +
      `<li>Ткни <b>«Добавить»</b>.</li></ol>` +
      `<p>Ярлык с золотой монетой появится на рабочем столе.</p>`;
  } else {
    body.innerHTML =
      `<p>В этом браузере кнопку установки браузер пока не отдал — обычно она` +
      ` появляется не сразу после захода на сайт.</p>` +
      `<p>Ручной способ: <b>меню браузера (⋮)</b> → <b>«Установить приложение»</b>` +
      ` или <b>«Добавить на главный экран»</b>.</p>`;
  }
  modal.classList.remove("hidden");
}

document.getElementById("menu-install").onclick = () => {
  toggleDrawer(false);
  showInstall();
};
document.getElementById("install-close").onclick = () =>
  document.getElementById("install-modal").classList.add("hidden");
document.getElementById("install-modal").addEventListener("click", (e) => {
  if (e.target.id === "install-modal")
    document.getElementById("install-modal").classList.add("hidden");
});

// Подпись с версией и автором внизу меню
(function drawerFooter() {
  const drawer = document.getElementById("menu-drawer");
  if (!drawer) return;
  const foot = document.createElement("div");
  foot.className = "drawer-foot";
  foot.textContent = APP_NAME + " v" + APP_VERSION + " · " + APP_AUTHOR;
  drawer.appendChild(foot);
})();

// ===== Параллакс: фон чуть отстаёт при скролле =====
// Страницы скроллятся внутри себя, поэтому слушаем и окно, и сами страницы
const parallaxEl = () => document.getElementById("bg-parallax");
window.addEventListener("scroll", () => {
  const el = parallaxEl();
  if (el) el.style.transform = "translateY(" + (window.scrollY * 0.15) + "px)";
}, { passive: true });
document.querySelectorAll(".page").forEach(p =>
  p.addEventListener("scroll", () => {
    const el = parallaxEl();
    if (el) el.style.transform = "translateY(" + (p.scrollTop * 0.15) + "px)";
  }, { passive: true }));
