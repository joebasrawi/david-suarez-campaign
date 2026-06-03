const state = {
  projects: [],
  filtered: [],
  origin: null,
  radius: 1,
  markers: [],
  userMarker: null,
  map: null,
  layer: null
};

const els = {
  map: document.getElementById('map'),
  count: document.getElementById('project-count'),
  list: document.getElementById('project-list'),
  title: document.getElementById('results-title'),
  hood: document.getElementById('hood-filter'),
  cat: document.getElementById('category-filter'),
  form: document.getElementById('address-form'),
  address: document.getElementById('address-input'),
  radius: document.getElementById('radius-input'),
  status: document.getElementById('lookup-status'),
  source: document.getElementById('source-note'),
  stats: document.getElementById('stats-grid'),
  chart: document.getElementById('chart'),
  signupForm: document.getElementById('updates-form'),
  signupStatus: document.getElementById('signup-status'),
  signupNeighborhood: document.getElementById('signup-neighborhood')
};

const miles = (a, b) => {
  const R = 3958.8;
  const toRad = n => n * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const clean = value => String(value || '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const validProject = p => Number.isFinite(+p.lat) && Number.isFinite(+p.lng);

function initMap() {
  state.map = L.map(els.map, { zoomControl: false, scrollWheelZoom: true }).setView([25.806, -80.132], 12);
  L.control.zoom({ position: 'bottomright' }).addTo(state.map);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap & Carto',
    maxZoom: 20
  }).addTo(state.map);
  state.layer = L.layerGroup().addTo(state.map);
}

async function loadProjects() {
  const urls = ['data/projects.json', './data/projects.json'];
  for (const url of urls) {
    try {
      const res = await fetch(`${url}?v=20260603`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.filter(validProject).map(p => ({
        ...p,
        title: clean(p.title),
        summary: clean(p.summary),
        category: clean(p.category) || 'Other',
        hood: clean(p.hood) || 'Miami Beach',
        address: clean(p.address),
        lat: +p.lat,
        lng: +p.lng
      }));
    } catch (error) {
      console.warn('Project feed failed', url, error);
    }
  }
  throw new Error('Could not load project data.');
}

function buildFilters() {
  const hoods = [...new Set(state.projects.map(p => p.hood))].sort();
  const cats = [...new Set(state.projects.map(p => p.category))].sort();
  hoods.forEach(h => els.hood.append(new Option(h, h)));
  cats.forEach(c => els.cat.append(new Option(c, c)));
  hoods.forEach(h => els.signupNeighborhood.append(new Option(h, h)));
}

function pin(colorClass = '') {
  return L.divIcon({ className: '', html: `<div class="marker-pin ${colorClass}"><span></span></div>`, iconSize: [26, 32], iconAnchor: [13, 28], popupAnchor: [0, -27] });
}

function applyFilters() {
  const hood = els.hood.value;
  const cat = els.cat.value;
  state.radius = Number(els.radius.value || 1);
  state.filtered = state.projects
    .filter(p => hood === 'all' || p.hood === hood)
    .filter(p => cat === 'all' || p.category === cat)
    .map(p => ({ ...p, distance: state.origin ? miles(state.origin, p) : null }))
    .filter(p => !state.origin || p.distance <= state.radius)
    .sort((a, b) => state.origin ? a.distance - b.distance : a.title.localeCompare(b.title));
  render();
}

function renderMap() {
  state.layer.clearLayers();
  state.markers = [];
  state.filtered.forEach(p => {
    const marker = L.marker([p.lat, p.lng], { icon: pin() }).bindPopup(`<div class="popup"><strong>${p.title}</strong><p>${p.hood} / ${p.category}</p><a href="${p.link}" target="_blank" rel="noreferrer">Official project page</a></div>`);
    marker.addTo(state.layer);
    state.markers.push(marker);
  });
  if (state.userMarker) state.userMarker.addTo(state.layer);
  const points = [...state.filtered.map(p => [p.lat, p.lng]), ...(state.origin ? [[state.origin.lat, state.origin.lng]] : [])];
  if (points.length > 1) state.map.fitBounds(points, { padding: [34, 34], maxZoom: 14 });
  if (points.length === 1) state.map.setView(points[0], 14);
}

function renderList() {
  els.count.textContent = `${state.filtered.length} project${state.filtered.length === 1 ? '' : 's'}`;
  els.title.textContent = state.origin ? `Near ${state.origin.label} within ${state.radius} mile${state.radius === 1 ? '' : 's'}` : 'All active projects';
  if (!state.filtered.length) {
    els.list.innerHTML = '<p>No projects match this search. Try a larger radius or fewer filters.</p>';
    return;
  }
  els.list.innerHTML = state.filtered.map(p => `
    <article class="project-card">
      ${p.image ? `<img class="thumb" src="${p.image}" alt="">` : '<div class="thumb" aria-hidden="true"></div>'}
      <div>
        <h3>${p.title}</h3>
        <p>${p.summary || p.address || 'Project details available from the official city page.'}</p>
        <div class="meta">
          <span class="pill">${p.hood}</span>
          <span class="pill">${p.category}</span>
          ${p.distance != null ? `<span class="pill">${p.distance.toFixed(2)} mi</span>` : ''}
        </div>
        <p><a href="${p.link}" target="_blank" rel="noreferrer">Open official project page</a></p>
      </div>
    </article>`).join('');
}

function renderStats() {
  const all = state.filtered;
  const byHood = countBy(all, 'hood');
  const byCat = countBy(all, 'category');
  const topHood = topEntry(byHood);
  const topCat = topEntry(byCat);
  els.stats.innerHTML = `
    <div class="stat"><strong>${all.length}</strong><span>Visible projects</span></div>
    <div class="stat"><strong>${topHood?.[0] || 'n/a'}</strong><span>Busiest area</span></div>
    <div class="stat"><strong>${topCat?.[0] || 'n/a'}</strong><span>Top type</span></div>
    <div class="stat"><strong>${state.origin ? state.radius : 'All'}</strong><span>${state.origin ? 'Mile radius' : 'Citywide view'}</span></div>`;
  const max = Math.max(1, ...Object.values(byCat));
  els.chart.innerHTML = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([name, value]) => `
    <div class="bar">
      <div class="bar-label"><span>${name}</span><span>${value}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, value / max * 100)}%"></div></div>
    </div>`).join('') || '<p>No chart data yet.</p>';
}

