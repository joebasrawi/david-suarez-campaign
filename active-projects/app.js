const CATEGORY_META = {
  1: ["Environmental & Parks", "#1fa8a0"],
  2: ["City Construction", "#f26d5b"],
  3: ["Neighborhood Improvement", "#f08e48"],
  4: ["G.O. Bond Funded", "#c9a64b"],
  5: ["Parking", "#2f5d3a"],
  6: ["Other", "#2a6f97"],
  42: ["Infrastructure", "#0b2e4f"]
};

const NEIGHBORHOOD_META = {
  7: "South Beach",
  8: "North Beach",
  9: "Mid Beach"
};

const CATEGORY_ORDER = [
  "Neighborhood Improvement",
  "City Construction",
  "Parking",
  "Environmental & Parks",
  "G.O. Bond Funded",
  "Other",
  "Infrastructure"
];

const NEIGHBORHOOD_ORDER = ["South Beach", "Mid Beach", "North Beach", "Citywide"];

const CITY_FEED_URL = "https://www.miamibeachfl.gov/wp-json/wpgmza/v1/markers?map_id=11";
const LOCAL_FEED_URL = "data/projects.json";
const DEFAULT_PROJECT_URL = "https://www.miamibeachfl.gov/city-hall/cip/active-projects/";
const DEFAULT_CENTER = [25.799, -80.133];
const OFFICE_EMAIL = "davidsuarez@miamibeachfl.gov";

const state = {
  projects: [],
  search: "",
  categories: new Set(),
  neighborhoods: new Set(),
  sort: "az",
  selectedId: null,
  origin: null,
  radiusMiles: 1,
  onlyNearby: false,
  dataMode: "loading"
};

const refs = {
  stats: byId("stats"),
  status: byId("status"),
  mapNote: byId("map-note"),
  summary: byId("summary"),
  count: byId("count"),
  cards: byId("cards"),
  detail: byId("detail"),
  legend: byId("legend"),
  empty: byId("empty"),
  hoodBars: byId("hood-bars"),
  catBars: byId("cat-bars"),
  catFilters: byId("cat-filters"),
  hoodFilters: byId("hood-filters"),
  search: byId("search"),
  sort: byId("sort"),
  reset: byId("reset"),
  addressForm: byId("address-form"),
  addressInput: byId("address-input"),
  radiusSelect: byId("radius-select"),
  nearbyToggle: byId("nearby-toggle"),
  nearbyCaption: byId("nearby-caption"),
  clearAddress: byId("clear-address"),
  geoButton: byId("geo-button"),
  lookupCard: byId("lookup-card"),
  nearbyList: byId("nearby-list"),
  alertsForm: byId("alerts-form"),
  alertsStatus: byId("alerts-status"),
  contactInput: byId("contact-input"),
  consentInput: byId("consent-input")
};

const map = L.map("map", {
  zoomControl: true,
  scrollWheelZoom: false
}).setView(DEFAULT_CENTER, 12);

map.createPane("labels");
map.getPane("labels").classList.add("leaflet-labels-pane");
map.getPane("labels").style.pointerEvents = "none";

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
  attribution: "&copy; OpenStreetMap &copy; CARTO",
  subdomains: "abcd",
  maxZoom: 20
}).addTo(map);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", {
  attribution: "",
  subdomains: "abcd",
  maxZoom: 20,
  pane: "labels"
}).addTo(map);

map.once("focus", () => {
  map.scrollWheelZoom.enable();
});

const markerRefs = new Map();
let originMarker = null;
let originRadius = null;

function byId(id) {
  return document.getElementById(id);
}

function decodeHtml(value) {
  const node = document.createElement("div");
  node.innerHTML = value || "";
  return node.textContent.trim();
}

function getCategoryName(ids) {
  const match = (ids || []).map(Number).find((id) => CATEGORY_META[id]);
  return CATEGORY_META[match]?.[0] || "Other";
}

