const state = {
  view: 'active',
  datasets: {
    active: [],
    future: []
  },
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
  eyebrow: document.getElementById('view-eyebrow'),
  tabs: [...document.querySelectorAll('.view-tab')],
  legend: document.getElementById('map-legend'),
  stats: document.getElementById('stats-grid'),
  chart: document.getElementById('chart'),
  hoodChart: document.getElementById('hood-chart'),
  transparency: document.getElementById('transparency-grid'),
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
const CATEGORY_COLORS = ['#177f7a', '#e7624f', '#c59a35', '#135579', '#6f8f3d', '#f08a4b', '#092b49', '#8c5f9f'];
const DATASET_LABELS = {
  active: {
    eyebrow: 'Live project view',
    title: 'All active projects',
    source: count => `Using mirrored City of Miami Beach active-project data: ${count} mapped projects.`
  },
  future: {
    eyebrow: 'Future project needs',
    title: 'All future projects',
    source: count => `Using June 5, 2026 Critical Infrastructure Funding presentation data: ${count} mapped future projects.`
  }
};

function deriveArea(project) {
  const text = `${project.title} ${project.address} ${project.summary}`.toLowerCase();
  const lat = project.lat;
  const lng = project.lng;

  if (/south pointe|first street|\b1st street\b|\b1 street\b|nikki|lot p2/.test(text) || lat < 25.7725) return 'South of Fifth';
  if (/ocean drive|5th street|5 street|6th st|6 street|fire station/.test(text)) return 'Ocean Drive / Fifth Street';
  if (/west avenue/.test(text)) return 'West Avenue';
  if (/flamingo|slow streets|fire flow|meridian/.test(text)) return 'Flamingo Park';
  if (/lincoln road/.test(text)) return 'Lincoln Road';
  if (/collins park|23 street|23rd|promenade|dade blvd|collins canal/.test(text)) return 'Collins Park';
  if (/marine patrol|sunset harbour/.test(text)) return 'Sunset Harbour';
  if (/venetian/.test(text)) return 'Venetian Islands';
  if (/sunset islands/.test(text)) return 'Sunset Islands';
  if (/bayshore/.test(text) || (lat >= 25.801 && lat < 25.809 && lng > -80.138 && lng < -80.127)) return 'Bayshore';
  if (/41 street|41st/.test(text) || (lat >= 25.809 && lat < 25.821)) return '41st Street / Mid-Beach';
  if (/pine tree|pump station #28|28 street|beach view|5301 collins/.test(text) || (lat >= 25.821 && lat < 25.836)) return 'Mid-Beach / Collins Corridor';
  if (/normandy/.test(text)) return 'Normandy Isles';
  if (/biscayne point/.test(text)) return 'Biscayne Point';
  if (/72 street|72nd|community complex/.test(text)) return 'North Beach Town Center';
  if (/north shore|log cabin|oceanside/.test(text) || lat >= 25.865) return 'North Shore / Oceanside';
  if (/indian creek|shane/.test(text) || (lat >= 25.842 && lat < 25.855)) return 'Indian Creek / North Beach';

  return project.hood || 'Miami Beach';
}

function colorForCategory(category) {
  const categories = [...new Set(state.projects.map(p => p.category))].sort();
  const index = Math.max(0, categories.indexOf(category));
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

function initMap() {
  state.map = L.map(els.map, { zoomControl: false, scrollWheelZoom: true }).setView([25.806, -80.132], 12);
  L.control.zoom({ position: 'bottomright' }).addTo(state.map);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap & Carto',
    maxZoom: 20
  }).addTo(state.map);
  state.layer = L.layerGroup().addTo(state.map);
}

async function loadJson(paths) {
  for (const url of paths) {
    try {
      const res = await fetch(`${url}?v=20260604`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      console.warn('Project feed failed', url, error);
    }
  }
  throw new Error('Could not load project data.');
}

function normalizeActive(data) {
  return data.filter(validProject).map(p => {
    const project = {
      ...p,
      dataset: 'active',
      title: clean(p.title),
      summary: clean(p.summary),
      category: clean(p.category) || 'Other',
      hood: clean(p.hood) || 'Miami Beach',
      address: clean(p.address),
      lat: +p.lat,
      lng: +p.lng
    };
    project.area = deriveArea(project);
    return project;
  });
}

function normalizeFuture(data) {
  return data.filter(validProject).map(p => {
    const project = {
      ...p,
      dataset: 'future',
      title: clean(p.title),
      summary: clean(p.summary),
      category: clean(p.category) || 'Future Infrastructure',
      hood: clean(p.hood) || 'Miami Beach',
      area: clean(p.area) || clean(p.hood) || 'Miami Beach',
      address: clean(p.address || p.area || p.hood),
      phaseWindow: clean(p.phaseWindow || 'Future funding need'),
      source: clean(p.source || 'Critical Infrastructure Funding presentation, June 5, 2026'),
      link: p.link || 'https://docs.google.com/presentation/d/1I7hCgh6ZmT26NXUE4aO2mQmtftqUYn6f/edit',
      lat: +p.lat,
      lng: +p.lng,
      totalNeed: Number(p.totalNeed || 0)
    };
    return project;
  });
}

async function loadProjects() {
  const [activeData, futureData] = await Promise.all([
    loadJson(['data/projects.json', './data/projects.json']),
    loadJson(['data/future-projects.json', './data/future-projects.json'])
  ]);
  state.datasets.active = normalizeActive(activeData);
  state.datasets.future = normalizeFuture(futureData);
  setView('active', false);
}

function setView(view, shouldRender = true) {
  state.view = view;
  state.projects = state.datasets[view] || [];
  state.filtered = [...state.projects].sort((a,b)=>a.title.localeCompare(b.title));
  state.origin = null;
  if (state.userMarker) {
    state.layer.removeLayer(state.userMarker);
    state.userMarker = null;
  }
  els.status.textContent = 'Search to highlight nearby projects.';
  if (els.eyebrow) els.eyebrow.textContent = DATASET_LABELS[view].eyebrow;
  els.source.textContent = DATASET_LABELS[view].source(state.projects.length);
  els.tabs.forEach(tab => {
    const active = tab.dataset.view === view;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  buildFilters();
  if (shouldRender) applyFilters();
}

function formatMoney(value) {
  if (!Number.isFinite(value) || value <= 0) return 'Need TBD';
  if (value >= 1000000) {
    const rounded = value / 1000000;
    return `$${rounded >= 10 ? rounded.toFixed(1).replace('.0', '') : rounded.toFixed(2).replace(/0$/, '').replace('.0', '')}M`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function buildFilters() {
  els.hood.innerHTML = '<option value="all">All neighborhoods</option>';
  els.cat.innerHTML = '<option value="all">All project types</option>';
  els.signupNeighborhood.innerHTML = '<option>Any Miami Beach neighborhood</option>';
  const hoods = [...new Set(state.projects.map(p => p.area))].sort();
  const cats = [...new Set(state.projects.map(p => p.category))].sort();
  hoods.forEach(h => els.hood.append(new Option(h, h)));
  cats.forEach(c => els.cat.append(new Option(c, c)));
  hoods.forEach(h => els.signupNeighborhood.append(new Option(h, h)));
}

function pin(color = '#e7624f', colorClass = '') {
  return L.divIcon({ className: '', html: `<div class="marker-pin ${colorClass}" style="--pin-color:${color}"><span></span></div>`, iconSize: [26, 32], iconAnchor: [13, 28], popupAnchor: [0, -27] });
}

function applyFilters() {
  const hood = els.hood.value;
  const cat = els.cat.value;
  state.radius = Number(els.radius.value || 1);
  state.filtered = state.projects
    .filter(p => hood === 'all' || p.area === hood)
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
    const color = colorForCategory(p.category);
    const linkText = state.view === 'future' ? 'Open source presentation' : 'Open official project page';
    const detail = state.view === 'future' ? `${p.area} / ${p.category} / ${formatMoney(p.totalNeed)}` : `${p.area} / ${p.category}`;
    const marker = L.marker([p.lat, p.lng], { icon: pin(color) }).bindPopup(`<div class="popup"><strong>${p.title}</strong><p><i style="background:${color}"></i>${detail}</p><a href="${p.link}" target="_blank" rel="noreferrer">${linkText}</a></div>`);
    marker.addTo(state.layer);
    state.markers.push(marker);
  });
  if (state.userMarker) state.userMarker.addTo(state.layer);
  const points = [...state.filtered.map(p => [p.lat, p.lng]), ...(state.origin ? [[state.origin.lat, state.origin.lng]] : [])];
  if (points.length > 1) state.map.fitBounds(points, { padding: [34, 34], maxZoom: 14 });
  if (points.length === 1) state.map.setView(points[0], 14);
}

function renderList() {
  const label = state.view === 'future' ? 'future project' : 'project';
  els.count.textContent = `${state.filtered.length} ${label}${state.filtered.length === 1 ? '' : 's'}`;
  els.title.textContent = state.origin ? `Near ${state.origin.label} within ${state.radius} mile${state.radius === 1 ? '' : 's'}` : DATASET_LABELS[state.view].title;
  if (!state.filtered.length) {
    els.list.innerHTML = '<p>No projects match this search. Try a larger radius or fewer filters.</p>';
    return;
  }
  const linkText = state.view === 'future' ? 'Open source presentation' : 'Open official project page';
  els.list.innerHTML = state.filtered.map(p => `
    <article class="project-card">
      ${p.image ? `<img class="thumb" src="${p.image}" alt="">` : `<div class="thumb ${state.view === 'future' ? 'future-thumb' : ''}" aria-hidden="true">${state.view === 'future' ? 'FY' : ''}</div>`}
      <div>
        <h3>${p.title}</h3>
        ${state.view === 'future' ? `<div class="future-meta"><span class="cost-pill">${formatMoney(p.totalNeed)} planned need</span><span class="cost-pill">${p.phaseWindow}</span></div>` : ''}
        <p>${p.summary || p.address || 'Project details available from the official city page.'}</p>
        <div class="meta">
          <span class="pill">${p.area}</span>
          <span class="pill">${p.hood}</span>
          <span class="pill">${p.category}</span>
          ${p.distance != null ? `<span class="pill">${p.distance.toFixed(2)} mi</span>` : ''}
        </div>
        <p><a href="${p.link}" target="_blank" rel="noreferrer">${linkText}</a></p>
      </div>
    </article>`).join('');
}

function renderStats() {
  const all = state.filtered;
  const byHood = countBy(all, 'area');
  const byCat = countBy(all, 'category');
  const topHood = topEntry(byHood);
  const totalCategories = new Set(state.projects.map(p => p.category)).size;
  const visibleShare = state.projects.length ? Math.round(all.length / state.projects.length * 100) : 0;
  if (state.view === 'future') {
    const totalNeed = all.reduce((sum, project) => sum + (project.totalNeed || 0), 0);
    const nearTerm = all.filter(p => /2027|2028|2029|2030/.test(p.phaseWindow)).length;
    els.stats.innerHTML = `
      <div class="stat"><strong>${all.length}</strong><span>Visible future projects</span></div>
      <div class="stat"><strong>${formatMoney(totalNeed)}</strong><span>Visible planned need</span></div>
      <div class="stat"><strong>${nearTerm}</strong><span>Includes FY27-FY30</span></div>
      <div class="stat"><strong>${totalCategories}</strong><span>Project types</span></div>`;
  } else {
    els.stats.innerHTML = `
      <div class="stat"><strong>${all.length}</strong><span>Visible projects</span></div>
      <div class="stat"><strong>${topHood?.[0] || 'n/a'}</strong><span>Busiest area</span></div>
      <div class="stat"><strong>${visibleShare}%</strong><span>Of full feed</span></div>
      <div class="stat"><strong>${totalCategories}</strong><span>Project types</span></div>`;
  }
  renderTypeChart(byCat);
  renderHoodChart(byHood);
  renderLegend();
  renderTransparency(all);
}

function countBy(items, key) {
  return items.reduce((acc, item) => { acc[item[key]] = (acc[item[key]] || 0) + 1; return acc; }, {});
}
function topEntry(obj) { return Object.entries(obj).sort((a,b)=>b[1]-a[1])[0]; }
function render() { renderMap(); renderList(); renderStats(); }

function renderTypeChart(byCat) {
  const total = Math.max(1, Object.values(byCat).reduce((sum, value) => sum + value, 0));
  els.chart.innerHTML = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name, value], index) => {
    const color = colorForCategory(name);
    const share = Math.round(value / total * 100);
    return `
      <div class="bar type-bar" style="--bar-color:${color}">
        <div class="bar-rank">${index + 1}</div>
        <div>
          <div class="bar-label"><span>${name}</span><span>${value} / ${share}%</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, share)}%;background:${color}"></div></div>
        </div>
      </div>`;
  }).join('') || '<p>No chart data yet.</p>';
}

function renderHoodChart(byHood) {
  if (!els.hoodChart) return;
  const hoodColors = { 'South Beach': '#e7624f', 'Mid Beach': '#c59a35', 'North Beach': '#177f7a' };
  const total = Math.max(1, Object.values(byHood).reduce((sum, value) => sum + value, 0));
  els.hoodChart.innerHTML = Object.entries(byHood).sort((a,b)=>b[1]-a[1]).map(([name, value]) => {
    const color = hoodColors[name] || '#135579';
    const share = Math.round(value / total * 100);
    return `
      <div class="bar">
        <div class="bar-label"><span>${name}</span><span>${value} / ${share}%</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, share)}%;background:${color}"></div></div>
      </div>`;
  }).join('') || '<p>No neighborhood data yet.</p>';
}

function renderLegend() {
  if (!els.legend) return;
  const byCat = countBy(state.projects, 'category');
  els.legend.innerHTML = Object.entries(byCat).sort((a,b)=>a[0].localeCompare(b[0])).map(([name, value]) => `
    <div class="legend-item">
      <span style="background:${colorForCategory(name)}"></span>
      <b>${name}</b>
      <em>${value}</em>
    </div>`).join('');
}

function renderTransparency(visibleProjects) {
  if (!els.transparency) return;
  const areas = new Set(visibleProjects.map(p => p.area)).size;
  const searchView = state.origin ? `${state.radius} mi` : 'Citywide';
  if (state.view === 'future') {
    const totalNeed = visibleProjects.reduce((sum, project) => sum + (project.totalNeed || 0), 0);
    const water = visibleProjects.filter(p => /Water|Sewer|Pump|Force Main/i.test(p.category)).length;
    const storm = visibleProjects.filter(p => /Stormwater|Flood|Neighborhood/i.test(p.category)).length;
    const north = visibleProjects.filter(p => /North/i.test(p.hood)).length;
    els.transparency.innerHTML = [
      ['Visible future need', formatMoney(totalNeed)],
      ['Detailed areas shown', areas],
      ['Water / sewer projects', water],
      ['Flooding / stormwater', storm],
      ['North Beach items', north],
      ['Current search view', searchView]
    ].map(([label, value]) => `<div class="mini-stat"><strong>${value}</strong><span>${label}</span></div>`).join('');
    return;
  }
  const infrastructure = visibleProjects.filter(p => /Infrastructure|Neighborhood Improvement/i.test(p.category)).length;
  const parks = visibleProjects.filter(p => /Parks|Environmental/i.test(p.category)).length;
  const gob = visibleProjects.filter(p => /G\.O\. Bond/i.test(p.category)).length;
  els.transparency.innerHTML = [
    ['Visible projects', visibleProjects.length],
    ['Detailed areas shown', areas],
    ['Infrastructure / flooding', infrastructure],
    ['Parks / public space', parks],
    ['GO Bond funded', gob],
    ['Current search view', searchView]
  ].map(([label, value]) => `<div class="mini-stat"><strong>${value}</strong><span>${label}</span></div>`).join('');
}

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
    state.userMarker = L.marker([state.origin.lat, state.origin.lng], { icon: pin('#177f7a', 'user-pin') }).bindPopup(`<strong>${state.origin.label}</strong>`);
    els.status.textContent = `Showing projects within ${els.radius.value} mile${els.radius.value === '1' ? '' : 's'} of ${state.origin.label}.`;
    applyFilters();
  } catch (error) {
    els.status.textContent = error.message;
  }
});

[els.hood, els.cat, els.radius].forEach(el => el.addEventListener('change', applyFilters));

els.tabs.forEach(tab => tab.addEventListener('click', () => setView(tab.dataset.view)));

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
    await loadProjects();
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'future') setView('future', false);
    applyFilters();
    if (params.has('lat') && params.has('lng')) {
      state.origin = { lat: +params.get('lat'), lng: +params.get('lng'), label: 'shared lookup point' };
      els.radius.value = params.get('radius') || '1';
      state.userMarker = L.marker([state.origin.lat, state.origin.lng], { icon: pin('#177f7a', 'user-pin') }).bindPopup('<strong>Shared lookup point</strong>');
      applyFilters();
    }
  } catch (error) {
    els.count.textContent = 'Projects unavailable';
    els.list.innerHTML = `<p>${error.message}</p>`;
    els.source.textContent = 'Project feed could not be loaded.';
  }
})();
