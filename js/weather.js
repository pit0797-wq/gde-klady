// ===== ПОГОДА И НЕБО, камрад =====
// Погода: Open-Meteo (без ключей). Поиск населённого пункта —
// геокодер Open-Meteo (тоже без ключей, понимает русский).
// Солнце и луна считаются локально — работают даже без сети.
// Магнитная активность (Kp): NOAA SWPC; недоступен — «нет данных».

const WEATHER_CACHE_KEY = "weatherCache";
const WPLACE_KEY = "weatherPlace";

// Фразы камрада: для каждой погоды — свой говор
const PHRASES = {
  ok: [
    "Камрад, небо даёт добро — копай, сигнал ждать не будет.",
    "Сухо и ровно: самое время выйти на цель.",
    "Погода копателю на руку — лопата уже скучает.",
    "Хороший день, чтобы стать богаче на пару монет.",
    "Небо спокойное, трава не мокрая — иди туда, где тишина."
  ],
  wet: [
    "Камрад, дождь: копать не очень приятно, вещи будут мокрые.",
    "Небо хмурится — лопата подождёт лучшего дня.",
    "Морось поливает: яма станет болотом быстрее, чем сигнал находкой.",
    "Дождливая погода — копать так себе, разве что за компанию.",
    "С крыш капает, а промокшие сапоги сохнут неделю.",
    "Дождь идёт: техника мокнуть не любит, камрад."
  ],
  wind: [
    "Ветер разгулялся: фольгу из кармана унесёт, и копать некомфортно.",
    "Камрад, порывы сильные — не сигнал звенит, а катушка скрежещет.",
    "Ветер такой, что шляпу держи: копать можно, но весело."
  ],
  heat: [
    "Жара, камрад: копай с перерывами и воду не забудь.",
    "Солнце печёт так, что себя выкопаешь быстрее монеты.",
    "Жарко: до полудня порой, потом в тень и пей воду."
  ],
  cold: [
    "Мороз: земля как камень, копать тяжело и холодно.",
    "Камрад, холод пробирает — шевелись, а то замёрзнешь быстрее лопаты.",
    "Землю пора топить чаем: в такой мороз яма не ласкает."
  ],
  storm: [
    "Гроза! Металлоискатель в чехол, а тебя — под крышу, камрад.",
    "Гром и молния: в поле с приёмником стоять не надо."
  ],
  fog: [
    "Туман: и не видно, и сыро — день для дома и каталога.",
    "Туман стелется: сигнал будешь искать, а находку — в тумане."
  ]
};

const WMO = { 0: "Ясно", 1: "Преимущественно ясно", 2: "Переменная облачность",
  3: "Пасмурно", 45: "Туман", 48: "Изморозь", 51: "Морось", 53: "Морось",
  55: "Сильная морось", 56: "Ледяная морось", 57: "Ледяная морось",
  61: "Небольшой дождь", 63: "Дождь", 65: "Сильный дождь",
  66: "Ледяной дождь", 67: "Ледяной дождь", 71: "Небольшой снег", 73: "Снег",
  75: "Сильный снег", 77: "Снежные зёрна", 80: "Ливень", 81: "Ливень",
  82: "Сильный ливень", 85: "Снегопад", 86: "Сильный снегопад",
  95: "Гроза", 96: "Гроза с градом", 99: "Гроза с градом" };
const WMO_ICON = { 0: "☀️", 1: "🌤", 2: "⛅", 3: "☁️", 45: "🌫", 48: "🌫",
  51: "🌦", 53: "🌦", 55: "🌦", 56: "🌧", 57: "🌧", 61: "🌧", 63: "🌧",
  65: "🌧", 66: "🌧", 67: "🌧", 71: "🌨", 73: "🌨", 75: "🌨", 77: "🌨",
  80: "🌧", 81: "🌧", 82: "⛈", 85: "🌨", 86: "🌨", 95: "⛈", 96: "⛈", 99: "⛈" };
const WMO_WET = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];