function getCategoryColor(name) {
  const entry = Object.values(CATEGORY_META).find(([label]) => label === name);
  return entry ? entry[1] : "#2a6f97";
}

function getNeighborhoodName(ids) {
  const match = (ids || []).map(Number).find((id) => NEIGHBORHOOD_META[id]);
  return match ? NEIGHBORHOOD_META[match] : "Citywide";
}

function truncate(text, limit = 175) {
  if (!text || text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit - 3).trim()}...`;
}

function toMiles(lat1, lon1, lat2, lon2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const startLat = toRadians(lat1);
  const endLat = toRadians(lat2);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLon / 2) ** 2;

  return 3958.8 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatMiles(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  if (value < 0.1) {
    return "Less than 0.1 mi";
  }

  return `${value.toFixed(value < 1 ? 1 : 0)} mi away`;
}

function requestJson(url, options = {}) {
  const {
    method = "GET",
    headers = {},
    body = null
  } = options;

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, url, true);
    request.responseType = "json";

    Object.entries(headers).forEach(([key, value]) => {
      request.setRequestHeader(key, value);
    });

    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Request failed with status ${request.status}`));
        return;
      }

      if (request.response !== null) {
        resolve(request.response);
        return;
      }

      try {
        resolve(JSON.parse(request.responseText));
      } catch (error) {
        reject(error);
      }
    };

    request.onerror = () => {
      reject(new Error("Network request failed."));
    };

    request.send(body);
  });
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
}

function syncOriginToUrl() {
  const url = new URL(window.location.href);

  if (!state.origin) {
    url.searchParams.delete("lat");
    url.searchParams.delete("lng");
    url.searchParams.delete("label");
    url.searchParams.delete("radius");
    history.replaceState({}, "", url);
    return;
  }

  url.searchParams.set("lat", String(state.origin.lat));
  url.searchParams.set("lng", String(state.origin.lng));
  url.searchParams.set("label", state.origin.label);
  url.searchParams.set("radius", String(state.radiusMiles));
  history.replaceState({}, "", url);
}

function getOriginFromUrl() {
  const url = new URL(window.location.href);
  const latParam = url.searchParams.get("lat");
  const lngParam = url.searchParams.get("lng");
  const lat = Number(latParam);
  const lng = Number(lngParam);
  const label = url.searchParams.get("label") || "Shared lookup point";
  const radius = Number(url.searchParams.get("radius") || "1");

  if (latParam === null || lngParam === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    origin: { lat, lng, label },
    radiusMiles: Number.isFinite(radius) && radius > 0 ? radius : 1
  };
}

function getProjectsWithDistance() {
  return state.projects.map((project) => {
    if (!state.origin) {
      return project;
    }

    return {
      ...project,
      distanceMiles: toMiles(state.origin.lat, state.origin.lng, project.lat, project.lng)
    };
  });
}

function sortProjects(list) {
  const items = [...list];

  if (state.sort === "nearby" && state.origin) {
    return items.sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity) || a.title.localeCompare(b.title));
  }

  if (state.sort === "ns") {
    return items.sort((a, b) => b.lat - a.lat || a.title.localeCompare(b.title));
  }

  if (state.sort === "sn") {
    return items.sort((a, b) => a.lat - b.lat || a.title.localeCompare(b.title));
  }

  return items.sort((a, b) => a.title.localeCompare(b.title));
}

function getVisibleProjects() {
  const search = state.search.trim().toLowerCase();

  return sortProjects(
    getProjectsWithDistance().filter((project) => {
      const categoryMatch = state.categories.size === 0 || state.categories.has(project.category);
      const neighborhoodMatch = state.neighborhoods.size === 0 || state.neighborhoods.has(project.hood);
      const searchMatch =
        !search ||
        project.title.toLowerCase().includes(search) ||
        project.address.toLowerCase().includes(search) ||
        project.summary.toLowerCase().includes(search);
      const nearbyMatch =
        !state.origin ||
        !state.onlyNearby ||
        (Number.isFinite(project.distanceMiles) && project.distanceMiles <= state.radiusMiles);

      return categoryMatch && neighborhoodMatch && searchMatch && nearbyMatch;
    })
  );
}

