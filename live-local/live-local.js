import { locale } from '../language.js';

const app = document.querySelector('.app');
const listEl = document.getElementById('list');
const detail = document.querySelector('.detail');
const detailBody = detail.querySelector('.detail-body');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = () => matchMedia('(max-width: 52rem)').matches;
const METERS_PER_STORY = 3.4;
const COLORS = { approved: '#ff6a45', review: '#78d6c8', building: '#132f3a', buildingTop: '#1b3e4b' };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' }) : null;
const money = n => n ? new Intl.NumberFormat(locale(), { style: 'currency', currency: 'USD', notation: n >= 1e6 ? 'compact' : 'standard', maximumFractionDigits: n >= 1e6 ? 1 : 0 }).format(n) : null;
const num = n => n ? new Intl.NumberFormat(locale()).format(Math.round(n)) : null;
const title = s => String(s).replace(/\s+/g, ' ').replace(/\.$/, '').replace(/\b(Rd|Ave|Dr|St|Av)\b\.?/g, m => ({ Rd: 'Rd', Ave: 'Ave', Dr: 'Dr', St: 'St', Av: 'Ave' }[m.replace('.', '')]));
const ease = t => 1 - Math.pow(1 - t, 3);
const es = () => locale() === 'es-US';
const L = (en, sp) => (es() ? sp : en);
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function waitFor(test, ms = 15000) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    (function check() { if (test()) return resolve(); if (performance.now() - start > ms) return reject(new Error('timeout')); requestAnimationFrame(check); })();
  });
}

async function style() {
  const s = await (await fetch('https://tiles.openfreemap.org/styles/dark')).json();
  const tint = { background: '#071c25', water: '#0a3541', landuse_residential: '#0a222b', landcover_wood: '#0b2a2c', landuse_park: '#0c2d2e' };
  s.layers = s.layers.filter(l => l.id !== 'building' && !/^(aeroway|railway|road_oneway|boundary)/.test(l.id));
  for (const l of s.layers) {
    if (tint[l.id]) { if (l.type === 'background') l.paint = { 'background-color': tint[l.id] }; else l.paint = { ...l.paint, 'fill-color': tint[l.id] }; }
    if (l.type === 'line' && /^highway/.test(l.id)) l.paint = { ...l.paint, 'line-color': /major|motorway/.test(l.id) ? '#1d4250' : '#163642', 'line-opacity': .9 };
    if (l.type === 'symbol') l.paint = { ...l.paint, 'text-color': '#7f989f', 'text-halo-color': '#071c25' };
  }
  const labels = s.layers.findIndex(l => l.type === 'symbol');
  s.sources.mbb = { type: 'geojson', data: '../data/mb-buildings.json', maxzoom: 16, tolerance: 0.2 };
  s.layers.splice(labels, 0, {
    id: 'buildings-3d', type: 'fill-extrusion', source: 'mbb', minzoom: 12.5,
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'f'], 1, COLORS.building, 12, '#1d4351', 40, '#2a5866'],
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 14, ['*', ['get', 'f'], 3.4]],
      'fill-extrusion-opacity': .9,
      'fill-extrusion-vertical-gradient': true
    }
  });
  return s;
}

function featuresFor(data) {
  // One footprint per parcel; if two cases share a parcel, the approved one wins.
  const byKey = new Map();
  for (const f of data.parcels.features) {
    const key = JSON.stringify(f.geometry.coordinates[0]?.[0] || f.geometry.coordinates).slice(0, 80);
    const prev = byKey.get(key);
    if (!prev || (prev.properties.stage !== 'approved' && f.properties.stage === 'approved')) byKey.set(key, f);
  }
  return { type: 'FeatureCollection', features: [...byKey.values()].map((f, i) => ({ ...f, id: i, properties: { ...f.properties, h: f.properties.stories ? f.properties.stories * METERS_PER_STORY : 0 } })) };
}

