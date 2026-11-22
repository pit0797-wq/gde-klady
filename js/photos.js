// ===== ФОТО НАХОДОК =====
// Полные снимки хранятся в IndexedDB (не раздуваем localStorage),
// миниатюры и счётчики — в localStorage (photoMeta) для мгновенного
// показа в списках и попапах. Если IndexedDB недоступен — fallback
// в localStorage. Клик по фото — полноэкранный просмотр (лайтбокс).

const PM_KEY = "photoMeta";
const FB_KEY = "photosFallback";
let photoDB = null;
let photoSeq = 0;

function photoMeta() {
  try { return JSON.parse(localStorage.getItem(PM_KEY) || "{}") || {}; }
  catch (e) { return {}; }
}
function savePhotoMeta(m) {
  try { localStorage.setItem(PM_KEY, JSON.stringify(m)); } catch (e) {}
}
function fbLoad() {
  try { return JSON.parse(localStorage.getItem(FB_KEY) || "{}") || {}; }
  catch (e) { return {}; }
}
function fbSave(fb) {
  try { localStorage.setItem(FB_KEY, JSON.stringify(fb)); } catch (e) {}
}

function openPhotoDB() {
  return new Promise(res => {
    if (!window.indexedDB) return res(null);
    if (photoDB) return res(photoDB);
    try {
      const rq = indexedDB.open("kopar-photos", 1);
      rq.onupgradeneeded = () => {
        try { rq.result.createObjectStore("photos"); } catch (e) {}
      };
      rq.onsuccess = () => { photoDB = rq.result; res(photoDB); };
      rq.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}

// ===== СЖАТИЕ ФОТО =====
function compressImage(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", quality));
      } catch (e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("не изображение")); };
    img.src = url;
  });
}

// ===== ХРАНИЛИЩЕ ФОТО =====
function photoSave(spotId, dataURL, thumbURL) {
  const rec = { spotId: +spotId, data: dataURL, thumb: thumbURL, ts: Date.now() };
  const key = Date.now() + "_" + (++photoSeq);
  const saveFb = () => {
    const fb = fbLoad();
    (fb[spotId] = fb[spotId] || []).push({ id: key, thumb: rec.thumb, data: rec.data });
    try { fbSave(fb); } catch (e) { return Promise.reject(new Error("Хранилище переполнено")); }
    refreshSpotMeta(spotId);
    return Promise.resolve(key);
  };
  return openPhotoDB().then(db => {
    if (!db) return saveFb();
    return new Promise(res => {
      try {
        const tx = db.transaction("photos", "readwrite");
        tx.objectStore("photos").put(rec, key);
        tx.oncomplete = () => { refreshSpotMeta(spotId); res(key); };
        tx.onerror = () => res(saveFb());
      } catch (e) { res(saveFb()); }
    });
  }).catch(err => {
    if (err && err.message === "Хранилище переполнено") throw err;
    return saveFb();
  });
}

function photoList(spotId) {
  return openPhotoDB().then(db => {
    if (!db) return (fbLoad()[spotId] || []).map(p => ({ id: p.id, thumb: p.thumb }));
    return new Promise(res => {
      try {
        const tx = db.transaction("photos", "readonly");
        const rq = tx.objectStore("photos").openCursor();
        const out = [];
        rq.onsuccess = () => {
          const cur = rq.result;
          if (cur) {
            const v = cur.value;
            if (v && +v.spotId === +spotId) out.push({ id: cur.key, thumb: v.thumb });
            cur.continue();
          } else res(out);
        };
        rq.onerror = () => res([]);
      } catch (e) { res([]); }
    });
  }).catch(() => (fbLoad()[spotId] || []).map(p => ({ id: p.id, thumb: p.thumb })));
}