function createMarker(project) {
  const marker = L.circleMarker([project.lat, project.lng], {
    radius: 8,
    color: "#ffffff",
    weight: 2,
    fillColor: getCategoryColor(project.category),
    fillOpacity: 0.98
  });

  marker.bindPopup(`
    <div class="popup-copy">
      <strong>${project.title}</strong>
      <span>${project.hood} - ${project.category}</span>
      <span>${project.address || "Miami Beach, FL"}</span>
    </div>
  `);

  marker.bindTooltip(project.title, {
    direction: "top",
    offset: [0, -8]
  });

  marker.on("click", () => {
    selectProject(project.id, true);
  });

  marker.addTo(map);
  markerRefs.set(project.id, marker);
}

function renderOrigin() {
  if (!state.origin) {
    if (originMarker) {
      map.removeLayer(originMarker);
      originMarker = null;
    }

    if (originRadius) {
      map.removeLayer(originRadius);
      originRadius = null;
    }

    return;
  }

  const latLng = [state.origin.lat, state.origin.lng];

  if (!originMarker) {
    originMarker = L.circleMarker(latLng, {
      radius: 10,
      color: "#ffffff",
      weight: 3,
      fillColor: "#0b2e4f",
      fillOpacity: 1
    }).addTo(map);
  } else {
    originMarker.setLatLng(latLng);
  }

  originMarker.bindPopup(`
    <div class="popup-copy">
      <strong>Your lookup point</strong>
      <span>${state.origin.label}</span>
      <span>${state.radiusMiles} mile search radius</span>
    </div>
  `);

  if (!originRadius) {
    originRadius = L.circle(latLng, {
      radius: state.radiusMiles * 1609.34,
      color: "rgba(11, 46, 79, 0.75)",
      weight: 1,
      fillColor: "rgba(31, 168, 160, 0.12)",
      fillOpacity: 0.28
    }).addTo(map);
  } else {
    originRadius.setLatLng(latLng);
    originRadius.setRadius(state.radiusMiles * 1609.34);
  }
}