function fetchTO(url, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms || 8000);
  return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t));
}

function fmtHM(iso) { return iso ? iso.slice(11, 16) : "—"; }

function fmtTemp(v) {
  if (typeof v !== "number" || !isFinite(v)) return "—";
  return (v > 0 ? "+" : "") + Math.round(v) + "°";
}

// Фраза не должна прыгать при каждом обновлении — берём по часу
function phrase(cat) {
  const arr = PHRASES[cat] || PHRASES.ok;
  const seed = Math.floor(Date.now() / 3600000) + cat.length;
  return arr[seed % arr.length];
}

// ===== Место: сохранённый населённый пункт или GPS =====
function getSavedPlace() {
  try { return JSON.parse(localStorage.getItem(WPLACE_KEY) || "null"); }
  catch (e) { return null; }
}

function fixFor(place) {
  return new Promise((resolve) => {
    if (place && place.lat) {
      resolve({ lat: place.lat, lon: place.lon, name: place.name });
      return;
    }
    const fallback = () => {
      try {
        const m = window.map || (typeof map !== "undefined" ? map : null);
        if (m) {
          const c = m.getCenter();
          resolve({ lat: c.lat, lon: c.lng, name: null, src: "по центру карты" });
          return;
        }
        resolve({ lat: START_POINT[0], lon: START_POINT[1], name: null, src: "по точке старта" });
      } catch (e) {
        resolve({ lat: START_POINT[0], lon: START_POINT[1], name: null, src: "по точке старта" });
      }
    };
    if (!navigator.geolocation) { fallback(); return; }
    try {
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, name: null, src: "по GPS" }),
        fallback,
        { timeout: 6000, maximumAge: 300000 });
    } catch (e) { fallback(); }
  });
}

// ===== СОЛНЦЕ (локальный расчёт, упрощённый алгоритм NOAA) =====
function sunTimesLocal(date, lat, lon) {
  const rad = Math.PI / 180, dayMs = 86400000, J1970 = 2440587.5, J2000 = 2451545;
  const toJulian = t => t / dayMs + J1970;
  const fromJulian = j => (j - J1970) * dayMs;
  const toDays = t => toJulian(t) - J2000;
  const e = rad * 23.4397;
  const solarMeanAnomaly = d => rad * (357.5291 + 0.98560028 * d);
  const eclipticLongitude = M => {
    const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    return M + C + rad * 102.9372 + Math.PI;
  };
  const declination = l => Math.asin(Math.sin(e) * Math.sin(l));
  const julianCycle = (d, lw) => Math.round(d - 0.0009 - lw / (2 * Math.PI));
  const approxTransit = (Ht, lw, n) => 0.0009 + (Ht + lw) / (2 * Math.PI) + n;
  const solarTransitJ = (ds, M, L) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const hourAngle = (h, phi, d) =>
    Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d)));

  const lw = rad * -lon, phi = rad * lat;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const Jnoon = solarTransitJ(ds, M, L);
  const h0 = -0.833 * rad;
  try {
    const w = hourAngle(h0, phi, dec);
    const Jset = solarTransitJ(approxTransit(w, lw, n), M, L);
    const Jrise = Jnoon - (Jset - Jnoon);
    return { rise: fromJulian(Jrise), set: fromJulian(Jset) };
  } catch (err) { return null; }
}

// ===== ЛУНА =====
function moonInfo(now) {
  const synodic = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14);
  let ph = ((now - ref) / 86400000) % synodic;
  ph = (ph + synodic) % synodic;
  const frac = ph / synodic;
  const illum = Math.round((1 - Math.cos(2 * Math.PI * frac)) / 2 * 100);
  const idx = Math.round(frac * 8) % 8;
  const names = ["Новолуние", "Растущий серп", "Первая четверть", "Растущая луна",
    "Полнолуние", "Убывающая луна", "Последняя четверть", "Убывающий серп"];
  return { icon: ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"][idx], name: names[idx], illum };
}

// ===== ПОИСК НАСЕЛЁННОГО ПУНКТА =====
let placeList = [];