function photoFull(key) {
  return openPhotoDB().then(db => {
    if (!db) {
      const fb = fbLoad();
      for (const id in fb) {
        const hit = fb[id].find(p => p.id === key);
        if (hit) return hit.data;
      }
      return null;
    }
    return new Promise(res => {
      try {
        const rq = db.transaction("photos", "readonly").objectStore("photos").get(key);
        rq.onsuccess = () => res(rq.result ? rq.result.data : null);
        rq.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }).catch(() => null);
}

function photoDelete(spotId, key) {
  const done = () => {
    const fb = fbLoad();
    if (fb[spotId]) { fb[spotId] = fb[spotId].filter(p => p.id !== key); fbSave(fb); }
    refreshSpotMeta(spotId);
    return Promise.resolve();
  };
  return openPhotoDB().then(db => {
    if (!db) return done();
    return new Promise(res => {
      try {
        const tx = db.transaction("photos", "readwrite");
        tx.objectStore("photos").delete(key);
        tx.oncomplete = () => res();
        tx.onerror = () => res();
      } catch (e) { res(); }
    }).then(done);
  }).catch(done);
}

function photoDeleteAll(spotId) {
  return photoList(spotId).then(list =>
    Promise.all(list.map(p => photoDelete(spotId, p.id)))
  ).then(() => {
    const fb = fbLoad();
    delete fb[spotId];
    fbSave(fb);
    refreshSpotMeta(spotId);
  });
}

function refreshSpotMeta(spotId) {
  photoList(spotId).then(list => {
    const m = photoMeta();
    if (list && list.length) m[spotId] = { n: list.length, thumb: list[0].thumb };
    else delete m[spotId];
    savePhotoMeta(m);
    if (typeof renderFinds === "function") renderFinds();
  });
}

// ===== МЕТОАФАЧКИ: В ПОПАПЕ И В СПИСКЕ =====
window.__photoBadge = function (id) {
  const m = photoMeta()[id];
  return m && m.n ? `<span class="li-photo">📷${m.n}</span>` : "";
};

function renderSpotThumbs(spotId) {
  const box = document.getElementById("sp-thumbs-" + spotId);
  if (!box) return;
  photoList(spotId).then(list => {
    if (!box.isConnected) return; // попап уже закрыт
    box.innerHTML = list.map(p =>
      `<div class="ph-thumb"><img src="${p.thumb}" alt=""></div>`).join("");
    box.querySelectorAll(".ph-thumb").forEach(d => {
      d.onclick = e => {
        e.stopPropagation();
        if (typeof openLightbox === "function") openLightbox(d.querySelector("img").src);
      };
    });
  });
}
window.__renderPopupThumbs = renderSpotThumbs;

// ===== ДОБАВЛЕНИЕ ФОТО =====
let pendingPhotos = []; // фото, ждущие сохранения новой точки

function renderPending() {
  const box = document.getElementById("spot-photos");
  if (!box) return;
  box.innerHTML = pendingPhotos.map((p, i) =>
    `<div class="ph-thumb"><img src="${p.thumb}" alt=""><span class="ph-del" data-i="${i}">✕</span></div>`
  ).join("");
  box.querySelectorAll(".ph-del").forEach(x => {
    x.onclick = e => {
      e.stopPropagation();
      pendingPhotos.splice(+x.dataset.i, 1);
      renderPending();
    };
  });
}
window.__renderPending = renderPending;

function photoPick(spotId) {
  const inp = document.getElementById("photo-input");
  inp.onchange = () => {
    const f = inp.files[0];
    inp.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type)) return alert("Это не изображение");
    compressImage(f, 1280, 0.75).then(full =>
      compressImage(f, 240, 0.6).then(thumb => {
        if (spotId == null) {           // новая точка — копим до сохранения
          pendingPhotos.push({ full, thumb });
          renderPending();
        } else {                        // существующая точка
          photoSave(spotId, full, thumb).then(() => {
            if (typeof toast === "function") toast("Фото сохранено");
            renderSpotThumbs(spotId);
          }).catch(e => alert("Не удалось сохранить фото: " + e.message));
        }
      })
    ).catch(() => alert("Не удалось обработать фото"));
  };
  inp.click();
}

window.__addPendingPhoto = () => photoPick(null);
window.__addPhotoToSpot = spotId => photoPick(spotId);

window.__commitPendingPhotos = function (spotId) {
  if (!pendingPhotos.length) return Promise.resolve();
  const arr = pendingPhotos.slice();
  pendingPhotos = [];
  renderPending();
  return Promise.all(arr.map(p => photoSave(spotId, p.full, p.thumb).catch(() => null)))
    .then(res => {
      const n = res.filter(Boolean).length;
      refreshSpotMeta(spotId);
      if (n && typeof toast === "function") toast("Фото сохранены: " + n);
    });
};

window.__deleteSpotPhotos = photoDeleteAll;
