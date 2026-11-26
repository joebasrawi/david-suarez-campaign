import { locale } from '../language.js';

const app = document.querySelector('.app');
const listEl = document.getElementById('list');
const detail = document.querySelector('.detail');
const detailBody = detail.querySelector('.detail-body');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = () => matchMedia('(max-width: 52rem)').matches;
const METERS_PER_STORY = 3.4;
const COLORS = { approved: '#ff6a45', review: '#78d6c8', dev: '#edbd79', devReview: '#f3dcae', building: '#132f3a', buildingTop: '#1b3e4b' };

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

// Flood risk: FEMA zone at the site and the nearest City-mapped tidal flooding spot.
const FLOOD = { VE: '#3d7bff', AE: '#43a6e8', X: '#8fd0ef', tidal: '#6fe3ff' };
const inPoly = (pt, geom) => {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  let c = false;
  for (const rings of polys) for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    if ((r[i][1] > pt[1]) !== (r[j][1] > pt[1]) && pt[0] < ((r[j][0] - r[i][0]) * (pt[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  return c;
};
const metersBetween = (a, b) => { const k = Math.PI / 180, R = 6371000, dLat = (b[1] - a[1]) * k, dLng = (b[0] - a[0]) * k; return 2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * k) * Math.cos(b[1] * k) * Math.sin(dLng / 2) ** 2)); };
function floodFor(a, flood) {
  if (!a.center || !flood) return null;
  const rank = { VE: 3, AE: 2, X: 1 };
  const zone = flood.zones.features.filter(f => inPoly(a.center, f.geometry)).sort((x, y) => (rank[y.properties.zone] || 0) - (rank[x.properties.zone] || 0))[0]?.properties || null;
  const ringPt = g => (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]);
  const spots = flood.tidal.features.map(f => { const r = ringPt(f.geometry); const inside = inPoly(a.center, f.geometry); const d = inside ? 0 : Math.min(...r.map(p => metersBetween(a.center, p))); return { ...f.properties, d }; }).filter(x => x.d <= 402).sort((x, y) => x.d - y.d);
  return { zone, spot: spots[0] || null, spots: spots.length };
}
function floodFacts(a) {
  const f = a.flood; if (!f) return [];
  const z = f.zone;
  const zoneText = !z ? L('Outside the mapped FEMA flood zones', 'Fuera de las zonas de inundación de FEMA')
    : z.zone === 'VE' ? L(`VE, coastal high hazard with waves${z.bfe ? ` · base flood elevation ${z.bfe} ft` : ''}`, `VE, alto riesgo costero con oleaje${z.bfe ? ` · elevación base de inundación ${z.bfe} pies` : ''}`)
    : z.zone === 'AE' ? L(`AE, 1% annual flood chance${z.bfe ? ` · base flood elevation ${z.bfe} ft` : ''}`, `AE, 1% de probabilidad anual de inundación${z.bfe ? ` · elevación base de inundación ${z.bfe} pies` : ''}`)
    : L('X, moderate to low flood risk', 'X, riesgo de inundación moderado a bajo');
  const freq = { Frequently: L('frequently', 'con frecuencia'), Occasionally: L('occasionally', 'ocasionalmente'), Rarely: L('rarely', 'rara vez') };
  const spot = f.spot ? (f.spot.d === 0 ? L(`On a City-mapped tidal flooding spot (floods ${freq[f.spot.freq] || f.spot.freq})`, `En un punto de inundación por marea de la Ciudad (se inunda ${freq[f.spot.freq] || f.spot.freq})`) : L(`City-mapped tidal flooding spot ${Math.round(f.spot.d * 3.281)} ft away (floods ${freq[f.spot.freq] || f.spot.freq})`, `Punto de inundación por marea de la Ciudad a ${Math.round(f.spot.d * 3.281)} pies (se inunda ${freq[f.spot.freq] || f.spot.freq})`)) : null;
  return [[L('FEMA flood zone', 'Zona de inundación FEMA'), zoneText, true], spot ? [L('Tidal flooding', 'Inundación por marea'), spot, true] : null].filter(Boolean);
}

// Filters: all | ll (Live Local) | dev (other development) | review (anything under review)
// A filter state is { layers: ['ll', 'dev', 'city'], review: bool }.
const matches = (a, f) => f.layers.includes(a.layer) && (!f.review || !['ll', 'dev'].includes(a.layer) || a.stage !== 'approved');
const filterExpr = f => ['all', ['in', ['get', 'layer'], ['literal', f.layers]], f.review ? ['!=', ['get', 'stage'], 'approved'] : true];