async function findPlaces(q) {
  const box = document.getElementById("wplace-results");
  if (!q || q.trim().length < 2) { box.classList.add("hidden"); return; }
  box.innerHTML = "<div class='wp-sr'>Ищу «" + q.trim() + "»…</div>";
  box.classList.remove("hidden");
  try {
    const r = await fetchTO("https://geocoding-api.open-meteo.com/v1/search" +
      "?name=" + encodeURIComponent(q.trim()) + "&count=10&language=ru&format=json", 8000);
    if (!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    placeList = (j.results || []).map(x => ({
      name: x.name, admin: x.admin1 || "", country: x.country || "",
      lat: x.latitude, lon: x.longitude }));
    // Свои края — наверх списка
    placeList.sort((a, b) => (b.country === "Россия") - (a.country === "Россия"));
    if (!placeList.length) {
      box.innerHTML = "<div class='wp-sr'>Не нашёл такого, камрад. Набери больше букв: «кулеб» найдёт Кулебаки быстрее, чем «кул».</div>";
      return;
    }
    box.innerHTML = placeList.map((p, i) =>
      "<div class='wp-item' data-i='" + i + "'>📍 <b>" + p.name + "</b>" +
      (p.admin || p.country ? " <small>" + [p.admin, p.country].filter(Boolean).join(" · ") + "</small>" : "") +
      "</div>").join("");
    [...box.querySelectorAll(".wp-item")].forEach(el =>
      el.onclick = () => {
        const p = placeList[+el.dataset.i];
        try { localStorage.setItem(WPLACE_KEY, JSON.stringify({ name: p.name, lat: p.lat, lon: p.lon })); } catch (e) {}
        box.classList.add("hidden");
        document.getElementById("wplace-input").value = "";
        loadWeather();
      });
  } catch (err) {
    box.innerHTML = "<div class='wp-sr'>Поиск не удался: сети нет или сервис молчит.</div>";
  }
}

document.getElementById("btn-wplace-find").onclick = () =>
  findPlaces(document.getElementById("wplace-input").value);
let wSearchTimer = null;
document.getElementById("wplace-input").addEventListener("input", (e) => {
  clearTimeout(wSearchTimer);
  const q = e.target.value;
  if (!q || q.trim().length < 2) {
    document.getElementById("wplace-results").classList.add("hidden");
    return;
  }
  wSearchTimer = setTimeout(() => findPlaces(q), 400);
});
document.getElementById("wplace-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    clearTimeout(wSearchTimer);
    findPlaces(e.target.value);
  }
});
document.getElementById("btn-wplace-mine").onclick = () => {
  try { localStorage.removeItem(WPLACE_KEY); } catch (e) {}
  document.getElementById("wplace-input").value = "";
  loadWeather();
};

// ===== РЕНДЕР =====
let weatherBusy = false;

