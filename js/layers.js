// ============ КОНФИГ СЛОЁВ ============
// Подложки сгруппированы по типам: Спутник / Высоты и рельеф / Схема.
// Каждый слой проверяется живым запросом тайла при загрузке — мёртвые
// источники в панель не попадают вовсе.
// zoom — максимальный «родной» зум источника; дальше Leaflet растягивает тайлы.

const BASE_LAYERS = [
  // ===== СПУТНИК =====
  {
    id: "sat", group: "Спутник",
    name: "Спутник (Esri)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    zoom: 19,
    def: true
  },
  {
    id: "gsat", group: "Спутник",
    name: "Спутник (Google)",
    url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    zoom: 20
  },
  {
    id: "ghyb", group: "Спутник",
    name: "Гибрид: спутник + подписи (Google)",
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    zoom: 20
  },
  // ===== ВЫСОТЫ И РЕЛЬЕФ =====
  {
    id: "otm", group: "Высоты и рельеф",
    name: "Горизонтали высот (OpenTopoMap)",
    url: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
    zoom: 17
  },
  {
    id: "etopo", group: "Высоты и рельеф",
    name: "Топокарта (Esri Topo)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    zoom: 19
  },
  {
    id: "gter", group: "Высоты и рельеф",
    name: "Рельеф с подписями (Google Terrain)",
    url: "https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
    zoom: 20
  },
  {
    id: "erelief", group: "Высоты и рельеф",
    name: "Отмывка рельефа (Esri Shaded Relief)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}",
    zoom: 13
  },
  {
    id: "eterrain", group: "Высоты и рельеф",
    name: "Рельеф-основа (Esri Terrain)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}",
    zoom: 13
  },
  {
    id: "ephys", group: "Высоты и рельеф",
    name: "Физическая карта (Esri)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}",
    zoom: 8
  },
  // ===== СХЕМА =====
  {
    id: "osm", group: "Схема",
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    zoom: 19
  },
  {
    id: "cyclosm", group: "Схема",
    name: "CyclOSM: тропы, дороги, грунтовки",
    url: "https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
    zoom: 20
  },
  {
    id: "gmap", group: "Схема",
    name: "Схема (Google)",
    url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    zoom: 20
  },
  {
    id: "estreet", group: "Схема",
    name: "Улицы (Esri Street)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    zoom: 19
  },
  {
    id: "edark", group: "Схема",
    name: "Тёмная, для ночи (Esri)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    zoom: 16
  },
];

// ===== НАЛОЖЕНИЯ =====
// Старые карты (Менде, Шуберт, ПГМ, РККА) серверы закрыли для встраивания
// в чужие приложения — переходы на них собраны в панели 🕰 «Исторические снимки».
const OLD_LAYERS = [
  {
    id: "hillshade",
    name: "Тени рельефа поверх (видно ямы и склоны)",
    urls: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
    ],
    zoom: 19,
    opacity: 0.45,
    on: false
  },
];