function card(a) {
  const ht = a.stories ? `<span class="ht">${a.stories}<small>stories</small></span>` : `<span class="ht na">In review</span>`;
  const when = a.stage === 'approved' ? L('Approved', 'Aprobado') : L(`Filed ${date(a.filed)}`, `Presentado el ${date(a.filed)}`);
  return `<li><button type="button" class="card" data-id="${esc(a.id)}" data-stage="${a.stage}"><span class="bar" aria-hidden="true"></span><span class="addr">${esc(title(a.location))}</span>${ht}<span class="meta">${esc(when)} · ${esc(a.number)}</span></button></li>`;
}

function owners(a) {
  // Company names only: drop 'C/O <person>' care-of lines and condo placeholder rows.
  return [...new Set(a.sites.map(s => (s.owner || '').replace(/\s+C\/O\b.*$/i, '').trim()).filter(o => o && !/REFERENCE ONLY/i.test(o)))];
}

function detailHtml(a) {
  const sale = a.sites.filter(s => s.lastSale?.price).sort((x, y) => (y.lastSale.date || '').localeCompare(x.lastSale.date || ''))[0];
  const lot = a.sites.reduce((n, s) => n + (Number(s.lotSize) || 0), 0);
  const built = a.sites.map(s => s.existing).filter(e => e?.yearBuilt);
  const own = owners(a);
  const facts = [
    ['Filed', date(a.filed)],
    [a.stage === 'approved' ? 'Applicant' : 'Owner of record', (a.applicant || '').replace(/\s+C\/O\b.*$/i, '') || own[0] || null, true],
    a.applicant && own.length && norm(own[0]) !== norm(a.applicant.replace(/\s+C\/O\b.*$/i, '')) ? ['Owner of record', own.join(' · '), true] : null,
    sale ? ['Last sale', `${money(sale.lastSale.price)} · ${date(sale.lastSale.date)}`] : null,
    lot ? ['Lot size', `${num(lot)} sq ft`] : null,
    built.length ? ['Built there now', built.length > 1 ? L(`${built.length} buildings, ${Math.min(...built.map(b => b.yearBuilt))}–${Math.max(...built.map(b => b.yearBuilt))}`, `${built.length} edificios, ${Math.min(...built.map(b => b.yearBuilt))}–${Math.max(...built.map(b => b.yearBuilt))}`) : (built[0].floors ? L(`${built[0].floors}-story building, ${built[0].yearBuilt}`, `Edificio de ${built[0].floors} pisos, ${built[0].yearBuilt}`) : String(built[0].yearBuilt)), true] : null,
    a.planner ? ['City planner', a.planner] : null,
    a.uses ? ['Also includes', a.uses, true] : null
  ].filter(f => f && f[1]);
  const hero = a.stories
    ? `<p class="hero-num"><b>${a.stories}</b><span>${L(`stories approved · about ${Math.round(a.stories * 10)} ft · at least 40% of rental units affordable for 30 years`, `pisos aprobados · unos ${Math.round(a.stories * 3.05)} m · al menos 40% de las unidades de alquiler asequibles por 30 años`)}</span></p>`
    : `<p class="hero-num pending"><span>Height isn't public until the City issues its order. The submitted plans are in the case file.</span></p>`;
  const links = [
    a.links.order ? `<a href="${esc(a.links.order)}" target="_blank" rel="noopener">Read the signed approval</a>` : '',
    `<a class="${a.links.order ? 'ghost' : ''}" href="${esc(a.links.civicAccess)}" target="_blank" rel="noopener">Plans and filings (Civic Access)</a>`,
    `<a class="ghost" href="${esc(a.links.cityList)}" target="_blank" rel="noopener">City's Live Local list</a>`
  ].join('');
  return `
    <span class="status ${a.stage}">${a.stage === 'approved' ? 'Approved' : 'Under review'}</span>
    <h2 id="detail-title">${esc(title(a.location))}</h2>
    <p class="case">${esc(a.number)}${a.formerly ? ` · ${L('formerly', 'antes')} ${esc(a.formerly)}` : ''}</p>
    ${hero}
    <dl class="facts">${facts.map(([k, v, wide]) => `<div class="${wide ? 'wide' : ''}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <div class="links">${links}</div>
    <p class="fine">Owner and sale data: City of Miami Beach parcel map. Status: City of Miami Beach Civic Access.</p>`;
}

async function main() {
  const [data] = await Promise.all([fetch('../data/live-local.json?v=' + Date.now().toString().slice(0, -5)).then(r => r.json()), waitFor(() => window.maplibregl)]);
  const apps = data.applications;
  const byId = new Map(apps.map(a => [a.id, a]));
  const approved = apps.filter(a => a.stage === 'approved');

  // Numbers and list
  const set = (k, v) => document.querySelectorAll(`[data-count="${k}"]`).forEach(el => (el.textContent = v));
  set('total', apps.length); set('approved', approved.length); set('review', apps.length - approved.length);
  set('tallest', Math.max(...approved.map(a => a.stories || 0)));
  document.querySelector('[data-updated]').textContent = L(`Updated ${date(data.generatedAt.slice(0, 10))}.`, `Actualizado: ${date(data.generatedAt.slice(0, 10))}.`);
  const order = [...apps].sort((a, b) => (a.stage === b.stage ? (b.stories || 0) - (a.stories || 0) || (b.filed || '').localeCompare(a.filed || '') : a.stage === 'approved' ? -1 : 1));
  listEl.innerHTML = order.map(card).join('');
  listEl.querySelectorAll('.card').forEach((el, i) => (el.style.transitionDelay = `${0.45 + i * 0.045}s`));

  // Map
  const map = new maplibregl.Map({
    container: 'map', style: await style(), center: [-80.1335, 25.808], zoom: 11.7, pitch: 0, bearing: 0,
    maxBounds: [[-80.7, 25.4], [-79.6, 26.25]], attributionControl: { compact: true }, fadeDuration: 300
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  await new Promise(r => map.on('load', r));

  const fc = featuresFor(data);
  map.addSource('ll', { type: 'geojson', data: fc });
  map.addLayer({ id: 'll-glow', type: 'line', source: 'll', paint: { 'line-color': ['match', ['get', 'stage'], 'approved', COLORS.approved, COLORS.review], 'line-width': 10, 'line-blur': 8, 'line-opacity': .55 } });
  map.addLayer({ id: 'll-plate', type: 'fill', source: 'll', paint: { 'fill-color': ['match', ['get', 'stage'], 'approved', COLORS.approved, COLORS.review], 'fill-opacity': ['match', ['get', 'stage'], 'approved', .25, .32] } });
  map.addLayer({ id: 'll-tower', type: 'fill-extrusion', source: 'll', filter: ['==', ['get', 'stage'], 'approved'], paint: {
    'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'active'], false], '#ff8a6b', COLORS.approved],
    'fill-extrusion-height': 0, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': .92, 'fill-extrusion-vertical-gradient': true } });
  map.addLayer({ id: 'll-line', type: 'line', source: 'll', paint: { 'line-color': ['match', ['get', 'stage'], 'approved', '#ffb39f', '#c9f3ec'], 'line-width': ['case', ['boolean', ['feature-state', 'active'], false], 3, 1.6] } });

  // Markers (HTML, so they use the brand type)
  const markers = new Map();
  for (const a of apps) {
    if (!a.center) continue;
    const el = document.createElement('button');
    el.type = 'button'; el.className = `pin ${a.stage}`; el.dataset.id = a.id; el.setAttribute('aria-label', `${title(a.location)}, ${a.stage === 'approved' ? 'approved' : 'under review'}`);
    el.innerHTML = a.stories ? `<b>${a.stories}</b>` : '<i></i>';
    const wrap = document.createElement('div'); wrap.className = 'pin-wrap'; wrap.appendChild(el);
    const marker = new maplibregl.Marker({ element: wrap, anchor: 'bottom', offset: [0, -6] }).setLngLat(a.center).addTo(map);
    markers.set(a.id, { marker, el });
    el.addEventListener('click', ev => { ev.stopPropagation(); select(a.id); });
    el.addEventListener('mouseenter', () => hover(a.id, true));
    el.addEventListener('mouseleave', () => hover(a.id, false));
  }

  // Intro: fly in, then grow the approved towers from the ground
  app.dataset.state = 'ready';
  const pad = () => phone() ? { top: 70, bottom: innerHeight * .58 + 10, left: 10, right: 10 } : { top: 80, bottom: 40, left: document.querySelector('.panel').offsetWidth + 60, right: 40 };
  const bounds = apps.filter(a => a.center).reduce((b, a) => b.extend(a.center), new maplibregl.LngLatBounds(apps.find(a => a.center).center, apps.find(a => a.center).center));
  // Desktop: a tilted view of the whole beach beside the panel. Phones: flat, fit into the strip above the sheet.
  const phonePad = () => ({ top: 130, bottom: Math.round(innerHeight * .58) + 64, left: 36, right: 64 });
  const home = () => phone()
    ? { center: bounds.getCenter(), zoom: 10.45, padding: phonePad(), bearing: 0, pitch: 0 }
    : { center: [-80.1335, 25.8135], zoom: 12.55, padding: { top: 60, bottom: 20, left: document.querySelector('.panel').offsetWidth + 40, right: 20 }, bearing: -20, pitch: 52 };
  const intro = home();
  if (reduced) map.jumpTo(intro); else map.flyTo({ ...intro, duration: 3200, curve: 1.3, essential: true });

  const grow = (to = 1, ms = 1800) => {
    if (reduced) return map.setPaintProperty('ll-tower', 'fill-extrusion-height', ['*', ['get', 'h'], to]);
    const t0 = performance.now();
    (function step(now) {
      const k = ease(Math.min(1, (now - t0) / ms)) * to;
      map.setPaintProperty('ll-tower', 'fill-extrusion-height', ['*', ['get', 'h'], k]);
      if (k < to) requestAnimationFrame(step);
    })(t0);
  };
  setTimeout(() => grow(), reduced ? 0 : 1500);

  // Pulse the under-review footprints
  if (!reduced) {
    (function pulse(now) {
      const p = (Math.sin(now / 520) + 1) / 2;
      map.setPaintProperty('ll-glow', 'line-opacity', ['match', ['get', 'stage'], 'approved', .5, .25 + p * .55]);
      map.setPaintProperty('ll-glow', 'line-width', ['match', ['get', 'stage'], 'approved', 10, 6 + p * 10]);
      requestAnimationFrame(pulse);
    })(0);
  }

  // Hover tooltip on footprints
  const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14 });
  for (const layer of ['ll-plate', 'll-tower']) {
    map.on('mousemove', layer, e => {
      const a = byId.get(e.features[0].properties.id); if (!a) return;
      map.getCanvas().style.cursor = 'pointer';
      tip.setLngLat(e.lngLat).setHTML(`<div class="tip">${esc(title(a.location))}<small>${a.stories ? a.stories + L(' stories · ', ' pisos · ') : ''}${a.stage === 'approved' ? L('Approved', 'Aprobado') : L('Under review', 'En revisión')}</small></div>`).addTo(map);
      hover(a.id, true);
    });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; tip.remove(); hover(null, false); });
    map.on('click', layer, e => select(e.features[0].properties.id));
  }

  let active = null;
  function hover(id, on) {
    listEl.querySelectorAll('.card.is-hover').forEach(el => el.classList.remove('is-hover'));
    markers.forEach(({ el }) => el.classList.remove('is-hover'));
    if (on && id) { listEl.querySelector(`.card[data-id="${CSS.escape(id)}"]`)?.classList.add('is-hover'); markers.get(id)?.el.classList.add('is-hover'); }
  }
  function select(id, { fly = true } = {}) {
    const a = byId.get(id); if (!a) return;
    active = id;
    fc.features.forEach(f => map.setFeatureState({ source: 'll', id: f.id }, { active: f.properties.id === id }));
    listEl.querySelectorAll('.card').forEach(el => el.classList.toggle('is-active', el.dataset.id === id));
    markers.forEach(({ el }, key) => el.classList.toggle('is-active', key === id));
    detailBody.innerHTML = detailHtml(a);
    detail.hidden = false; requestAnimationFrame(() => detail.classList.add('is-open'));
    listEl.querySelector(`.card[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    history.replaceState(null, '', '#' + id);
    if (fly && a.center) {
      const padding = phone() ? { top: 60, bottom: innerHeight * .72, left: 20, right: 20 } : { top: 80, bottom: 60, left: document.querySelector('.panel').offsetWidth + 40, right: detail.offsetWidth + 60 };
      const cam = { center: a.center, zoom: a.stories && a.stories > 14 ? 16.6 : 17.1, pitch: 62, bearing: map.getBearing() - 18, padding };
      reduced ? map.jumpTo(cam) : map.flyTo({ ...cam, duration: 2200, curve: 1.6, essential: true });
    }
  }
  function close() {
    active = null;
    detail.classList.remove('is-open');
    setTimeout(() => { if (!active) detail.hidden = true; }, 450);
    fc.features.forEach(f => map.setFeatureState({ source: 'll', id: f.id }, { active: false }));
    document.querySelectorAll('.card.is-active, .pin.is-active').forEach(el => el.classList.remove('is-active'));
    history.replaceState(null, '', location.pathname + location.search);
    const cam = home();
    reduced ? map.jumpTo(cam) : map.flyTo({ ...cam, duration: 2000, curve: 1.4 });
  }
  detail.querySelector('[data-close]').addEventListener('click', close);
  addEventListener('keydown', e => { if (e.key === 'Escape' && active) close(); });

  listEl.addEventListener('click', e => { const c = e.target.closest('.card'); if (c) select(c.dataset.id); });
  listEl.addEventListener('mouseover', e => { const c = e.target.closest('.card'); if (c) hover(c.dataset.id, true); });
  listEl.addEventListener('mouseleave', () => hover(null, false));

  // Filters
  document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
    const f = chip.dataset.filter;
    document.querySelectorAll('.chip').forEach(c => { const on = c === chip; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', on); });
    listEl.querySelectorAll('.card').forEach(el => (el.parentElement.hidden = f !== 'all' && el.dataset.stage !== f));
    markers.forEach(({ el }) => el.classList.toggle('is-dim', f !== 'all' && !el.classList.contains(f)));
    const filter = f === 'all' ? null : ['==', ['get', 'stage'], f];
    for (const id of ['ll-glow', 'll-plate', 'll-line']) map.setFilter(id, filter);
    map.setFilter('ll-tower', f === 'review' ? ['==', 1, 0] : ['==', ['get', 'stage'], 'approved']);
  }));

  document.addEventListener('language:change', () => {
    listEl.innerHTML = order.map(card).join('');
    if (active) { listEl.querySelector(`.card[data-id="${CSS.escape(active)}"]`)?.classList.add('is-active'); detailBody.innerHTML = detailHtml(byId.get(active)); }
    document.querySelector('[data-updated]').textContent = L(`Updated ${date(data.generatedAt.slice(0, 10))}.`, `Actualizado: ${date(data.generatedAt.slice(0, 10))}.`);
  });

  // Deep link
  const start = decodeURIComponent(location.hash.slice(1));
  if (byId.has(start)) setTimeout(() => select(start), reduced ? 0 : 3300);
}

main().catch(error => {
  console.error(error);
  app.dataset.state = 'error';
  listEl.innerHTML = '<li class="fine">The map could not load. The City\'s own lists are linked under Sources.</li>';
});