function updateMarkerStyles(visibleProjects) {
  const visibleIds = new Set(visibleProjects.map((project) => project.id));

  markerRefs.forEach((marker, id) => {
    const project = state.projects.find((entry) => entry.id === id);
    const isSelected = state.selectedId === id;

    if (!visibleIds.has(id)) {
      if (map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
      return;
    }

    if (!map.hasLayer(marker)) {
      marker.addTo(map);
    }

    marker.setStyle({
      radius: isSelected ? 12 : 8,
      weight: isSelected ? 3 : 2,
      color: isSelected ? "#0b2e4f" : "#ffffff",
      fillColor: getCategoryColor(project.category)
    });
  });
}

function fitToProjects(visibleProjects) {
  if (visibleProjects.length === 0 && !state.origin) {
    map.setView(DEFAULT_CENTER, 12);
    return;
  }

  const points = visibleProjects.map((project) => [project.lat, project.lng]);

  if (state.origin) {
    points.push([state.origin.lat, state.origin.lng]);
  }

  map.fitBounds(L.latLngBounds(points), {
    padding: [42, 42],
    maxZoom: visibleProjects.length <= 1 ? 15 : 13
  });
}

function renderStats() {
  const allProjects = getProjectsWithDistance();
  const nearbyCount = state.origin
    ? allProjects.filter((project) => Number.isFinite(project.distanceMiles) && project.distanceMiles <= state.radiusMiles).length
    : "All";

  refs.stats.innerHTML = [
    { label: "Active projects", value: state.projects.length },
    { label: "Neighborhoods", value: new Set(state.projects.map((project) => project.hood)).size },
    { label: "Project types", value: new Set(state.projects.map((project) => project.category)).size },
    { label: state.origin ? `Within ${state.radiusMiles} mi` : "Nearby mode", value: nearbyCount }
  ]
    .map(
      (item) => `
        <article class="stat">
          <span class="field-label">${item.label}</span>
          <strong>${item.value}</strong>
        </article>
      `
    )
    .join("");
}

function renderLegend() {
  refs.legend.innerHTML = CATEGORY_ORDER.filter((category) =>
    state.projects.some((project) => project.category === category)
  )
    .map(
      (category) => `
        <div class="chip">
          <span class="dot" style="background:${getCategoryColor(category)}"></span>
          <span>${category}</span>
        </div>
      `
    )
    .join("");
}

function renderFilterButtons() {
  refs.catFilters.innerHTML = CATEGORY_ORDER.filter((category) =>
    state.projects.some((project) => project.category === category)
  )
    .map(
      (category) => `
        <button class="${state.categories.has(category) ? "is-on" : ""}" type="button" data-cat="${category}">
          ${category}
        </button>
      `
    )
    .join("");

  refs.hoodFilters.innerHTML = NEIGHBORHOOD_ORDER.filter((hood) =>
    state.projects.some((project) => project.hood === hood)
  )
    .map(
      (hood) => `
        <button class="${state.neighborhoods.has(hood) ? "is-on" : ""}" type="button" data-hood="${hood}">
          ${hood}
        </button>
      `
    )
    .join("");

  document.querySelectorAll("[data-cat]").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.cat;
      if (state.categories.has(category)) {
        state.categories.delete(category);
      } else {
        state.categories.add(category);
      }
      paint(false);
    });
  });

  document.querySelectorAll("[data-hood]").forEach((button) => {
    button.addEventListener("click", () => {
      const hood = button.dataset.hood;
      if (state.neighborhoods.has(hood)) {
        state.neighborhoods.delete(hood);
      } else {
        state.neighborhoods.add(hood);
      }
      paint(false);
    });
  });
}

function renderBreakdowns() {
  const neighborhoodData = NEIGHBORHOOD_ORDER.map((hood) => ({
    label: hood,
    count: state.projects.filter((project) => project.hood === hood).length,
    color:
      hood === "South Beach"
        ? "#f26d5b"
        : hood === "Mid Beach"
          ? "#c9a64b"
          : hood === "North Beach"
            ? "#1fa8a0"
            : "#0b2e4f"
  })).filter((item) => item.count > 0);

  const categoryData = CATEGORY_ORDER.map((category) => ({
    label: category,
    count: state.projects.filter((project) => project.category === category).length,
    color: getCategoryColor(category)
  })).filter((item) => item.count > 0);

  renderBarRows(refs.hoodBars, neighborhoodData);
  renderBarRows(refs.catBars, categoryData);
}

function renderBarRows(container, rows) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  container.innerHTML = rows
    .map(
      (row) => `
        <div class="bar-row">
          <div class="bar-top">
            <span>${row.label}</span>
            <span>${row.count}</span>
          </div>
          <div class="track">
            <div class="fill" style="width:${(row.count / max) * 100}%;background:${row.color}"></div>
          </div>
        </div>
      `
    )
    .join("");
}