// City capital projects (Public Works and others), from the City's project map.
const PHASE = { plan: ['Planning', 'Planificación'], design: ['Design', 'Diseño'], build: ['Construction', 'Construcción'] };
const phaseOf = p => (/constr/i.test(p || '') ? 'build' : /design/i.test(p || '') ? 'design' : 'plan');
function cityCard(a) {
  return `<li><button type="button" class="card" data-id="${esc(a.id)}" data-stage="${a.stage}" data-layer="city"><span class="bar" aria-hidden="true"></span><span class="addr">${esc(a.location)}</span><span class="ht na phase-${a.stage}">${esc(L(...PHASE[a.stage]))}</span><span class="meta">${esc([a.department, a.neighborhood].filter(Boolean).join(' · '))}</span></button></li>`;
}
function cityDetailHtml(a) {
  const facts = [
    [L('What', 'Qué'), a.description, true],
    [L('Where', 'Dónde'), a.limits, true],
    [L('Phase', 'Fase'), L(...PHASE[a.stage])],
    [L('Status', 'Estado'), a.status],
    [L('Type', 'Tipo'), a.type],
    [L('Department', 'Departamento'), a.department],
    [L('Neighborhood', 'Vecindario'), a.neighborhood],
    a.startDate ? [L('Start', 'Inicio'), date(a.startDate)] : null,
    a.endDate ? [L('Expected end', 'Fin previsto'), date(a.endDate)] : null,
    ...floodFacts(a)
  ].filter(f => f && f[1] && f[1] !== 'null');
  return `
    <span class="status city phase-${a.stage}">${esc(L('City project', 'Proyecto de la Ciudad'))} · ${esc(L(...PHASE[a.stage]))}</span>
    <h2 id="detail-title">${esc(a.location)}</h2>
    <p class="case">${esc(a.projectNumber ? L(`Project ${a.projectNumber}`, `Proyecto ${a.projectNumber}`) : '')}</p>
    <dl class="facts">${facts.map(([k, v, wide]) => `<div class="${wide ? 'wide' : ''}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <div class="links">${a.link ? `<a href="${esc(a.link)}" target="_blank" rel="noopener">${L('City project page', 'Página del proyecto')}</a>` : ''}<a class="${a.link ? 'ghost' : ''}" href="https://www.miamibeachfl.gov/city-hall/capital-improvement-projects/" target="_blank" rel="noopener">${L('City capital projects', 'Proyectos de capital de la Ciudad')}</a></div>
    <p class="fine">${L('Source: City of Miami Beach capital project map.', 'Fuente: mapa de proyectos de capital de la Ciudad de Miami Beach.')}</p>`;
}
const KIND = { new: ['New building', 'Edificio nuevo'], major: ['Major renovation', 'Gran renovación'], rezoning: ['Rezoning', 'Cambio de zonificación'] };
function devCard(a) {
  const ht = a.stories ? `<span class="ht">${a.stories}<small>${L('stories', 'pisos')}</small></span>` : `<span class="ht na">${esc(L(...KIND[a.kind]))}</span>`;
  const when = a.stage === 'approved' ? L('Approved', 'Aprobado') : a.stage === 'denied' ? L('Denied', 'Denegado') : L(`Filed ${date(a.filed)}`, `Presentado el ${date(a.filed)}`);
  return `<li><button type="button" class="card" data-id="${esc(a.id)}" data-stage="${a.stage}" data-layer="dev"><span class="bar" aria-hidden="true"></span><span class="addr">${esc(a.location)}</span>${ht}<span class="meta">${esc(when)} · ${esc(a.boards.map(b => b.replace(' Board', '')).join(' + '))}</span></button></li>`;
}
// Getting around (lane closures), parks, short-term rentals
const TODAY = new Date().toISOString().slice(0, 10);
function simpleCard(a, right, meta) {
  return `<li><button type="button" class="card" data-id="${esc(a.id)}" data-stage="${esc(a.stage)}" data-layer="${a.layer}"><span class="bar" aria-hidden="true"></span><span class="addr">${esc(a.location)}</span><span class="ht na">${right}</span><span class="meta">${esc(meta)}</span></button></li>`;
}
function roadCard(a) { return simpleCard(a, esc(a.stage === 'open' ? L('Open permit', 'Permiso vigente') : L('Past end date', 'Vencido')), [a.kind, a.expires ? L(`ends ${date(a.expires)}`, `termina ${date(a.expires)}`) : ''].filter(Boolean).join(' · ')); }
function parkCard(a) { return simpleCard(a, a.acres ? `${a.acres}<small>${L('acres', 'acres')}</small>` : '', [a.type, a.address].filter(Boolean).join(' · ')); }
function strCard(a) { return simpleCard(a, `${a.licensed}<small>${L('licensed', 'licencias')}</small>`, a.pending ? L(`${a.pending} more pending`, `${a.pending} más pendientes`) : L('Certificates of Use', 'Certificados de Uso')); }
const factsHtml = facts => `<dl class="facts">${facts.filter(f => f && f[1]).map(([k, v, wide]) => `<div class="${wide ? 'wide' : ''}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
function roadDetailHtml(a) {
  return `<span class="status road">${esc(L('Right-of-way permit', 'Permiso de vía pública'))} · ${esc(a.stage === 'open' ? L('Open', 'Vigente') : L('Past end date', 'Vencido'))}</span>
    <h2 id="detail-title">${esc(a.location)}</h2><p class="case">${esc(a.permit)}</p>
    ${factsHtml([[L('Work', 'Trabajo'), a.kind, true], [L('What the permit says', 'Lo que dice el permiso'), a.desc, true], [L('Issued', 'Emitido'), date(a.issued)], [L('Permit end date', 'Fin del permiso'), date(a.expires)]])}
    <p class="fine">${L("Source: City of Miami Beach lane closure map. The City lists this permit as active; work may already be finished if the end date has passed.", 'Fuente: mapa de cierres de carriles de la Ciudad de Miami Beach. La Ciudad lista este permiso como activo; el trabajo puede haber terminado si la fecha de fin ya pasó.')}</p>`;
}
function parkDetailHtml(a) {
  return `<span class="status park">${esc(L('Park', 'Parque'))}</span><h2 id="detail-title">${esc(a.location)}</h2><p class="case">${esc(a.type || '')}</p>
    ${factsHtml([[L('Address', 'Dirección'), a.address, true], a.acres ? [L('Size', 'Tamaño'), `${a.acres} ${L('acres', 'acres')}`] : null, a.phone ? [L('Phone', 'Teléfono'), a.phone] : null, ...floodFacts(a)])}
    <div class="links"><a href="https://www.miamibeachfl.gov/city-hall/parks-and-recreation/" target="_blank" rel="noopener">${L('Parks & Recreation', 'Parques y Recreación')}</a><a class="ghost" href="https://www.miamibeachfl.gov/city-hall/fire/ocean-rescue/" target="_blank" rel="noopener">${L("Today's beach conditions", 'Condiciones de la playa hoy')}</a></div>
    <p class="fine">${L('Source: Miami-Dade County park boundaries.', 'Fuente: límites de parques del Condado Miami-Dade.')}</p>`;
}
function strDetailHtml(a) {
  return `<span class="status str">${esc(L('Short-term rentals', 'Alquileres a corto plazo'))}</span><h2 id="detail-title">${esc(a.location)}</h2><p class="case">${esc(L('Counted by building', 'Contado por edificio'))}</p>
    <p class="hero-num str"><b>${a.licensed}</b><span>${L(`units with a short-term rental Certificate of Use${a.pending ? ` · ${a.pending} more pending` : ''}`, `unidades con Certificado de Uso para alquiler a corto plazo${a.pending ? ` · ${a.pending} más pendientes` : ''}`)}</span></p>
    ${factsHtml([[L('Latest application', 'Última solicitud'), date(a.latest)], ...floodFacts(a)])}
    <div class="links"><a href="https://www.miamibeachfl.gov/business/vacation-short-term-rentals/" target="_blank" rel="noopener">${L("City's short-term rental rules", 'Reglas de alquiler a corto plazo de la Ciudad')}</a></div>
    <p class="fine">${L("Source: City of Miami Beach Civic Access, certificates filed since mid-2025. A certificate means the City approved the unit for short-term rental, not that it is currently rented. Units and owners are not shown.", 'Fuente: Civic Access de la Ciudad de Miami Beach, certificados presentados desde mediados de 2025. Un certificado significa que la Ciudad aprobó la unidad para alquiler a corto plazo, no que esté alquilada ahora. No se muestran unidades ni propietarios.')}</p>`;
}

function card(a) {
  if (a.layer === 'road') return roadCard(a);
  if (a.layer === 'park') return parkCard(a);
  if (a.layer === 'str') return strCard(a);
  if (a.layer === 'city') return cityCard(a);
  if (a.layer === 'dev') return devCard(a);
  const ht = a.stories ? `<span class="ht">${a.stories}<small>stories</small></span>` : `<span class="ht na">In review</span>`;
  const when = a.stage === 'approved' ? L('Approved', 'Aprobado') : L(`Filed ${date(a.filed)}`, `Presentado el ${date(a.filed)}`);
  return `<li><button type="button" class="card" data-id="${esc(a.id)}" data-stage="${a.stage}" data-layer="ll"><span class="bar" aria-hidden="true"></span><span class="addr">${esc(title(a.location))}</span>${ht}<span class="meta">${esc(when)} · ${esc(a.number)}</span></button></li>`;
}

function owners(a) {
  // Company names only: drop 'C/O <person>' care-of lines and condo placeholder rows.
  return [...new Set(a.sites.map(s => (s.owner || '').replace(/\s+C\/O\b.*$/i, '').trim()).filter(o => o && !/REFERENCE ONLY/i.test(o)))];
}

function devDetailHtml(a) {
  const status = a.stage === 'approved' ? L('Approved', 'Aprobado') : a.stage === 'denied' ? L('Denied', 'Denegado') : a.status === 'On Hold' ? L('On hold', 'En espera') : L('Under review', 'En revisión');
  const hero = a.stories
    ? `<p class="hero-num dev"><b>${a.stories}</b><span>${L(`stories${a.stage === 'approved' ? ' approved' : ' proposed'} · about ${a.heightFt} ft`, `pisos ${a.stage === 'approved' ? 'aprobados' : 'propuestos'} · unos ${a.heightFt} pies`)}</span></p>` : '';
  const q = a.compare?.quarterMile;
  let compare = '';
  if (a.heightFt && q?.tallest) {
    const rows = [
      { k: L('This project', 'Este proyecto'), ft: a.heightFt, note: L(`about ${a.heightFt} ft · ${a.stories} stories`, `unos ${a.heightFt} pies · ${a.stories} pisos`), cls: 'me dev' },
      { k: L('Tallest within ¼ mile', 'Más alto a ¼ de milla'), ft: q.tallest.ft, note: `${q.tallest.ft} ft${q.tallest.address ? ' · ' + title(q.tallest.address.toLowerCase().replace(/\b\w/g, x => x.toUpperCase())) : ''}`, cls: 'tall' },
      { k: L('Typical building within ¼ mile', 'Edificio típico a ¼ de milla'), ft: q.typicalFt, note: `${q.typicalFt} ft`, cls: 'typ' }
    ];
    const max = Math.max(...rows.map(r => r.ft));
    compare = `<section class="compare"><h3>${L('How it compares', 'Cómo se compara')}</h3><ul>${rows.map((r, i) => `<li class="${r.cls}"><span class="k">${esc(r.k)}</span><span class="track"><span class="fill" style="--w:${Math.max(2, (r.ft / max) * 100).toFixed(1)}%;--d:${0.25 + i * 0.12}s"></span></span><span class="v">${esc(r.note)}</span></li>`).join('')}</ul><p class="fine">${L('Existing heights: Miami-Dade County LiDAR. Project height from the case description, estimated at 10.5 ft per story.', 'Alturas existentes: LiDAR del Condado Miami-Dade. Altura del proyecto según la descripción del caso, estimada a 10.5 pies por piso.')}</p></section>`;
  }
  const facts = [
    [L('What was filed', 'Lo que se presentó'), a.summary, true],
    [L('First filed', 'Primera presentación'), date(a.filed)],
    [L('Owner of record', 'Propietario registrado'), a.owner, true],
    ...floodFacts(a),
    a.lotSize ? [L('Lot size', 'Tamaño del lote'), `${num(a.lotSize)} sq ft`] : null,
    a.existing?.yearBuilt ? [L('Built there now', 'Construido allí hoy'), a.existing.floors ? L(`${a.existing.floors}-story building, ${a.existing.yearBuilt}`, `Edificio de ${a.existing.floors} pisos, ${a.existing.yearBuilt}`) : String(a.existing.yearBuilt)] : null
  ].filter(f => f && f[1]);
  const cases = a.cases.map(c => `<li><a href="${esc(c.link)}" target="_blank" rel="noopener"><b>${esc(c.number)}</b><span>${esc(c.board.replace(' Board', ''))} · ${esc(c.type)} · ${esc(c.status)} · ${esc(date(c.filed))}</span></a></li>`).join('');
  return `
    <span class="status dev ${a.stage}">${esc(status)} · ${esc(L(...KIND[a.kind]))}</span>
    <h2 id="detail-title">${esc(a.location)}</h2>
    <p class="case">${esc(a.boards.join(' · '))}</p>
    ${hero}
    ${compare}
    <dl class="facts">${facts.map(([k, v, wide]) => `<div class="${wide ? 'wide' : ''}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <h3 class="cases-title">${L('City case files', 'Expedientes de la Ciudad')}</h3>
    <ul class="cases">${cases}</ul>
    <p class="fine">${L('Cases and descriptions: City of Miami Beach Civic Access. Owner: City parcel map.', 'Casos y descripciones: Civic Access de la Ciudad de Miami Beach. Propietario: mapa de parcelas de la Ciudad.')}</p>`;
}

function detailHtml(a) {
  if (a.layer === 'road') return roadDetailHtml(a);
  if (a.layer === 'park') return parkDetailHtml(a);
  if (a.layer === 'str') return strDetailHtml(a);
  if (a.layer === 'city') return cityDetailHtml(a);
  if (a.layer === 'dev') return devDetailHtml(a);
  const sale = a.sites.filter(s => s.lastSale?.price).sort((x, y) => (y.lastSale.date || '').localeCompare(x.lastSale.date || ''))[0];
  const lot = a.sites.reduce((n, s) => n + (Number(s.lotSize) || 0), 0);
  const built = a.sites.map(s => s.existing).filter(e => e?.yearBuilt);
  const own = owners(a);
  const facts = [
    ['Filed', date(a.filed)],
    [a.stage === 'approved' ? 'Applicant' : 'Owner of record', (a.applicant || '').replace(/\s+C\/O\b.*$/i, '') || own[0] || null, true],
    a.applicant && own.length && norm(own[0]) !== norm(a.applicant.replace(/\s+C\/O\b.*$/i, '')) ? ['Owner of record', own.join(' · '), true] : null,
    sale ? ['Last sale', `${money(sale.lastSale.price)} · ${date(sale.lastSale.date)}`] : null,
    ...floodFacts(a),
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
  if (cb.flood) {
    map.addSource('flood-zones', { type: 'geojson', data: cb.flood.zones });
    map.addSource('flood-tidal', { type: 'geojson', data: cb.flood.tidal });
    const before = 'buildings-3d';
    map.addLayer({ id: 'flood-zones', type: 'fill', source: 'flood-zones', layout: { visibility: 'none' }, paint: { 'fill-color': ['match', ['get', 'zone'], 'VE', FLOOD.VE, 'AE', FLOOD.AE, FLOOD.X], 'fill-opacity': ['match', ['get', 'zone'], 'VE', .42, 'AE', .3, .12] } }, before);
    map.addLayer({ id: 'flood-tidal', type: 'fill', source: 'flood-tidal', layout: { visibility: 'none' }, paint: { 'fill-color': FLOOD.tidal, 'fill-opacity': ['match', ['get', 'freq'], 'Frequently', .75, 'Occasionally', .5, .3] } }, before);
    map.addLayer({ id: 'flood-tidal-line', type: 'line', source: 'flood-tidal', layout: { visibility: 'none' }, paint: { 'line-color': '#d4f7ff', 'line-width': 1.2 } }, before);
  }
  // Line and area overlays for the extra views
  const OV = cb.overlays || {};
  const addOv = (id, src, layers) => { if (!src) return; map.addSource(id, { type: 'geojson', data: src }); for (const l of layers) map.addLayer({ ...l, source: id, layout: { ...(l.layout || {}), visibility: 'none' } }, 'buildings-3d'); };
  addOv('ov-parks', OV.parks, [{ id: 'ov-parks', type: 'fill', paint: { 'fill-color': '#5fd38a', 'fill-opacity': .32 } }, { id: 'ov-parks-line', type: 'line', paint: { 'line-color': '#9ff0bb', 'line-width': 1.2 } }]);
  addOv('ov-beach', OV.beaches, [{ id: 'ov-beach', type: 'fill', paint: { 'fill-color': '#f4dca0', 'fill-opacity': .38 } }]);
  addOv('ov-bike', OV.bikeways, [{ id: 'ov-bike', type: 'line', paint: { 'line-color': '#9be564', 'line-width': ['case', ['get', 'protected'], 3, 2], 'line-opacity': .85 } }]);
  addOv('ov-trolley', OV.trolleyRoutes, [{ id: 'ov-trolley', type: 'line', paint: { 'line-color': '#ffd166', 'line-width': 3.2, 'line-opacity': .9 } }]);
  addOv('ov-closures', OV.closures, [{ id: 'ov-closures', type: 'line', paint: { 'line-color': ['case', ['>=', ['get', 'expires'], TODAY], '#ff8a3d', '#a3654a'], 'line-width': 4, 'line-opacity': .9 } }]);
  addOv('ov-str', OV.str, [{ id: 'ov-str', type: 'fill', paint: { 'fill-color': '#c18cff', 'fill-opacity': ['interpolate', ['linear'], ['get', 'licensed'], 0, .25, 30, .7] } }]);
  const OVMAP = { parks: ['ov-parks', 'ov-parks-line'], beaches: ['ov-beach'], bikeways: ['ov-bike'], trolley: ['ov-trolley'], closures: ['ov-closures'], str: ['ov-str'] };

  const fc = featuresFor(data);
  map.addSource('ll', { type: 'geojson', data: fc });
  map.addLayer({ id: 'll-glow', type: 'line', source: 'll', paint: { 'line-color': ['case', ['==', ['get', 'layer'], 'dev'], ['match', ['get', 'stage'], 'approved', COLORS.dev, COLORS.devReview], ['match', ['get', 'stage'], 'approved', COLORS.approved, COLORS.review]], 'line-width': 10, 'line-blur': 8, 'line-opacity': .55 } });
  map.addLayer({ id: 'll-plate', type: 'fill', source: 'll', paint: { 'fill-color': ['case', ['==', ['get', 'layer'], 'dev'], ['match', ['get', 'stage'], 'approved', COLORS.dev, COLORS.devReview], ['match', ['get', 'stage'], 'approved', COLORS.approved, COLORS.review]], 'fill-opacity': ['match', ['get', 'stage'], 'approved', .25, .32] } });
  map.addLayer({ id: 'll-tower', type: 'fill-extrusion', source: 'll', filter: ['all', ['==', ['get', 'stage'], 'approved'], ['>', ['get', 'h'], 0]], paint: {
    'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'active'], false], ['case', ['==', ['get', 'layer'], 'dev'], '#f6d08f', '#ff8a6b'], ['case', ['==', ['get', 'layer'], 'dev'], COLORS.dev, COLORS.approved]],
    'fill-extrusion-height': 0, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': .92, 'fill-extrusion-vertical-gradient': true } });
  map.addLayer({ id: 'll-line', type: 'line', source: 'll', paint: { 'line-color': ['case', ['==', ['get', 'layer'], 'dev'], '#f6d9a6', ['match', ['get', 'stage'], 'approved', '#ffb39f', '#c9f3ec']], 'line-width': ['case', ['boolean', ['feature-state', 'active'], false], 3, 1.6] } });

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
    el.type = 'button'; el.className = `pin ${a.stage} ${a.layer}`; el.dataset.layer = a.layer; el.dataset.stage = a.stage; el.dataset.id = a.id; el.setAttribute('aria-label', `${title(a.location)}, ${a.stage === 'approved' ? 'approved' : 'under review'}`);
    el.innerHTML = a.layer === 'str' ? `<b>${a.licensed}</b>` : ['city', 'road', 'park'].includes(a.layer) ? '<i></i>' : a.layer === 'dev' ? (a.stories >= 5 ? `<b>${a.stories}</b>` : '<i></i>') : a.stories ? `<b>${a.stories}</b>` : '<i></i>';
    const wrap = document.createElement('div'); wrap.className = 'pin-wrap'; wrap.appendChild(el);
    const marker = new maplibregl.Marker({ element: wrap, anchor: 'bottom', offset: [0, -6] }).setLngLat(a.center).addTo(map);
    markers.set(a.id, { marker, el });
    el.addEventListener('click', ev => { ev.stopPropagation(); cb.pick(a.id); });
    wrap.addEventListener('click', ev => { ev.stopPropagation(); cb.pick(a.id); });
    el.addEventListener('mouseenter', () => cb.hover(a.id, true));
    el.addEventListener('mouseleave', () => cb.hover(a.id, false));
  }

  // Intro: fly in, then grow the approved towers from the ground
  const bounds = apps.filter(a => a.center).reduce((b, a) => b.extend(a.center), new maplibregl.LngLatBounds(apps.find(a => a.center).center, apps.find(a => a.center).center));
  // Desktop: a tilted view of the whole beach beside the panel. Phones: flat, fit into the strip above the sheet.
  const phonePad = () => ({ top: 84, bottom: Math.round(cb.cover()) + 40, left: 28, right: 56 });
  const home = () => phone()
    ? { ...(map.cameraForBounds(bounds, { padding: phonePad() }) || { center: bounds.getCenter(), zoom: 10.45 }), padding: { top: 0, bottom: 0, left: 0, right: 0 }, bearing: 0, pitch: 0 }
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
      map.setPaintProperty('ll-glow', 'line-opacity', ['case', ['==', ['get', 'layer'], 'dev'], .35, ['match', ['get', 'stage'], 'approved', .5, .25 + p * .55]]);
      map.setPaintProperty('ll-glow', 'line-width', ['case', ['==', ['get', 'layer'], 'dev'], 6, ['match', ['get', 'stage'], 'approved', 10, 6 + p * 10]]);
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
        const padding = phone() ? { top: 70, bottom: Math.round(cb.cover()) + 10, left: 20, right: 20 } : { top: 80, bottom: 60, left: document.querySelector('.panel').offsetWidth + 40, right: detailWidth + 60 };
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
    overlays(on) { for (const [k, ids] of Object.entries(OVMAP)) for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on.includes(k) ? 'visible' : 'none'); },
    // Keyboard flying: forward/right in screen pixels per second, turn in degrees per second.
    move({ forward, right, turn, up }, dt, fast) {
      map.stop();
      const k = (fast ? 2.6 : 1) * dt;
      if (forward || right) map.panBy([right * 520 * k, -forward * 520 * k], { duration: 0 });
      if (turn) map.setBearing(map.getBearing() + turn * 70 * k);
      if (up) map.setZoom(map.getZoom() - up * 1.1 * k);
    },
    flood(on) { for (const id of ['flood-zones', 'flood-tidal', 'flood-tidal-line']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); },
    filter(f) {
      markers.forEach(({ el }) => { const hide = !matches({ layer: el.dataset.layer, stage: el.dataset.stage }, f); el.classList.toggle('is-dim', hide); el.parentElement.style.display = hide ? 'none' : ''; });
      const expr = filterExpr(f);
      for (const id of ['ll-glow', 'll-plate', 'll-line']) map.setFilter(id, expr);
      map.setFilter('ll-tower', ['all', ['==', ['get', 'stage'], 'approved'], ['>', ['get', 'h'], 0], expr]);
    }
  };
}

async function main() {
  const v = Date.now().toString().slice(0, -5);
  const get = (f, fallback) => fetch(`../data/${f}?v=${v}`).then(r => r.json()).catch(() => fallback);
  const [data, dev, flood, cityRaw] = await Promise.all([
    get('live-local.json', { applications: [], parcels: { features: [] }, generatedAt: new Date().toISOString() }),
    get('development.json', { projects: [], parcels: { features: [] } }),
    get('flood.json', null),
    get('city-projects.json', { items: [] })
  ]);
  const [around, strData] = await Promise.all([get('around.json', null), get('str.json', null)]);
  const ll = data.applications.map(a => ({ ...a, layer: 'll' }));
  const devApps = dev.projects.map(p => ({ ...p, layer: 'dev', number: p.id }));
  const seenCity = new Set();
  const city = cityRaw.items.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && !seenCity.has(p.projectNumber + p.title) && seenCity.add(p.projectNumber + p.title))
    .map(p => ({ ...p, layer: 'city', id: 'CIP-' + p.id, number: p.projectNumber, location: p.title, stage: phaseOf(p.phase), center: [p.lng, p.lat], sites: [] }));
  const mid = g => { const c = g.type === 'LineString' ? g.coordinates : g.type === 'MultiLineString' ? g.coordinates.flat() : g.type === 'Point' ? [g.coordinates] : (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]); return c[Math.floor(c.length / 2)]; };
  const seenPermit = new Set();
  const roads = (around?.closures.features || []).filter(f => !seenPermit.has(f.properties.permit) && seenPermit.add(f.properties.permit)).map((f, i) => ({ ...f.properties, layer: 'road', id: 'ROW-' + (f.properties.permit || i), number: f.properties.permit, location: f.properties.address || f.properties.permit, stage: (f.properties.expires || '') >= TODAY ? 'open' : 'past', center: mid(f.geometry), sites: [] }))
    .sort((a, b) => (a.stage === b.stage ? (b.expires || '').localeCompare(a.expires || '') : a.stage === 'open' ? -1 : 1));
  const parks = (around?.parks.features || []).map((f, i) => ({ ...f.properties, layer: 'park', id: 'PARK-' + i, location: f.properties.name, stage: 'park', sites: [] })).sort((a, b) => (b.acres || 0) - (a.acres || 0));
  const rentals = (strData?.buildings || []).map(b => ({ ...b, layer: 'str', location: b.address, stage: 'str', sites: [] }));
  const apps = [...ll, ...devApps, ...city, ...roads, ...parks, ...rentals];
  for (const a of apps) a.flood = floodFor(a, flood);
  data.parcels = { type: 'FeatureCollection', features: [
    ...data.parcels.features.map(f => ({ ...f, properties: { ...f.properties, layer: 'll' } })),
    ...dev.parcels.features.map(f => ({ ...f, properties: { ...f.properties, layer: 'dev', stories: f.properties.stage === 'approved' ? f.properties.stories : null } }))
  ] };
  const byId = new Map(apps.map(a => [a.id, a]));

  // Numbers used across views
  const llApproved = ll.filter(a => a.stage === 'approved');
  const devApproved = devApps.filter(a => a.stage === 'approved');
  const tallestLL = Math.max(0, ...llApproved.map(a => a.stories || 0));
  const tallestDev = Math.max(0, ...devApproved.map(a => a.stories || 0));
  const nearFrequent = apps.filter(a => a.layer !== 'city' && a.flood?.spot?.freq === 'Frequently').length;
  const tidal = flood?.tidal.features || [];
  const freqCount = q => tidal.filter(f => f.properties.freq === q).length;
  const byPhase = ph => city.filter(a => a.stage === ph).length;

  const stat = (k, n, unit = '') => `<div><dt>${esc(k)}</dt><dd>${n}${unit ? `<small> ${esc(unit)}</small>` : ''}</dd></div>`;
  const VIEWS = {
    overview: {
      layers: ['ll', 'dev', 'city'], flood: false,
      head: () => `<h1><span class="accent-mint">${L('Miami Beach,', 'Miami Beach,')}</span> ${L('mapped.', 'en un mapa.')}</h1>
        <p class="lead">${L("What developers are building, what the City is building, and where it floods. Every point comes from public City and County records. Pick a view, or click anything on the map.", 'Lo que construyen los desarrolladores, lo que construye la Ciudad y dónde se inunda. Cada punto viene de registros públicos de la Ciudad y el Condado. Elige una vista o haz clic en el mapa.')}</p>
        <dl class="stats">${stat(L('Development projects', 'Proyectos de desarrollo'), ll.length + devApps.length)}${stat(L('City projects', 'Proyectos de la Ciudad'), city.length)}${stat(L('Tidal flooding spots', 'Puntos de inundación'), tidal.length)}</dl>`
    },
    development: {
      layers: ['ll', 'dev'], flood: false,
      head: () => `<h1>${ll.length + devApps.length} ${L('development projects.', 'proyectos de desarrollo.')} <span class="accent-warm">${L('Since 2023.', 'Desde 2023.')}</span></h1>
        <p class="lead">${L("New buildings, major renovations and rezonings before the City's Design Review, Historic Preservation and Planning boards, plus every Live Local Act application. Approved projects with a known height rise in 3D.", 'Edificios nuevos, grandes renovaciones y cambios de zonificación ante las juntas de la Ciudad, más cada solicitud de la Ley Live Local. Los proyectos aprobados con altura conocida se elevan en 3D.')}</p>
        <dl class="stats">${stat(L('Approved', 'Aprobados'), llApproved.length + devApproved.length)}${stat(L('Under review', 'En revisión'), ll.length + devApps.length - llApproved.length - devApproved.length)}${stat(L('Tallest approved', 'Más alto aprobado'), Math.max(tallestLL, tallestDev), L('stories', 'pisos'))}</dl>`
    },
    livelocal: {
      layers: ['ll'], flood: false,
      head: () => `<h1>${ll.length} ${L('Live Local projects.', 'proyectos Live Local.')} <span class="accent">${L('No public hearing required.', 'Sin audiencia pública.')}</span></h1>
        <p class="lead">${L("Florida's Live Local Act lets developers build apartments on commercial land at the city's highest allowed density and up to the tallest height allowed within a mile, if at least 40% of the rental units are affordable. In Miami Beach, the Planning Director approves these plans administratively, without a public hearing or Commission vote.", 'La Ley Live Local de Florida permite construir apartamentos en terrenos comerciales con la mayor densidad permitida en la ciudad y hasta la altura máxima permitida en un radio de una milla, si al menos el 40% de las unidades de alquiler son asequibles. En Miami Beach, el Director de Planificación aprueba estos planes de forma administrativa, sin audiencia pública ni votación de la Comisión.')}</p>
        <dl class="stats">${stat(L('Approved', 'Aprobados'), llApproved.length)}${stat(L('Under review', 'En revisión'), ll.length - llApproved.length)}${stat(L('Tallest approved', 'Más alto aprobado'), tallestLL, L('stories', 'pisos'))}</dl>`
    },
    city: {
      layers: ['city'], flood: false,
      head: () => `<h1>${city.length} ${L('City projects.', 'proyectos de la Ciudad.')} <span class="accent-blue">${L('Your tax dollars at work.', 'Tus impuestos en acción.')}</span></h1>
        <p class="lead">${L("Streets, drainage, parks and buildings the City itself is planning, designing or building, from the City's capital project map.", 'Calles, drenaje, parques y edificios que la propia Ciudad planifica, diseña o construye, según el mapa de proyectos de capital de la Ciudad.')}</p>
        <dl class="stats">${stat(L('Planning', 'Planificación'), byPhase('plan'))}${stat(L('Design', 'Diseño'), byPhase('design'))}${stat(L('Construction', 'Construcción'), byPhase('build'))}</dl>`
    },
    around: {
      layers: ['road'], flood: false, overlays: ['trolley', 'bikeways', 'closures'],
      head: () => `<h1>${L('Getting around.', 'Cómo moverse.')} <span class="accent-orange">${L('Closures, trolley & bike lanes.', 'Cierres, trolley y ciclovías.')}</span></h1>
        <p class="lead">${L("Street and lane closure permits the City lists as active, plus the free trolley routes and stops and the City's bike lanes.", 'Permisos de cierre de calles y carriles que la Ciudad lista como activos, más las rutas y paradas del trolley gratuito y los carriles de bicicleta.')}</p>
        <dl class="stats">${stat(L('Closure permits listed active', 'Permisos de cierre activos'), roads.length)}${stat(L('Trolley stops', 'Paradas de trolley'), around?.trolleyStops.features.length || 0)}${stat(L('Bike lane segments', 'Tramos de ciclovía'), around?.bikeways.features.length || 0)}</dl>`
    },
    parks: {
      layers: ['park'], flood: false, overlays: ['parks', 'beaches', 'trolley'],
      head: () => `<h1>${L('Parks & beaches.', 'Parques y playas.')}</h1>
        <p class="lead">${L("Every City park, with the beach, and the trolley that gets you there. For today's flags, surf and water temperature, see the City's Ocean Rescue page linked in any park.", 'Cada parque de la Ciudad, la playa y el trolley para llegar. Para las banderas, el oleaje y la temperatura del agua de hoy, ve la página de Ocean Rescue de la Ciudad en cualquier parque.')}</p>
        <dl class="stats">${stat(L('Parks', 'Parques'), parks.length)}${stat(L('Acres of parks', 'Acres de parques'), Math.round(parks.reduce((n, p) => n + (p.acres || 0), 0)))}${stat(L('Trolley routes', 'Rutas de trolley'), around?.trolleyRoutes.features.length || 0)}</dl>`
    },
    str: {
      layers: ['str'], flood: false, overlays: ['str'],
      head: () => `<h1>${L('Short-term rentals.', 'Alquileres a corto plazo.')} <span class="accent-purple">${L('Building by building.', 'Edificio por edificio.')}</span></h1>
        <p class="lead">${L("Units the City has approved for short-term rental with a Certificate of Use, counted by building. A certificate doesn't prove a unit is being rented, and units and owners aren't shown.", 'Unidades que la Ciudad aprobó para alquiler a corto plazo con un Certificado de Uso, contadas por edificio. Un certificado no prueba que la unidad se esté alquilando, y no se muestran unidades ni propietarios.')}</p>
        <dl class="stats">${stat(L('Licensed units', 'Unidades con licencia'), strData?.counts.licensed || 0)}${stat(L('Pending', 'Pendientes'), strData?.counts.pending || 0)}${stat(L('Buildings', 'Edificios'), rentals.length)}</dl>`
    },
    flood: {
      layers: ['ll', 'dev'], flood: true,
      head: () => `<h1>${L('Where Miami Beach floods.', 'Dónde se inunda Miami Beach.')} <span class="accent-tide">${L("And what's going up there.", 'Y qué se construye allí.')}</span></h1>
        <p class="lead">${L("FEMA flood zones and the City's own map of tidal flooding spots, with every development project on top. Open any project to see its flood zone and the nearest flooding spot.", 'Las zonas de inundación de FEMA y el mapa de la Ciudad de puntos de inundación por marea, con cada proyecto de desarrollo encima. Abre cualquier proyecto para ver su zona y el punto de inundación más cercano.')}</p>
        <dl class="stats">${stat(L('Flood often', 'Se inundan a menudo'), freqCount('Frequently'))}${stat(L('Sometimes', 'A veces'), freqCount('Occasionally'))}${stat(L('Projects near frequent flooding', 'Proyectos cerca de inundación frecuente'), nearFrequent)}</dl>`
    }
  };
  const LEGEND = {
    ll: () => `<span><i class="sw approved"></i>${L('Live Local approved', 'Live Local aprobado')}</span><span><i class="sw review"></i>${L('Live Local under review', 'Live Local en revisión')}</span>`,
    dev: () => `<span><i class="sw dev"></i>${L('Other development', 'Otros proyectos')}</span>`,
    city: () => `<span><i class="sw city"></i>${L('City projects', 'Proyectos de la Ciudad')}</span>`,
    road: () => `<span><i class="sw road"></i>${L('Closure permits', 'Permisos de cierre')}</span><span><i class="sw trolley"></i>${L('Trolley', 'Trolley')}</span><span><i class="sw bike"></i>${L('Bike lanes', 'Ciclovías')}</span>`,
    park: () => `<span><i class="sw park"></i>${L('Parks', 'Parques')}</span><span><i class="sw beach"></i>${L('Beach', 'Playa')}</span><span><i class="sw trolley"></i>${L('Trolley', 'Trolley')}</span>`,
    str: () => `<span><i class="sw str"></i>${L('Buildings with licensed short-term rentals', 'Edificios con alquileres con licencia')}</span>`
  };

  const state = { view: 'overview', layers: VIEWS.overview.layers, review: false, flood: false };
  const params = new URLSearchParams(location.search);
  if (VIEWS[params.get('view')]) state.view = params.get('view');

  const llOrder = [...ll].sort((a, b) => (a.stage === b.stage ? (b.stories || 0) - (a.stories || 0) || (b.filed || '').localeCompare(a.filed || '') : a.stage === 'approved' ? -1 : 1));
  const cityOrder = [...city].sort((a, b) => ['build', 'design', 'plan'].indexOf(a.stage) - ['build', 'design', 'plan'].indexOf(b.stage) || a.location.localeCompare(b.location));
  const head = (layer, title, sub) => `<li class="list-head" data-layer="${layer}"><span>${esc(title)}</span><small>${esc(sub)}</small></li>`;
  function renderList() {
    const f = state;
    const parts = [];
    const vis = xs => xs.filter(a => matches(a, f));
    if (f.layers.includes('ll') && vis(llOrder).length) parts.push(head('ll', L('Live Local Act', 'Ley Live Local'), L(`${vis(llOrder).length} applications`, `${vis(llOrder).length} solicitudes`)), ...vis(llOrder).map(card));
    if (f.layers.includes('dev') && vis(devApps).length) parts.push(head('dev', L('Development since 2023', 'Desarrollo desde 2023'), L(`${vis(devApps).length} projects from the land use boards`, `${vis(devApps).length} proyectos de las juntas de uso de suelo`)), ...vis(devApps).map(card));
    if (f.layers.includes('city') && vis(cityOrder).length) parts.push(head('city', L('City projects', 'Proyectos de la Ciudad'), L(`${vis(cityOrder).length} in planning, design or construction`, `${vis(cityOrder).length} en planificación, diseño o construcción`)), ...vis(cityOrder).map(card));
    if (f.layers.includes('road') && vis(roads).length) parts.push(head('road', L('Street & lane closures', 'Cierres de calles y carriles'), L(`${vis(roads).length} permits the City lists as active`, `${vis(roads).length} permisos que la Ciudad lista como activos`)), ...vis(roads).map(card));
    if (f.layers.includes('park') && vis(parks).length) parts.push(head('park', L('Parks', 'Parques'), L(`${vis(parks).length} parks, largest first`, `${vis(parks).length} parques, de mayor a menor`)), ...vis(parks).map(card));
    if (f.layers.includes('str') && vis(rentals).length) parts.push(head('str', L('Buildings', 'Edificios'), L('Most licensed units first', 'Más unidades con licencia primero')), ...vis(rentals).map(card));
    listEl.innerHTML = parts.join('');
    listEl.querySelectorAll('.card').forEach((el, i) => (el.style.transitionDelay = `${Math.min(.9, i * 0.03)}s`));
    if (active) listEl.querySelector(`.card[data-id="${CSS.escape(active)}"]`)?.classList.add('is-active');
  }
  const viewHead = document.querySelector('.view-head');
  const legend = document.querySelector('.legend');
  function renderHead() {
    viewHead.classList.remove('is-in'); void viewHead.offsetWidth;
    viewHead.innerHTML = VIEWS[state.view].head();
    viewHead.classList.add('is-in');
    legend.innerHTML = state.layers.map(l => LEGEND[l]()).join('');
    document.querySelector('[data-review]').hidden = !state.layers.some(l => l === 'll' || l === 'dev');
    if (state.view === 'city' && state.review) document.querySelector('[data-review]').click();
  }
  const updated = () => (document.querySelector('[data-updated]').textContent = L(`Updated ${date(data.generatedAt.slice(0, 10))}.`, `Actualizado: ${date(data.generatedAt.slice(0, 10))}.`));

  let active = null;
  const cb = { pick: id => select(id), hover: (id, on) => hover(id, on), tip: a => a.layer === 'city'
      ? `<div class="tip">${esc(a.location)}<small>${esc(L('City project', 'Proyecto de la Ciudad'))} · ${esc(L(...PHASE[a.stage]))}</small></div>`
      : a.layer === 'road' ? `<div class="tip">${esc(a.location)}<small>${esc(a.kind)}</small></div>`
      : a.layer === 'park' ? `<div class="tip">${esc(a.location)}<small>${esc(L('Park', 'Parque'))}</small></div>`
      : a.layer === 'str' ? `<div class="tip">${esc(a.location)}<small>${esc(L(`${a.licensed} licensed short-term rental units`, `${a.licensed} unidades con licencia`))}</small></div>`
      : `<div class="tip">${esc(title(a.location))}<small>${a.stories ? a.stories + L(' stories · ', ' pisos · ') : ''}${a.stage === 'approved' ? L('Approved', 'Aprobado') : L('Under review', 'En revisión')}${a.layer === 'dev' ? ' · ' + L(...KIND[a.kind]) : ' · Live Local'}</small></div>`,
    L, title, esc, reduced, phone, matches, flood, cover: () => coverPx(),
    overlays: around ? { parks: around.parks, beaches: around.beaches, bikeways: around.bikeways, trolleyRoutes: around.trolleyRoutes, closures: around.closures, str: strData?.parcels } : {} };

  // Phones: the map fills the screen and the panel peeks up from the bottom (title + view tabs).
  // Swipe up anywhere on it to open the list over the whole page; swipe down (from the top of the list) to put it back.
  const panel = document.querySelector('.panel');
  const panelScroll = panel.querySelector('.panel-scroll');
  const handle = panel.querySelector('.sheet-handle');
  const sheet = { snap: 'peek', before: null };
  const probe = Object.assign(document.createElement('div'), { style: 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom)' });
  document.body.appendChild(probe);
  const safeBottom = () => parseFloat(getComputedStyle(probe).paddingBottom) || 0;
  const snapPx = name => {
    if (name === 'full') return app.clientHeight;
    const tabs = panel.querySelector('.views');
    return Math.round(tabs.offsetTop + tabs.offsetHeight + 12 + safeBottom());
  };
  function coverPx() {
    if (!phone()) return 0;
    if (active && !detail.hidden) return Math.max(detail.offsetHeight, snapPx('peek'));
    return snapPx(sheet.snap);
  }
  const setCover = () => app.style.setProperty('--cover', coverPx() + 'px');
  function setSheet(name) {
    sheet.snap = name;
    if (!phone()) { panel.style.removeProperty('--sheet-h'); panel.classList.remove('is-peek'); delete app.dataset.sheet; app.style.removeProperty('--cover'); return; }
    if (name === 'peek') panelScroll.scrollTop = 0;
    panel.classList.toggle('is-peek', name === 'peek');
    app.dataset.sheet = name;
    panel.style.setProperty('--sheet-h', snapPx(name) + 'px');
    handle.setAttribute('aria-expanded', String(name === 'full'));
    handle.setAttribute('aria-label', name === 'full' ? L('Back to the map', 'Volver al mapa') : L('Open the list', 'Abrir la lista'));
    setCover();
  }
  // One drag model for touch and mouse. A drag starts once a gesture is clearly vertical:
  // on the peeking sheet any vertical swipe drags it; on the open sheet the list scrolls, unless you pull down from its top.
  let drag = null, justDragged = false;
  const begin = (x, y) => { drag = { x, y, h: panel.offsetHeight, lastY: y, lastT: performance.now(), v: 0, mode: null }; };
  function move(x, y, ev) {
    if (!drag) return;
    const dx = x - drag.x, dy = drag.y - y; // dy > 0: finger moving up
    if (!drag.mode) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) > Math.abs(dy)) { drag.mode = 'x'; return; }
      drag.mode = sheet.snap !== 'full' || (dy < 0 && panelScroll.scrollTop <= 0) ? 'drag' : 'scroll';
      if (drag.mode === 'drag') { panel.classList.add('is-dragging'); panel.classList.remove('is-peek'); drag.y = y; drag.lastY = y; }
    }
    if (drag.mode !== 'drag') return;
    if (ev.cancelable) ev.preventDefault();
    const now = performance.now();
    drag.v = (drag.lastY - y) / Math.max(1, now - drag.lastT); drag.lastY = y; drag.lastT = now;
    panel.style.setProperty('--sheet-h', Math.max(snapPx('peek') - 24, Math.min(snapPx('full'), drag.h + (drag.y - y))) + 'px');
  }
  function end() {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.mode !== 'drag') return;
    panel.classList.remove('is-dragging');
    justDragged = true; setTimeout(() => (justDragged = false), 350);
    const h = panel.offsetHeight + d.v * 220; // a flick carries it the rest of the way
    setSheet(h > (snapPx('peek') + snapPx('full')) / 2 ? 'full' : 'peek');
  }
  panel.addEventListener('touchstart', e => { if (phone() && e.touches.length === 1) begin(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  panel.addEventListener('touchmove', e => move(e.touches[0].clientX, e.touches[0].clientY, e), { passive: false });
  panel.addEventListener('touchend', end);
  panel.addEventListener('touchcancel', end);
  panel.addEventListener('pointerdown', e => { if (phone() && e.pointerType === 'mouse' && e.button === 0) begin(e.clientX, e.clientY); });
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') move(e.clientX, e.clientY, e); });
  addEventListener('pointerup', e => { if (e.pointerType === 'mouse') end(); });
  panel.addEventListener('click', e => { if (justDragged) { e.preventDefault(); e.stopPropagation(); } }, true);
  handle.addEventListener('click', () => {
    if (active) close();
    setSheet(sheet.snap === 'full' ? 'peek' : 'full');
  });
  addEventListener('resize', () => setSheet(sheet.snap));
  setSheet('peek');

  // Engine: Google photorealistic 3D (Cesium) when a key is set and it loads; otherwise the stylized map.
  const key = document.querySelector('meta[name="google-maps-key"]')?.content;
  let engine = null;
  if (key && params.get('engine') !== 'flat') {
    try { engine = await (await import('./engine-photo.js?v=8')).create({ data, apps, byId, cb, key }); document.documentElement.dataset.engine = 'photo'; }
    catch (error) { console.warn('Photorealistic 3D unavailable, using the stylized map.', error); document.getElementById('map').innerHTML = ''; }
  }
  if (!engine) { engine = await flatEngine({ data, apps, byId, cb }); document.documentElement.dataset.engine = 'flat'; }

  function applyView(id, { push = true } = {}) {
    state.view = id;
    state.layers = VIEWS[id].layers;
    setFlood(VIEWS[id].flood);
    document.querySelectorAll('.view-tab').forEach(t => t.setAttribute('aria-pressed', t.dataset.view === id));
    renderHead(); renderList();
    engine.filter(state);
    engine.overlays?.(VIEWS[id].overlays || []);
    if (push) { const u = new URL(location.href); id === 'overview' ? u.searchParams.delete('view') : u.searchParams.set('view', id); history.replaceState(null, '', u); }
  }
  function setFlood(on) {
    state.flood = on;
    const b = document.querySelector('[data-flood]');
    b.setAttribute('aria-pressed', on); b.classList.toggle('is-on', on);
    document.querySelector('.flood-key').hidden = !on;
    engine.flood?.(on);
  }

  app.dataset.state = 'ready';
  applyView(state.view, { push: false });
  updated();
  engine.intro();

  function hover(id, on) {
    listEl.querySelectorAll('.card.is-hover').forEach(el => el.classList.remove('is-hover'));
    if (on && id) listEl.querySelector(`.card[data-id="${CSS.escape(id)}"]`)?.classList.add('is-hover');
    engine?.hover(on ? id : null);
  }
  function select(id, { fly = true } = {}) {
    const a = byId.get(id); if (!a) return;
    if (!matches(a, { layers: state.layers, review: false })) applyView({ city: 'city', ll: 'livelocal', dev: 'development', road: 'around', park: 'parks', str: 'str' }[a.layer]);
    active = id;
    listEl.querySelectorAll('.card').forEach(el => el.classList.toggle('is-active', el.dataset.id === id));
    detailBody.innerHTML = detailHtml(a);
    detail.hidden = false; requestAnimationFrame(() => detail.classList.add('is-open'));
    detail.scrollTop = 0;
    app.classList.add('is-detail');
    if (phone()) { if (sheet.before === null) sheet.before = sheet.snap; setSheet('peek'); }
    if (!phone()) listEl.querySelector(`.card[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    history.replaceState(null, '', location.pathname + location.search + '#' + id);
    engine.select(a, { fly, detailWidth: detail.offsetWidth });
  }
  function close() {
    active = null;
    detail.classList.remove('is-open');
    setTimeout(() => { if (!active) detail.hidden = true; }, 450);
    document.querySelectorAll('.card.is-active').forEach(el => el.classList.remove('is-active'));
    history.replaceState(null, '', location.pathname + location.search);
    app.classList.remove('is-detail');
    if (phone()) { setSheet(sheet.before || 'peek'); sheet.before = null; }
    engine.clear();
  }
  detail.querySelector('[data-close]').addEventListener('click', close);
  addEventListener('keydown', e => { if (e.key === 'Escape' && active) close(); });

  listEl.addEventListener('click', e => { const c = e.target.closest('.card'); if (c) select(c.dataset.id); });
  listEl.addEventListener('mouseover', e => { const c = e.target.closest('.card'); if (c) hover(c.dataset.id, true); });
  listEl.addEventListener('mouseleave', () => hover(null, false));

  document.querySelectorAll('.view-tab').forEach(t => t.addEventListener('click', () => {
    applyView(t.dataset.view);
    if (phone()) t.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }));
  const reviewBtn = document.querySelector('[data-review]');
  reviewBtn.addEventListener('click', () => {
    state.review = reviewBtn.getAttribute('aria-pressed') !== 'true';
    reviewBtn.setAttribute('aria-pressed', state.review); reviewBtn.classList.toggle('is-on', state.review);
    renderList(); engine.filter(state);
  });
  document.querySelector('[data-flood]').addEventListener('click', () => setFlood(!state.flood));

  // WASD move · Q/E turn · R/F up and down · Shift faster. Ignored while typing.
  const held = new Set();
  const KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
  let last = 0, looping = false;
  const typing = () => /input|textarea|select/i.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
  function loop(now) {
    if (!held.size) { looping = false; return; }
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    const has = k => held.has(k);
    const forward = (has('w') || has('arrowup') ? 1 : 0) - (has('s') || has('arrowdown') ? 1 : 0);
    const right = (has('d') ? 1 : 0) - (has('a') ? 1 : 0);
    const turn = (has('e') || has('arrowright') ? 1 : 0) - (has('q') || has('arrowleft') ? 1 : 0);
    const up = (has('r') ? 1 : 0) - (has('f') ? 1 : 0);
    if (dt > 0) engine.move?.({ forward, right, turn, up }, dt, has('shift'));
    requestAnimationFrame(loop);
  }
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (typing() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (k === 'shift') { held.add('shift'); return; }
    if (!KEYS.has(k)) return;
    if (k.startsWith('arrow') && document.activeElement?.closest?.('.panel')) return;
    e.preventDefault();
    held.add(k);
    document.documentElement.classList.add('is-flying');
    if (!looping) { looping = true; last = 0; requestAnimationFrame(loop); }
  });
  addEventListener('keyup', e => { held.delete(e.key.toLowerCase()); if (!held.size || (held.size === 1 && held.has('shift'))) { held.delete('shift'); } });
  addEventListener('blur', () => held.clear());

  document.addEventListener('language:change', () => {
    renderHead(); renderList(); setSheet(sheet.snap);
    if (active) detailBody.innerHTML = detailHtml(byId.get(active));
    updated();
    engine.relabel?.();
  });

  const start = decodeURIComponent(location.hash.slice(1));
  if (byId.has(start)) setTimeout(() => select(start), reduced ? 0 : 3300);
}

main().catch(error => {
  console.error(error);
  app.dataset.state = 'error';
  listEl.innerHTML = '<li class="fine">The map could not load. The sources are linked below.</li>';
});
