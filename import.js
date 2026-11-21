// ===== ИМПОРТ GPX И JSON =====
const fileInput = document.getElementById("file-import");

document.getElementById("btn-import").onclick = () => fileInput.click();

fileInput.onchange = () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const text = String(reader.result);
      if (text.trim().startsWith("{")) importJson(text);
      else importGpx(text);
    } catch (e) {
      alert("Не удалось прочитать файл: " + e.message);
    }
    fileInput.value = "";
  };

  reader.readAsText(file);
};

// --- GPX: точки ---
function importGpx(text) {
  const xml = new DOMParser().parseFromString(text, "text/xml");
  // DOMParser не бросает исключение — битый XML надо ловить по parsererror
  if (xml.getElementsByTagName("parsererror").length)
    return alert("Файл повреждён или это не GPX.");

  const wpts = [...xml.getElementsByTagName("wpt")];
  if (!wpts.length) return alert("В файле не найдено точек (wpt).");

  let added = 0;
  let nextId = Date.now();
  wpts.forEach(w => {
    const lat = parseFloat(w.getAttribute("lat"));
    const lon = parseFloat(w.getAttribute("lon"));
    if (isNaN(lat) || isNaN(lon)) return;
    const nameEl = w.querySelector("name");
    // Идентификатор не должен совпасть с уже сохранёнными точками
    do { nextId++; } while (spots.some(x => x.id === nextId));
    const s = {
      id: nextId,
      ll: [lat, lon],
      type: "other",
      note: nameEl ? nameEl.textContent.trim() : "Импорт " + (spots.length + 1),
      ts: new Date().toLocaleString(),
    };
    spots.push(s);
    addSpotMarker(s);
    added++;
  });

  saveSpots();
  renderSpots();
  alert("Импортировано точек: " + added);
}

// --- JSON: точки (+ трек, если был в файле) ---
function importJson(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== "object" || !Array.isArray(data.spots))
    throw new Error("в файле нет массива spots");

  let added = 0;
  let nextId = Date.now();
  data.spots.forEach(sp => {
    const numOk = v =>
      (typeof v === "number" || typeof v === "string") &&
      String(v).trim() !== "" && isFinite(+v);
    if (!Array.isArray(sp.ll) || sp.ll.length !== 2 ||
        !numOk(sp.ll[0]) || !numOk(sp.ll[1])) return;
    do { nextId++; } while (spots.some(x => x.id === nextId));
    const s = {
      id: nextId,
      ll: [+sp.ll[0], +sp.ll[1]],
      type: (typeof SPOT_TYPES !== "undefined" && SPOT_TYPES[sp.type]) ? sp.type : "other",
      note: (sp.note || "").trim() || "Импорт",
      ts: sp.ts || new Date().toLocaleString(),
    };
    spots.push(s);
    addSpotMarker(s);
    added++;
  });

  // Трек из резервной копии
  let trkMsg = "";
  if (Array.isArray(data.track) && data.track.length) {
    const numOk = v =>
      (typeof v === "number" || typeof v === "string") &&
      String(v).trim() !== "" && isFinite(+v);
    const pts = data.track.filter(ll =>
      Array.isArray(ll) && ll.length === 2 && numOk(ll[0]) && numOk(ll[1]))
      .map(ll => [+ll[0], +ll[1]]);
    if (pts.length) {
      track = pts;
      if (trackLine) trackLine.setLatLngs(track);
      else drawTrack();
      saveTrack();
      trkMsg = ", трек: " + pts.length + " точек";
    }
  }

  saveSpots();
  renderSpots();
  alert("Импортировано точек: " + added + trkMsg);
}