function renderLookupCard() {
  if (!state.origin) {
    refs.lookupCard.innerHTML = `
      <p class="lookup-kicker">No address loaded yet</p>
      <h3>Search an address to see the projects closest to you.</h3>
      <p class="lookup-copy">The map will drop a home pin, draw a nearby radius, and sort the list by distance.</p>
    `;
    refs.nearbyCaption.textContent = "Add an address to enable nearby filtering.";
    refs.nearbyList.innerHTML = "";
    refs.nearbyToggle.checked = false;
    return;
  }

  const nearbyProjects = getProjectsWithDistance()
    .filter((project) => Number.isFinite(project.distanceMiles))
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
  const insideRadius = nearbyProjects.filter((project) => project.distanceMiles <= state.radiusMiles);

  refs.lookupCard.innerHTML = `
    <p class="lookup-kicker">Current lookup</p>
    <h3>${state.origin.label}</h3>
    <p class="lookup-copy">${insideRadius.length} project${insideRadius.length === 1 ? "" : "s"} within ${state.radiusMiles} mile${state.radiusMiles === 1 ? "" : "s"}.</p>
  `;

  refs.nearbyCaption.textContent = state.onlyNearby
    ? "Only projects inside the selected radius are currently shown."
    : "Nearby mode is active, but the full project list is still visible.";
  refs.nearbyToggle.checked = state.onlyNearby;

  refs.nearbyList.innerHTML = nearbyProjects.slice(0, 4)
    .map(
      (project) => `
        <button class="nearby-item" type="button" data-nearby-id="${project.id}">
          <span class="lookup-kicker">${formatMiles(project.distanceMiles)}</span>
          <strong>${project.title}</strong>
          <span>${project.hood} - ${project.category}</span>
        </button>
      `
    )
    .join("");

  document.querySelectorAll("[data-nearby-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectProject(button.dataset.nearbyId, true);
      const cardTop = refs.detail.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: cardTop, behavior: "smooth" });
    });
  });
}