function countBy(items, key) {
  return items.reduce((acc, item) => { acc[item[key]] = (acc[item[key]] || 0) + 1; return acc; }, {});
}
function topEntry(obj) { return Object.entries(obj).sort((a,b)=>b[1]-a[1])[0]; }
function render() { renderMap(); renderList(); renderStats(); }

async function geocode(query) {
  const q = query.trim();
  const pair = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (pair) return { lat: +pair[1], lng: +pair[2], label: q };
  const local = localGuess(q);
  const providers = [
    `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(q + ', Miami Beach, FL')}&f=json&maxLocations=1`,
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + ', Miami Beach, Florida')}`
  ];
  for (const url of providers) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.candidates?.[0]) return { lat: data.candidates[0].location.y, lng: data.candidates[0].location.x, label: q };
      if (data[0]) return { lat: +data[0].lat, lng: +data[0].lon, label: q };
    } catch (e) { console.warn('Geocoder failed', e); }
  }
  if (local) return local;
  throw new Error('Address not found. Try a Miami Beach landmark, intersection, or coordinates.');
}

function localGuess(query) {
  const q = query.toLowerCase();
  if (q.includes('city hall') || q.includes('convention')) return { lat: 25.7929, lng: -80.1341, label: 'Miami Beach City Hall' };
  if (q.includes('flamingo')) return { lat: 25.7842, lng: -80.1382, label: 'Flamingo Park' };
  if (q.includes('north beach')) return { lat: 25.8579, lng: -80.1227, label: 'North Beach' };
  const street = q.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(street|st)\b/);
  if (street) {
    const n = Math.max(1, Math.min(87, Number(street[1])));
    const lat = 25.768 + n * 0.00118;
    const lng = q.includes('west') || q.includes('alton') ? -80.141 : q.includes('collins') || q.includes('ocean') ? -80.128 : -80.134;
    return { lat, lng, label: `${n} Street area` };
  }
  return null;
}

els.form.addEventListener('submit', async event => {
  event.preventDefault();
  const query = els.address.value.trim();
  if (!query) return;
  els.status.textContent = 'Finding that address...';
  try {
    state.origin = await geocode(query);
    if (state.userMarker) state.layer.removeLayer(state.userMarker);
    state.userMarker = L.marker([state.origin.lat, state.origin.lng], { icon: pin('user-pin') }).bindPopup(`<strong>${state.origin.label}</strong>`);
    els.status.textContent = `Showing projects within ${els.radius.value} mile${els.radius.value === '1' ? '' : 's'} of ${state.origin.label}.`;
    applyFilters();
  } catch (error) {
    els.status.textContent = error.message;
  }
});

[els.hood, els.cat, els.radius].forEach(el => el.addEventListener('change', applyFilters));

els.signupForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(els.signupForm));
  const message = `Project updates request%0AContact: ${encodeURIComponent(data.contact)}%0ANeighborhood: ${encodeURIComponent(data.neighborhood)}%0AInterest: ${encodeURIComponent(data.interest)}`;
  const isPhone = /\d{7,}/.test(data.contact.replace(/\D/g, ''));
  const href = isPhone ? `sms:?&body=${message}` : `mailto:josephbasrawi@miamibeachfl.gov?subject=Project updates request&body=${message}`;
  els.signupStatus.textContent = 'Opening a message draft. The resident chooses whether to send it.';
  window.location.href = href;
});

(async function boot() {
  initMap();
  try {
    state.projects = await loadProjects();
    buildFilters();
    state.filtered = [...state.projects].sort((a,b)=>a.title.localeCompare(b.title));
    els.source.textContent = `Using mirrored City of Miami Beach active-project data: ${state.projects.length} mapped projects.`;
    applyFilters();
    const params = new URLSearchParams(location.search);
    if (params.has('lat') && params.has('lng')) {
      state.origin = { lat: +params.get('lat'), lng: +params.get('lng'), label: 'shared lookup point' };
      els.radius.value = params.get('radius') || '1';
      state.userMarker = L.marker([state.origin.lat, state.origin.lng], { icon: pin('user-pin') }).bindPopup('<strong>Shared lookup point</strong>');
      applyFilters();
    }
  } catch (error) {
    els.count.textContent = 'Projects unavailable';
    els.list.innerHTML = `<p>${error.message}</p>`;
    els.source.textContent = 'Project feed could not be loaded.';
  }
})();