async function loadWeather(force) {
  if (weatherBusy) return;
  weatherBusy = true;
  const body = document.getElementById("weather-body");
  if (!body) { weatherBusy = false; return; }
  body.innerHTML = "<div class='wloading'>Догоняю небо, камрад…</div>";
  try {
    const place = getSavedPlace();
    const fix = await fixFor(place);
    if (!fix) { body.innerHTML = "<div class='wloading'>Не удалось определить место.</div>"; return; }
    const where = fix.name || fix.src || "моё место";

    const url = "https://api.open-meteo.com/v1/forecast" +
      "?latitude=" + fix.lat.toFixed(2) + "&longitude=" + fix.lon.toFixed(2) +
      "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation" +
      "&hourly=precipitation_probability&timezone=auto&forecast_days=2";

    let data = null, stale = null;
    try {
      const r = await fetchTO(url, 9000);
      if (!r.ok) throw new Error("http " + r.status);
      data = await r.json();
      try { localStorage.setItem(WEATHER_CACHE_KEY,
        JSON.stringify({ ts: Date.now(), data })); } catch (e) {}
    } catch (err) {
      try { stale = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || "null"); } catch (e) {}
      if (stale && stale.data) data = stale.data;
    }

    const now = Date.now();
    const offline = !!stale && !data;
    const cur = data ? data.current : null;
    const hourly = data ? data.hourly : null;

    // Солнце — всегда локальный расчёт
    const sun = sunTimesLocal(new Date(now), fix.lat, fix.lon);
    let sunRows = "";
    if (sun) {
      const fmt = t => new Date(t).toTimeString().slice(0, 5);
      sunRows += "<div class='wrow'><span>Восход</span><b>" + fmt(sun.rise) + "</b></div>";
      sunRows += "<div class='wrow'><span>Закат</span><b>" + fmt(sun.set) + "</b></div>";
      const riseT = sun.rise, setT = sun.set;
      if (now > riseT && now < setT) {
        const ms = setT - now;
        sunRows += "<div class='wrow'><span>Осталось</span><b>до заката " +
          Math.floor(ms / 3600000) + " ч " + Math.round(ms % 3600000 / 60000) + " мин</b></div>";
      } else {
        const nxt = now < riseT ? riseT : riseT + 86400000;
        const ms = nxt - now;
        sunRows += "<div class='wrow'><span>Осталось</span><b>до восхода " +
          Math.floor(ms / 3600000) + " ч " + Math.round(ms % 3600000 / 60000) + " мин</b></div>";
      }
      if (now > riseT && now < setT) {
        const day = setT - riseT;
        sunRows += "<div class='wrow'><span>Световой день</span><b>" +
          Math.floor(day / 3600000) + " ч " + Math.round(day % 3600000 / 60000) + " мин</b></div>";
      }
    }

    const moon = moonInfo(now);

    // Осадки: максимум вероятности в ближайшие 6 часов
    let precipMax = null, precipTime = null;
    if (hourly && hourly.time) {
      for (let i = 0; i < hourly.time.length; i++) {
        const t = new Date(hourly.time[i] + ":00").getTime();
        if (t < now - 3600000) continue;
        if (t > now + 6 * 3600000) break;
        const p = hourly.precipitation_probability[i];
        if (typeof p === "number" && (precipMax === null || p > precipMax)) {
          precipMax = p; precipTime = hourly.time[i];
        }
      }
    }

    // Категория погоды и фраза камрада
    let cat = "ok";
    if (cur) {
      const code = cur.weather_code;
      if (code >= 95) cat = "storm";
      else if (WMO_WET.includes(code) || cur.precipitation > 0.3) cat = "wet";
      else if ((cur.wind_gusts_10m || 0) >= 12) cat = "wind";
      else if (code === 45 || code === 48) cat = "fog";
      else if (cur.apparent_temperature >= 27) cat = "heat";
      else if (cur.temperature_2m <= -8) cat = "cold";
    }

    let html = "";
    if (offline)
      html += "<div class='wsoft'>Сеть недоступна, камрад — показываю последние сохранённые данные.</div>";

    if (cur) {
      const desc = WMO[cur.weather_code] || "нет данных";
      const icon = WMO_ICON[cur.weather_code] || "🌡";
      const phraseTxt = phrase(cat) +
        (cat === "ok" && precipMax !== null && precipMax >= 60
          ? " Но осадки обещают около " + fmtHM(precipTime) + ", камрад." : "");
      html += "<div class='w2-hero'>" +
        "<div class='w2-place'>📍 " + where + (offline ? " · кэш" : "") + "</div>" +
        "<div class='w2-main'><div class='w2-ico'>" + icon + "</div>" +
        "<div><div class='w2-temp'>" + fmtTemp(cur.temperature_2m) + "</div>" +
        "<div class='w2-desc'>" + desc + "</div></div></div>" +
        "<div class='w2-phrase'>«" + phraseTxt + "»</div>" +
        "<div class='w2-tiles'>" +
        "<div class='w2-tile'><span>Ощущается</span><b>" + fmtTemp(cur.apparent_temperature) + "</b></div>" +
        "<div class='w2-tile'><span>Ветер</span><b>" + Math.round(cur.wind_speed_10m) + " м/с</b></div>" +
        "<div class='w2-tile'><span>Порывы</span><b>" + Math.round(cur.wind_gusts_10m) + " м/с</b></div>" +
        "<div class='w2-tile'><span>Осадки</span><b>" + (cur.precipitation > 0 ? cur.precipitation + " мм" : "нет") + "</b></div>" +
        "</div></div>";
    } else {
      html += "<div class='wsoft'>Погоду сейчас не получить, камрад: сети нет и сохранённых данных нет." +
        " Солнце и луна — без сети, они всегда точные. Когда появится интернет — нажми ⟳.</div>";
    }

    html += "<div class='wcard'><h4>Солнце</h4>" + sunRows + "</div>";
    html += "<div class='wcard'><h4>Луна</h4>" +
      "<div class='wnow'><div class='wicon'>" + moon.icon + "</div><div>" +
      "<div class='wdesc'><b style='color:#f8fafc'>" + moon.name + "</b></div>" +
      "<div class='wdesc'>освещено " + moon.illum + "%</div></div></div>" +
      "<div class='wbar'><i style='width:" + moon.illum + "%'></i></div></div>";

    if (precipMax !== null) {
      html += "<div class='wcard'><h4>Вероятность осадков (6 ч)</h4>" +
        "<div class='wrow'><span>Максимум</span><b>" + precipMax + "%" +
        (precipTime ? " · около " + fmtHM(precipTime) : "") + "</b></div>" +
        "<div class='wbar'><i style='width:" + precipMax + "%'></i></div></div>";
    }

    html += "<div class='wcard'><h4>Магнитная обстановка</h4>" +
      "<div class='wrow'><span>Планетарный Kp</span><b id='kp-value'>— нет данных</b></div>" +
      "<div class='wbar'><i id='kp-bar' style='width:0%'></i></div></div>";

    const upd = offline ? new Date(stale.ts).toLocaleString("ru-RU") + " (кэш)" :
      new Date(now).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    html += "<div class='wsrc'>Обновлено " + upd + " · " + where +
      " · " + fix.lat.toFixed(2) + ", " + fix.lon.toFixed(2) + "</div>";

    body.innerHTML = html;

    fetchTO("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json", 9000)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(kpArr => {
        const kpEl = document.getElementById("kp-value");
        if (!kpEl || !Array.isArray(kpArr) || kpArr.length < 1) return;
        // NOAA отдаёт и старый формат (["время","2.0"]), и объекты ({time_tag, Kp})
        const last = kpArr[kpArr.length - 1];
        const raw = Array.isArray(last) ? last[1] :
          (last && typeof last === "object" ? last.Kp : NaN);
        const kp = parseFloat(raw);
        if (!isFinite(kp)) return;
        let label = "Спокойно";
        if (kp >= 5) label = "Магнитная буря";
        else if (kp >= 4) label = "Неспокойно";
        else if (kp >= 3) label = "Слегка возмущено";
        kpEl.textContent = kp.toFixed(1) + " · " + label;
        const bar = document.getElementById("kp-bar");
        if (bar) bar.style.width = Math.min(100, kp / 9 * 100) + "%";
      })
      .catch(() => {});
  } catch (err) {
    body.innerHTML = "<div class='wloading'>С погодой не сложилось: " +
      (err && err.message ? err.message : "неизвестная ошибка") +
      ". Нажми ⟳, чтобы попробовать снова.</div>";
  } finally {
    weatherBusy = false;
  }
}

document.getElementById("btn-weather-refresh").onclick = () => loadWeather(true);

// Открытие страницы — грузим погоду
(function wrapShowView() {
  if (typeof window.showView !== "function") return;
  const orig = window.showView;
  window.showView = function (v) {
    const r = orig(v);
    if (v === "weather" && typeof loadWeather === "function") loadWeather();
    return r;
  };
})();