function renderCards(visibleProjects) {
  refs.cards.innerHTML = visibleProjects
    .map((project) => {
      const distanceMarkup = state.origin && Number.isFinite(project.distanceMiles)
        ? `<span class="distance-pill">${formatMiles(project.distanceMiles)}</span>`
        : "";

      return `
        <article class="card">
          <button class="${project.id === state.selectedId ? "is-active" : ""}" type="button" data-id="${project.id}">
            <div class="tags">
              <span>${project.category}</span>
              <span>${project.hood}</span>
              ${distanceMarkup}
            </div>
            <h3>${project.title}</h3>
            <p class="place">${project.address || "Miami Beach, FL"}</p>
            <p class="summary">${truncate(project.summary)}</p>
          </button>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectProject(button.dataset.id, true);
    });
  });
}

function renderDetail(project) {
  if (!project) {
    refs.detail.innerHTML = `
      <div class="detail-card">
        <div class="media">
          <div class="fallback">
            <h3>No project selected</h3>
            <p>Choose a marker or a card to open the detail panel.</p>
          </div>
        </div>
        <div class="body">
          <p class="lookup-kicker">Waiting for selection</p>
          <h3>Use the map or the list.</h3>
        </div>
      </div>
    `;
    return;
  }

  const distanceMarkup = state.origin && Number.isFinite(project.distanceMiles)
    ? `
      <div class="meta-card">
        <b>Distance from lookup</b>
        <div>${formatMiles(project.distanceMiles)}</div>
      </div>
    `
    : "";

  refs.detail.innerHTML = `
    <div class="detail-card">
      <div class="media">
        ${
          project.image
            ? `<img src="${project.image}" alt="${project.title}">`
            : `
              <div class="fallback">
                <h3>${project.title}</h3>
                <p>No project image was available from the city feed.</p>
              </div>
            `
        }
      </div>
      <div class="body">
        <div>
          <p class="lookup-kicker">Selected project</p>
          <h3>${project.title}</h3>
        </div>

        <div class="tags">
          <span>${project.category}</span>
          <span>${project.hood}</span>
          ${state.origin && Number.isFinite(project.distanceMiles) ? `<span>${formatMiles(project.distanceMiles)}</span>` : ""}
        </div>

        <p class="desc">${project.summary || "No summary was provided in the city feed."}</p>

        <div class="meta-grid">
          <div class="meta-card">
            <b>Address</b>
            <div>${project.address || "Miami Beach, FL"}</div>
          </div>
          <div class="meta-card">
            <b>Coordinates</b>
            <div>${project.lat.toFixed(5)}, ${project.lng.toFixed(5)}</div>
          </div>
          ${distanceMarkup}
        </div>

        <div class="actions">
          <a class="button button-primary" href="${project.link}" target="_blank" rel="noreferrer">Official project page</a>
          <button class="button button-ghost" id="center-project" type="button">Center on map</button>
        </div>
      </div>
    </div>
  `;

  const image = refs.detail.querySelector("img");
  if (image) {
    image.addEventListener("error", () => {
      image.parentElement.innerHTML = `
        <div class="fallback">
          <h3>${project.title}</h3>
          <p>No project image was available from the city feed.</p>
        </div>
      `;
    }, { once: true });
  }

  byId("center-project").addEventListener("click", () => {
    const marker = markerRefs.get(project.id);
    if (!marker) {
      return;
    }

    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 14), { duration: 0.7 });
    marker.openPopup();
  });
}

function updateSummary(visibleProjects) {
  const originCopy = state.origin
    ? `Near ${state.origin.label}`
    : "Showing all active projects";
  const nearbyVisible = state.origin && state.onlyNearby
    ? ` within ${state.radiusMiles} mile${state.radiusMiles === 1 ? "" : "s"}`
    : "";

  refs.summary.textContent = `${originCopy}${nearbyVisible}`;
  refs.count.textContent = `${visibleProjects.length} project${visibleProjects.length === 1 ? "" : "s"}`;
  refs.empty.classList.toggle("hide", visibleProjects.length !== 0);
  refs.mapNote.textContent = state.origin
    ? `Address lookup active - ${state.radiusMiles} mile radius`
    : "Live city feed";
}

function selectProject(projectId, panToMarker = false) {
  const visibleProjects = getVisibleProjects();
  const match = visibleProjects.find((project) => String(project.id) === String(projectId)) || visibleProjects[0] || null;
  state.selectedId = match ? match.id : null;

  updateMarkerStyles(visibleProjects);
  renderCards(visibleProjects);
  renderDetail(match);

  if (match && panToMarker) {
    const marker = markerRefs.get(match.id);
    if (marker) {
      map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 14), { duration: 0.7 });
      marker.openPopup();
    }
  }
}

function paint(fitMap = true) {
  const visibleProjects = getVisibleProjects();

  if (!visibleProjects.some((project) => project.id === state.selectedId)) {
    state.selectedId = visibleProjects[0]?.id || null;
  }

  renderStats();
  renderFilterButtons();
  renderLegend();
  renderBreakdowns();
  renderLookupCard();
  renderOrigin();
  updateSummary(visibleProjects);
  updateMarkerStyles(visibleProjects);
  renderCards(visibleProjects);
  renderDetail(visibleProjects.find((project) => project.id === state.selectedId) || null);

  if (fitMap) {
    fitToProjects(visibleProjects);
  }
}

function normalizeProjects(raw) {
  if (raw.length > 0 && Object.prototype.hasOwnProperty.call(raw[0], "summary") && !Object.prototype.hasOwnProperty.call(raw[0], "map_id")) {
    return raw
      .map((item) => ({
        id: String(item.id),
        title: item.title?.trim() || "Untitled project",
        summary: item.summary?.trim() || "No summary provided in the city feed.",
        address: (item.address || "").trim(),
        image: item.image || "",
        link: item.link || DEFAULT_PROJECT_URL,
        lat: Number(item.lat),
        lng: Number(item.lng),
        category: item.category || "Other",
        hood: item.hood || "Citywide"
      }))
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
  }

  return raw
    .filter((item) => String(item.map_id) === "11")
    .map((item) => ({
      id: String(item.id),
      title: item.title?.trim() || "Untitled project",
      summary: decodeHtml(item.description) || "No summary provided in the city feed.",
      address: (item.address || "").trim(),
      image: item.pic || item.gallery?.[0]?.url || "",
      link: item.link || DEFAULT_PROJECT_URL,
      lat: Number(item.lat),
      lng: Number(item.lng),
      category: getCategoryName(item.categories),
      hood: getNeighborhoodName(item.categories)
    }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

async function geocodeAddress(query) {
  const arcgisUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=pjson&maxLocations=1&outFields=LongLabel,Place_addr,Match_addr&SingleLine=${encodeURIComponent(query)}`;
  const arcgisData = await requestJson(arcgisUrl);
  const arcgisMatch = arcgisData?.candidates?.[0];
  if (arcgisMatch?.location) {
    return {
      lat: arcgisMatch.location.y,
      lng: arcgisMatch.location.x,
      label: arcgisMatch.attributes?.Place_addr || arcgisMatch.attributes?.LongLabel || arcgisMatch.address || query
    };
  }

  const censusUrl = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=${encodeURIComponent(query)}`;
  const censusData = await requestJson(censusUrl);
  const censusMatch = censusData?.result?.addressMatches?.[0];
  if (censusMatch?.coordinates) {
    return {
      lat: censusMatch.coordinates.y,
      lng: censusMatch.coordinates.x,
      label: censusMatch.matchedAddress
    };
  }

  const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(query)}`;
  const nominatimData = await requestJson(nominatimUrl, {
    headers: {
      Accept: "application/json"
    }
  });
  const nominatimMatch = nominatimData[0];

  if (!nominatimMatch) {
    throw new Error("Address lookup did not return a result.");
  }

  return {
    lat: Number(nominatimMatch.lat),
    lng: Number(nominatimMatch.lon),
    label: nominatimMatch.display_name
  };
}

function applyOrigin(origin, fitMap = true) {
  state.origin = origin;
  state.radiusMiles = Number(refs.radiusSelect.value || 1);
  state.onlyNearby = true;
  state.sort = "nearby";
  refs.sort.value = "nearby";
  syncOriginToUrl();
  paint(fitMap);
}

async function handleAddressLookup(event) {
  event.preventDefault();
  const query = refs.addressInput.value.trim();

  if (!query) {
    refs.status.textContent = "Enter an address to find nearby projects.";
    return;
  }

  refs.status.textContent = "Looking up address";

  try {
    const origin = await geocodeAddress(query);
    applyOrigin(origin);
    refs.status.textContent = "Address located";
  } catch (error) {
    refs.status.textContent = "Address lookup failed";
    refs.lookupCard.innerHTML = `
      <p class="lookup-kicker">Lookup failed</p>
      <h3>We could not place that address.</h3>
      <p class="lookup-copy">${String(error.message || error)}</p>
    `;
  }
}

function handleRadiusChange() {
  state.radiusMiles = Number(refs.radiusSelect.value || 1);
  if (state.origin) {
    syncOriginToUrl();
    paint(true);
  }
}

function clearAddress() {
  state.origin = null;
  state.onlyNearby = false;
  refs.addressInput.value = "";
  refs.radiusSelect.value = "1";
  state.radiusMiles = 1;
  syncOriginToUrl();
  refs.status.textContent = `${state.dataMode === "live" ? "Live city feed connected" : "Using mirrored city feed backup"} - ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  paint(true);
}

function useBrowserLocation() {
  if (!navigator.geolocation) {
    refs.status.textContent = "Browser location is not available on this device.";
    return;
  }

  refs.status.textContent = "Finding your location";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      applyOrigin({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        label: "Current location"
      });
      refs.status.textContent = "Using your current location";
    },
    () => {
      refs.status.textContent = "Location access was blocked.";
    },
    {
      enableHighAccuracy: true,
      timeout: 10000
    }
  );
}

async function handleAlertsSubmit(event) {
  event.preventDefault();

  const contactValue = refs.contactInput.value.trim();
  if (!contactValue) {
    refs.alertsStatus.textContent = "Add a phone number or email address.";
    return;
  }

  if (!refs.consentInput.checked) {
    refs.alertsStatus.textContent = "You need to opt in before sending the request.";
    return;
  }

  refs.alertsStatus.textContent = "Sending your request";

  const formData = new FormData(refs.alertsForm);

  try {
    await requestJson(`https://formsubmit.co/ajax/${OFFICE_EMAIL}`, {
      method: "POST",
      headers: {
        Accept: "application/json"
      },
      body: formData
    });

    refs.alertsForm.reset();
    refs.alertsStatus.textContent = "Thanks. Your alert request was sent to the office inbox.";
  } catch (error) {
    const neighborhood = formData.get("neighborhood_interest") || "Not specified";
    const updateType = formData.get("update_type") || "Project alerts";
    const firstName = formData.get("first_name") || "";
    const body = [
      "Project Alerts Signup",
      "",
      `First name: ${firstName}`,
      `Contact: ${contactValue}`,
      `Neighborhood interest: ${neighborhood}`,
      `Update type: ${updateType}`
    ].join("\n");

    window.location.href = `mailto:${OFFICE_EMAIL}?subject=${encodeURIComponent("Miami Beach Project Alerts Signup")}&body=${encodeURIComponent(body)}`;
    refs.alertsStatus.textContent = "Automatic send failed, so your email app was opened instead.";
  }
}

