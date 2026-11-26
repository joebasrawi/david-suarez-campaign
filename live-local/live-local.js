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
      'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'h'], 0, COLORS.building, 60, '#1b3d4a', 200, '#24505e', 400, '#2d6070'],
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 14, ['*', ['max', ['get', 'h'], 14], 0.3048]],
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
  return { type: 'FeatureCollection', features: [...byKey.values()].map((f, i) => ({ ...f, id: i, properties: { ...f.properties, h: f.properties.stories ? Math.round((f.properties.stories * 10.5) / 5) * 5 * 0.3048 : 0 } })) };
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
    ? `<p class="hero-num"><b>${a.stories}</b><span>${L(`stories approved · about ${a.heightFt} ft · at least 40% of rental units affordable for 30 years`, `pisos aprobados · unos ${a.heightFt} pies (${Math.round(a.heightFt * 0.3048)} m) · al menos 40% de las unidades de alquiler asequibles por 30 años`)}</span></p>`
    : `<p class="hero-num pending"><span>Height isn't public until the City issues its order. The submitted plans are in the case file.</span></p>`;
  const c = a.compare;
  let compare = '';
  if (c && c.quarterMile.tallest) {
    const q = c.quarterMile, m = c.mile;
    const rows = [
      a.heightFt ? { k: L('This project (approved)', 'Este proyecto (aprobado)'), ft: a.heightFt, note: L(`about ${a.heightFt} ft · ${a.stories} stories`, `unos ${a.heightFt} pies · ${a.stories} pisos`), cls: 'me' } : null,
      { k: L('Tallest within ¼ mile', 'Más alto a ¼ de milla'), ft: q.tallest.ft, note: `${q.tallest.ft} ft${q.tallest.address ? ' · ' + title(q.tallest.address.toLowerCase().replace(/\b\w/g, x => x.toUpperCase())) : ''}`, cls: 'tall' },
      { k: L('Typical building within ¼ mile', 'Edificio típico a ¼ de milla'), ft: q.typicalFt, note: `${q.typicalFt} ft`, cls: 'typ' },
      { k: L('Tallest within 1 mile', 'Más alto a 1 milla'), ft: m.tallest.ft, note: `${m.tallest.ft} ft${m.tallest.address ? ' · ' + title(m.tallest.address.toLowerCase().replace(/\b\w/g, x => x.toUpperCase())) : ''}`, cls: 'far' }
    ].filter(Boolean);
    const max = Math.max(...rows.map(r => r.ft));
    const times = a.heightFt && q.typicalFt ? Math.round(a.heightFt / q.typicalFt) : null;
    const lede = a.heightFt
      ? (times >= 2 ? L(`About ${times}× the height of the typical building around it. ${q.taller === 0 ? 'Nothing within a quarter mile is taller.' : q.taller === 1 ? 'Only one building within a quarter mile is taller.' : q.taller + ' buildings within a quarter mile are taller.'}`, `Unas ${times} veces la altura del edificio típico a su alrededor. ${q.taller === 0 ? 'Nada a un cuarto de milla es más alto.' : q.taller === 1 ? 'Solo un edificio a un cuarto de milla es más alto.' : q.taller + ' edificios a un cuarto de milla son más altos.'}`) : '')
      : L('Height not public yet. For context, what stands around it today:', 'La altura aún no es pública. Como referencia, lo que hay a su alrededor hoy:');
    compare = `<section class="compare"><h3>${L('How it compares', 'Cómo se compara')}</h3>${lede ? `<p class="compare-lede">${esc(lede)}</p>` : ''}<ul>${rows.map((r, i) => `<li class="${r.cls}"><span class="k">${esc(r.k)}</span><span class="track"><span class="fill" style="--w:${Math.max(2, (r.ft / max) * 100).toFixed(1)}%;--d:${0.25 + i * 0.12}s"></span></span><span class="v">${esc(r.note)}</span></li>`).join('')}</ul><p class="fine">${L('Existing heights: Miami-Dade County building footprints (LiDAR). Project height estimated at 10.5 ft per story.', 'Alturas existentes: huellas de edificios del Condado Miami-Dade (LiDAR). Altura del proyecto estimada a 10.5 pies por piso.')}</p></section>`;
  }
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
    ${compare}
    <dl class="facts">${facts.map(([k, v, wide]) => `<div class="${wide ? 'wide' : ''}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <div class="links">${links}</div>
    <p class="fine">Owner and sale data: City of Miami Beach parcel map. Status: City of Miami Beach Civic Access.</p>`;
}

// ---------- Flat engine (MapLibre): stylized 3D city from LiDAR footprints ----------
async function flatEngine({ data, apps, byId, cb }) {
  await waitFor(() => window.maplibregl);
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

  // Quarter-mile and one-mile rings around the selected site
  const circle = (c, r, n = 128) => { const k = Math.PI / 180, out = []; for (let i = 0; i <= n; i++) { const t = (i / n) * 2 * Math.PI; out.push([c[0] + (r / (111320 * Math.cos(c[1] * k))) * Math.sin(t), c[1] + (r / 110540) * Math.cos(t)]); } return out; };
  map.addSource('rings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'rings', type: 'line', source: 'rings', paint: { 'line-color': '#b8e0cc', 'line-width': 1.4, 'line-dasharray': [2, 3], 'line-opacity': 0 } }, 'll-glow');
  map.addLayer({ id: 'ring-labels', type: 'symbol', source: 'rings', filter: ['==', ['geometry-type'], 'Point'], layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-letter-spacing': .08 }, paint: { 'text-color': '#b8e0cc', 'text-halo-color': '#071c25', 'text-halo-width': 1.5, 'text-opacity': 0 } });
  const showRings = a => {
    if (!a?.center) return map.getSource('rings').setData({ type: 'FeatureCollection', features: [] });
    const feats = [[402, L('¼ mile', '¼ milla')], [1609, L('1 mile', '1 milla')]].flatMap(([r, label]) => { const ring = circle(a.center, r); return [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring } }, { type: 'Feature', properties: { label }, geometry: { type: 'Point', coordinates: ring[0] } }]; });
    map.getSource('rings').setData({ type: 'FeatureCollection', features: feats });
    fadePaint('rings', 'line-opacity', .7); fadePaint('ring-labels', 'text-opacity', 1);
  };
  function fadePaint(layer, prop, to, ms = 700) {
    if (reduced) return map.setPaintProperty(layer, prop, to);
    map.setPaintProperty(layer, prop + '-transition', { duration: ms, delay: 0 }); map.setPaintProperty(layer, prop, to);
  }
  const baseColor = ['interpolate', ['linear'], ['get', 'h'], 0, COLORS.building, 60, '#1b3d4a', 200, '#24505e', 400, '#2d6070'];
  const compareBuildings = a => {
    map.setPaintProperty('buildings-3d', 'fill-extrusion-color', a?.heightFt
      ? ['case', ['>', ['get', 'h'], a.heightFt], '#8fb9c2', ['interpolate', ['linear'], ['get', 'h'], 0, '#0f2731', 200, '#183a46']]
      : baseColor);
  };

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
    el.addEventListener('click', ev => { ev.stopPropagation(); cb.pick(a.id); });
    el.addEventListener('mouseenter', () => cb.hover(a.id, true));
    el.addEventListener('mouseleave', () => cb.hover(a.id, false));
  }

  // Intro: fly in, then grow the approved towers from the ground
  const pad = () => phone() ? { top: 70, bottom: innerHeight * .58 + 10, left: 10, right: 10 } : { top: 80, bottom: 40, left: document.querySelector('.panel').offsetWidth + 60, right: 40 };
  const bounds = apps.filter(a => a.center).reduce((b, a) => b.extend(a.center), new maplibregl.LngLatBounds(apps.find(a => a.center).center, apps.find(a => a.center).center));
  // Desktop: a tilted view of the whole beach beside the panel. Phones: flat, fit into the strip above the sheet.
  const phonePad = () => ({ top: 130, bottom: Math.round(innerHeight * .58) + 64, left: 36, right: 64 });
  const home = () => phone()
    ? { center: bounds.getCenter(), zoom: 10.45, padding: phonePad(), bearing: 0, pitch: 0 }
    : { center: [-80.1335, 25.8135], zoom: 12.55, padding: { top: 60, bottom: 20, left: document.querySelector('.panel').offsetWidth + 40, right: 20 }, bearing: -20, pitch: 52 };

  const grow = (to = 1, ms = 1800) => {
    if (reduced) return map.setPaintProperty('ll-tower', 'fill-extrusion-height', ['*', ['get', 'h'], to]);
    const t0 = performance.now();
    (function step(now) {
      const k = ease(Math.min(1, (now - t0) / ms)) * to;
      map.setPaintProperty('ll-tower', 'fill-extrusion-height', ['*', ['get', 'h'], k]);
      if (k < to) requestAnimationFrame(step);
    })(t0);
  };

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
      tip.setLngLat(e.lngLat).setHTML(cb.tip(a)).addTo(map);
      cb.hover(a.id, true);
    });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; tip.remove(); cb.hover(null, false); });
    map.on('click', layer, e => cb.pick(e.features[0].properties.id));
  }

  return {
    intro() { const intro = home(); if (reduced) map.jumpTo(intro); else map.flyTo({ ...intro, duration: 3200, curve: 1.3, essential: true }); setTimeout(() => grow(), reduced ? 0 : 1500); },
    hover(id) { markers.forEach(({ el }, key) => el.classList.toggle('is-hover', key === id)); },
    select(a, { fly, detailWidth }) {
      fc.features.forEach(f => map.setFeatureState({ source: 'll', id: f.id }, { active: f.properties.id === a.id }));
      markers.forEach(({ el }, key) => el.classList.toggle('is-active', key === a.id));
      showRings(a); compareBuildings(a);
      if (fly && a.center) {
        const padding = phone() ? { top: 60, bottom: innerHeight * .72, left: 20, right: 20 } : { top: 80, bottom: 60, left: document.querySelector('.panel').offsetWidth + 40, right: detailWidth + 60 };
        const cam = { center: a.center, zoom: a.stories && a.stories > 14 ? 16.6 : 17.1, pitch: 62, bearing: map.getBearing() - 18, padding };
        reduced ? map.jumpTo(cam) : map.flyTo({ ...cam, duration: 2200, curve: 1.6, essential: true });
      }
    },
    clear() {
      fc.features.forEach(f => map.setFeatureState({ source: 'll', id: f.id }, { active: false }));
      markers.forEach(({ el }) => el.classList.remove('is-active'));
      fadePaint('rings', 'line-opacity', 0); fadePaint('ring-labels', 'text-opacity', 0); compareBuildings(null);
      const cam = home(); reduced ? map.jumpTo(cam) : map.flyTo({ ...cam, duration: 2000, curve: 1.4 });
    },
    filter(f) {
      markers.forEach(({ el }) => el.classList.toggle('is-dim', f !== 'all' && !el.classList.contains(f)));
      const filter = f === 'all' ? null : ['==', ['get', 'stage'], f];
      for (const id of ['ll-glow', 'll-plate', 'll-line']) map.setFilter(id, filter);
      map.setFilter('ll-tower', f === 'review' ? ['==', 1, 0] : ['==', ['get', 'stage'], 'approved']);
    }
  };
}

