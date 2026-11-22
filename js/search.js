// ===== ПОИСК ПО АДРЕСУ (OpenStreetMap Nominatim) =====
const input = document.getElementById("search-input");
const results = document.getElementById("search-results");
let searchPin = null; // маркер найденного места — только один, предыдущий убираем

function doSearch() {
  const q = input.value.trim();
  if (q.length < 3) return;
  results.classList.remove("hidden");
  results.innerHTML = "<div class='sr'>Ищу…</div>";

  fetch("https://nominatim.openstreetmap.org/search?format=json&limit=5" +
      "&accept-language=ru&q=" + encodeURIComponent(q))
    .then(r => r.json())
    .then(list => {
      results.innerHTML = "";
      if (!list.length) {
        results.innerHTML = "<div class='sr'>Ничего не найдено</div>";
        return;
      }
      list.forEach(item => {
        const div = document.createElement("div");
        div.className = "sr";
        div.textContent = item.display_name;
        div.onclick = () => {
          map.flyTo([+item.lat, +item.lon], 16);
          if (searchPin) map.removeLayer(searchPin);
          searchPin = L.circleMarker([+item.lat, +item.lon],
            { radius: 10, color: "#1f6feb", fillOpacity: .5 }).addTo(map);
          results.classList.add("hidden");
        };
        results.appendChild(div);
      });
    })
    .catch(() => {
      results.innerHTML = "<div class='sr'>Сервис поиска недоступен</div>";
    });
}

document.getElementById("btn-search").onclick = doSearch;
input.addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });

// Закрываем подсказки, если ткнули мимо
document.addEventListener("click", e => {
  if (!results.contains(e.target) && e.target !== input) results.classList.add("hidden");
});
