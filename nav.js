// ===== НАВИГАЦИЯ К ТОЧКЕ =====
// Стрелка компаса + расстояние до выбранной отметки. Направление
// учитывает азимут телефона, если компас доступен; иначе стрелка
// показывает направление на север (север — вверх экрана).

let navTarget = null;
let navHeading = null;
let navLastPos = null;
let navName = "";
let compassBound = false;

function navBearing(a, b) {
  const toRad = x => x * Math.PI / 180;
  const y = Math.sin(toRad(b[1] - a[1])) * Math.cos(toRad(b[0]));
  const x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) -
            Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(toRad(b[1] - a[1]));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function navDistance(a, b) {
  const R = 6371000, toRad = x => x * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function navUpdate() {
  if (!navTarget) return;
  const dist = document.getElementById("nav-dist");
  const brg = document.getElementById("nav-brg");
  const arrow = document.getElementById("nav-arrow");
  if (!dist || !brg || !arrow) return;

  if (!navLastPos) { dist.textContent = "ждём GPS…"; brg.textContent = navName; return; }

  const d = navDistance(navLastPos, navTarget);
  dist.textContent = d < 1000
    ? Math.round(d) + " м"
    : (d / 1000).toFixed(2).replace(".", ",") + " км";

  const b = navBearing(navLastPos, navTarget);
  brg.textContent = navName + " · азимут " + Math.round(b) + "°";

  // Стрелка: если знаем курс телефона — от него; иначе «север наверху»
  const rotation = (navHeading !== null) ? (b - navHeading) : b;
  arrow.style.transform = "rotate(" + Math.round(rotation) + "deg)";
}

function navOnOrientation(e) {
  let h = null;
  if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null)
    h = e.webkitCompassHeading;
  else if (e.absolute === true && e.alpha !== null)
    h = 360 - e.alpha;
  if (h !== null) { navHeading = h; navUpdate(); }
}

function navEnableCompass() {
  if (compassBound) return;
  const bind = () => {
    compassBound = true;
    const evt = ("ondeviceorientationabsolute" in window)
      ? "deviceorientationabsolute" : "deviceorientation";
    window.addEventListener(evt, navOnOrientation, true);
  };
  if (typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission()
      .then(r => { if (r === "granted") bind(); })
      .catch(() => {});
  } else {
    bind();
  }
}

window.__navSpotById = function (id) {
  const s = (typeof spots !== "undefined" ? spots : []).find(x => x.id === +id);
  if (s) window.__navTo(s.ll, s.note);
};

window.__navTo = function (ll, name) {
  if (!Array.isArray(ll) || ll.length !== 2) return;
  navTarget = [+ll[0], +ll[1]];
  navName = String(name || "Точка");
  navLastPos = null;
  const p = document.getElementById("nav-panel");
  document.getElementById("nav-name").textContent = navName;
  p.classList.remove("hidden");
  if (typeof startGpsWatch === "function") startGpsWatch();
  navEnableCompass();
  navUpdate();
};

window.__navOff = function () {
  navTarget = null;
  const p = document.getElementById("nav-panel");
  if (p) p.classList.add("hidden");
};

window.__navGpsError = function (msg) {
  const d = document.getElementById("nav-dist");
  if (navTarget && d) d.textContent = "GPS: " + msg;
};

document.getElementById("nav-close").onclick = () => window.__navOff();