async function main() {
  const data = await fetch('../data/live-local.json?v=' + Date.now().toString().slice(0, -5)).then(r => r.json());
  const apps = data.applications;
  const byId = new Map(apps.map(a => [a.id, a]));
  const approved = apps.filter(a => a.stage === 'approved');

  // Numbers and list
  const set = (k, v) => document.querySelectorAll(`[data-count="${k}"]`).forEach(el => (el.textContent = v));
  set('total', apps.length); set('approved', approved.length); set('review', apps.length - approved.length);
  set('tallest', Math.max(...approved.map(a => a.stories || 0)));
  const updated = () => (document.querySelector('[data-updated]').textContent = L(`Updated ${date(data.generatedAt.slice(0, 10))}.`, `Actualizado: ${date(data.generatedAt.slice(0, 10))}.`));
  updated();
  const order = [...apps].sort((a, b) => (a.stage === b.stage ? (b.stories || 0) - (a.stories || 0) || (b.filed || '').localeCompare(a.filed || '') : a.stage === 'approved' ? -1 : 1));
  listEl.innerHTML = order.map(card).join('');
  listEl.querySelectorAll('.card').forEach((el, i) => (el.style.transitionDelay = `${0.45 + i * 0.045}s`));

  let active = null;
  const cb = { pick: id => select(id), hover: (id, on) => hover(id, on), tip: a => `<div class="tip">${esc(title(a.location))}<small>${a.stories ? a.stories + L(' stories · ', ' pisos · ') : ''}${a.stage === 'approved' ? L('Approved', 'Aprobado') : L('Under review', 'En revisión')}</small></div>`, L, title, esc, reduced, phone };

  // Engine: Google photorealistic 3D (Cesium) when a key is set and it loads; otherwise the stylized map.
  const key = document.querySelector('meta[name="google-maps-key"]')?.content;
  const want = new URLSearchParams(location.search).get('engine');
  let engine = null;
  if (key && want !== 'flat') {
    try { engine = await (await import('./engine-photo.js?v=2')).create({ data, apps, byId, cb, key }); document.documentElement.dataset.engine = 'photo'; }
    catch (error) { console.warn('Photorealistic 3D unavailable, using the stylized map.', error); document.getElementById('map').innerHTML = ''; }
  }
  if (!engine) { engine = await flatEngine({ data, apps, byId, cb }); document.documentElement.dataset.engine = 'flat'; }

  app.dataset.state = 'ready';
  engine.intro();

  function hover(id, on) {
    listEl.querySelectorAll('.card.is-hover').forEach(el => el.classList.remove('is-hover'));
    if (on && id) listEl.querySelector(`.card[data-id="${CSS.escape(id)}"]`)?.classList.add('is-hover');
    engine?.hover(on ? id : null);
  }
  function select(id, { fly = true } = {}) {
    const a = byId.get(id); if (!a) return;
    active = id;
    listEl.querySelectorAll('.card').forEach(el => el.classList.toggle('is-active', el.dataset.id === id));
    detailBody.innerHTML = detailHtml(a);
    detail.hidden = false; requestAnimationFrame(() => detail.classList.add('is-open'));
    listEl.querySelector(`.card[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    history.replaceState(null, '', '#' + id);
    engine.select(a, { fly, detailWidth: detail.offsetWidth });
  }
  function close() {
    active = null;
    detail.classList.remove('is-open');
    setTimeout(() => { if (!active) detail.hidden = true; }, 450);
    document.querySelectorAll('.card.is-active').forEach(el => el.classList.remove('is-active'));
    history.replaceState(null, '', location.pathname + location.search);
    engine.clear();
  }
  detail.querySelector('[data-close]').addEventListener('click', close);
  addEventListener('keydown', e => { if (e.key === 'Escape' && active) close(); });

  listEl.addEventListener('click', e => { const c = e.target.closest('.card'); if (c) select(c.dataset.id); });
  listEl.addEventListener('mouseover', e => { const c = e.target.closest('.card'); if (c) hover(c.dataset.id, true); });
  listEl.addEventListener('mouseleave', () => hover(null, false));

  document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
    const f = chip.dataset.filter;
    document.querySelectorAll('.chip').forEach(c => { const on = c === chip; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', on); });
    listEl.querySelectorAll('.card').forEach(el => (el.parentElement.hidden = f !== 'all' && el.dataset.stage !== f));
    engine.filter(f);
  }));

  document.addEventListener('language:change', () => {
    listEl.innerHTML = order.map(card).join('');
    if (active) { listEl.querySelector(`.card[data-id="${CSS.escape(active)}"]`)?.classList.add('is-active'); detailBody.innerHTML = detailHtml(byId.get(active)); }
    updated();
    engine.relabel?.();
  });

  const start = decodeURIComponent(location.hash.slice(1));
  if (byId.has(start)) setTimeout(() => select(start), reduced ? 0 : 3300);
}

main().catch(error => {
  console.error(error);
  app.dataset.state = 'error';
  listEl.innerHTML = '<li class="fine">The map could not load. The City\'s own lists are linked under Sources.</li>';
});