async function boot() {
  try {
    refs.status.textContent = "Loading project data";
    let raw;
    let sourceMode = "live";

    try {
      raw = await withTimeout(requestJson(CITY_FEED_URL), 7000, "Live city feed timed out.");
    } catch (error) {
      raw = await requestJson(LOCAL_FEED_URL);
      sourceMode = "mirror";
    }

    state.dataMode = sourceMode;

    state.projects = normalizeProjects(raw);

    state.projects.forEach(createMarker);
    state.selectedId = state.projects[0]?.id || null;

    const sharedOrigin = getOriginFromUrl();
    if (sharedOrigin) {
      state.origin = sharedOrigin.origin;
      state.radiusMiles = sharedOrigin.radiusMiles;
      state.onlyNearby = true;
      state.sort = "nearby";
      refs.sort.value = "nearby";
      refs.radiusSelect.value = String(sharedOrigin.radiusMiles);
      refs.addressInput.value = sharedOrigin.origin.label;
    }

    paint(true);

    refs.status.textContent = `${sourceMode === "live" ? "Live city feed connected" : "Using mirrored city feed backup"} - ${new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    })}`;
    refs.mapNote.textContent = sourceMode === "live" ? "Live city feed" : "Mirrored city feed backup";
  } catch (error) {
    refs.status.textContent = "Could not load city feed";
    refs.summary.textContent = "Live data unavailable";
    refs.detail.innerHTML = `
      <div class="detail-card">
        <div class="media">
          <div class="fallback">
            <h3>Feed unavailable</h3>
            <p>The city marker endpoint did not respond.</p>
          </div>
        </div>
        <div class="body">
          <p class="desc">${String(error.message || error)}</p>
          <div class="actions">
            <a class="button button-primary" href="${DEFAULT_PROJECT_URL}" target="_blank" rel="noreferrer">Open official city page</a>
          </div>
        </div>
      </div>
    `;
  }
}

refs.search.addEventListener("input", (event) => {
  state.search = event.target.value;
  paint(false);
});

refs.sort.addEventListener("change", (event) => {
  state.sort = event.target.value;
  paint(false);
});

refs.reset.addEventListener("click", () => {
  state.search = "";
  state.categories.clear();
  state.neighborhoods.clear();
  refs.search.value = "";
  refs.sort.value = state.origin ? "nearby" : "az";
  state.sort = refs.sort.value;
  paint(true);
});

refs.addressForm.addEventListener("submit", handleAddressLookup);
refs.radiusSelect.addEventListener("change", handleRadiusChange);
refs.nearbyToggle.addEventListener("change", (event) => {
  state.onlyNearby = event.target.checked;
  paint(true);
});
refs.clearAddress.addEventListener("click", clearAddress);
refs.geoButton.addEventListener("click", useBrowserLocation);
refs.alertsForm.addEventListener("submit", handleAlertsSubmit);

boot();
