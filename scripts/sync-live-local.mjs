// Live Local Act applications in Miami Beach, from public sources only:
//  - the City's two Live Local pages (approved / under review), which link each case to Civic Access (EnerGov)
//  - Civic Access plan records (status, filing date, planner, main address and folio), read anonymously
//  - the City's public parcel layer (outline, owner, last sale, zoning, lot size, existing building)
//  - the signed approval orders (height in stories, applicant, uses) for approved cases
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, cleanText, fetchJson, fetchText, isoNow, writeSnapshot } from './lib.mjs';

const PAGES = {
  approved: 'https://www.miamibeachfl.gov/city-hall/planning/approved-live-local-act-applications/',
  review: 'https://www.miamibeachfl.gov/city-hall/planning/live-local-act-applications-under-review/'
};
const ENERGOV = 'https://energovcss.miamibeachfl.gov/EnerGovProd/SelfService';
const PARCELS = 'https://gis.miamibeachfl.gov/public/rest/services/gc/gc_Cadastral/MapServer/6/query';
const PARCEL_FIELDS = 'FOLIO,TRUE_SITE_ADDR,TRUE_OWNER1,TRUE_OWNER2,DOS_1,PRICE_1,PRIMARY_ZONE,LOT_SIZE,YEAR_BUILT,FLOOR_COUNT,UNIT_COUNT,BUILDING_ACTUAL_AREA,NEIGHBORHOOD';
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, 'twenty-one': 21, 'twenty-two': 22, 'twenty-three': 23, 'twenty-four': 24, 'twenty-five': 25, thirty: 30 };

async function energov(planId) {
  const response = await fetch(`${ENERGOV}/api/energov/plans/${planId}`, {
    headers: { accept: 'application/json', tenantId: '3', tenantName: 'miamibeachflprod2', 'Tyler-TenantUrl': 'MiamiBeachFLProd', 'user-agent': 'DavidSuarezResidentHub/1.0 (+https://github.com/joebasrawi/david-suarez-mb)' },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`Civic Access plan ${planId} returned HTTP ${response.status}`);
  const body = await response.json();
  if (!body.Success || !body.Result) throw new Error(`Civic Access plan ${planId} returned no record`);
  return body.Result;
}

// Rows on the City pages: an application number, a location, and a Civic Access link (plan GUID).
function parseReview(html) {
  const body = html.slice(html.indexOf('Application Number'), html.indexOf('Live Local Act Application Search'));
  const rows = body.split(/<tr[\s>]/).slice(1);
  return rows.map(row => {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(match => cleanText(match[1]));
    const planId = row.match(/#\/plan\/([0-9a-f-]{36})/i)?.[1];
    if (!planId || cells.length < 2) return null;
    const [number, formerly] = [cells[0].match(/^[A-Z]{2,3}\d{2}-\d{4}/)?.[0], cells[0].match(/FKA:?\s*([A-Z]{2}\d{2}-\d{4})/i)?.[1] || null];
    return { stage: 'review', number, formerly, location: cells[1], planId, cityPage: PAGES.review };
  }).filter(Boolean);
}

function parseApproved(html) {
  const body = html.slice(html.indexOf('Approved Live Local Act Applications'), html.indexOf('Navigate to'));
  const links = [...body.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, text]) => ({ href, text: cleanText(text) }));
  const items = [];
  for (const link of links) {
    const planId = link.href.match(/#\/plan\/([0-9a-f-]{36})/i)?.[1];
    if (planId) {
      const number = link.text.match(/[A-Z]{2,3}\d{2}-\d{4}/)?.[0];
      const location = cleanText(link.text.replace(number || '', '').replace(/^[\s,–-]+/, ''));
      items.push({ stage: 'approved', number, formerly: null, location, planId, cityPage: PAGES.approved });
    } else if (/\.pdf$/i.test(link.href) && items.length) {
      items[items.length - 1].order = new URL(link.href, PAGES.approved).href;
    }
  }
  return items;
}

// "810 Alton Rd. and 824 Alton Rd." / "425 - 455 Ocean Dr." / "7401-7425 Harding Avenue"
function addressQueries(location) {
  const street = s => s.toUpperCase().replace(/\./g, '').replace(/\bAVENUE\b/, 'AVE').replace(/\bAV\b/, 'AVE').replace(/\bROAD\b/, 'RD').replace(/\bDRIVE\b/, 'DR').replace(/\bSTREET\b/, 'ST').replace(/\s+/g, ' ').trim();
  const out = [];
  for (const part of location.split(/\band\b|;/i)) {
    const range = part.match(/(\d+)\s*[-–]\s*(\d+)\s+(.+)/);
    const single = part.match(/(\d+)\s+(.+)/);
    if (range) out.push({ from: +range[1], to: +range[2], street: street(range[3]) });
    else if (single) out.push({ from: +single[1], to: +single[1], street: street(single[2]) });
  }
  return out;
}

async function parcelsFor(folios, location) {
  const where = [];
  if (folios.length) where.push(`FOLIO IN (${folios.map(f => `'${f}'`).join(',')})`);
  for (const q of addressQueries(location)) {
    const name = q.street.replace(/'/g, "''").split(' ').slice(0, 2).join(' ');
    where.push(`(TRUE_SITE_ADDR LIKE '% ${name}%')`);
  }
  const url = new URL(PARCELS);
  url.search = new URLSearchParams({ where: where.join(' OR ') || '1=0', outFields: PARCEL_FIELDS, returnGeometry: 'true', outSR: '4326', f: 'geojson' });
  const data = await fetchJson(url);
  const ranges = addressQueries(location);
  return (data.features || []).filter(feature => {
    const p = feature.properties;
    if (folios.includes(p.FOLIO)) return true;
    const m = String(p.TRUE_SITE_ADDR || '').match(/^(\d+)\s+(.+)$/);
    if (!m) return false;
    return ranges.some(r => +m[1] >= r.from && +m[1] <= r.to && m[2].replace(/\s+/g, ' ').startsWith(r.street.split(' ').slice(0, 2).join(' ')));
  });
}

async function orderFacts(url) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const buffer = new Uint8Array(await (await fetch(url, { signal: AbortSignal.timeout(60_000) })).arrayBuffer());
  const pdf = await getDocument({ data: buffer, useSystemFonts: true, isEvalSupported: false }).promise;
  let text = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) text += ' ' + (await (await pdf.getPage(i)).getTextContent()).items.map(item => item.str).join(' ');
  text = text.replace(/\s+/g, ' ');
  const storiesRaw = text.match(/review of an? (\d+|[a-z-]+)-story/i)?.[1] || text.match(/construction of an? ([a-z-]+?)(?:-|\s)\(?\d*-?\)?\s*story/i)?.[1];
  const stories = storiesRaw ? (Number(storiesRaw) || WORDS[storiesRaw.toLowerCase()] || null) : null;
  const applicant = text.match(/APPLICANT:\s*([^(]+?)\s*\(the/i)?.[1]?.trim() || null;
  const usesRaw = text.match(/containing multifamily rental housing units, at least 40 percent of which are affordable,\s*\d?\s*and ([^(]+?)\s*\(the "Project"\)/i)?.[1]?.trim() || null;
  const uses = usesRaw ? usesRaw.replace(/(\d)\s+(st|nd|rd|th)\b/g, '$1$2').replace(/\s+/g, ' ') : null;
  return { stories, applicant, uses };
}

function center(features) {
  const pts = [];
  const walk = c => (typeof c[0] === 'number' ? pts.push(c) : c.forEach(walk));
  features.forEach(f => walk(f.geometry.coordinates));
  if (!pts.length) return null;
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length].map(n => +n.toFixed(6));
}

const toDate = value => { const v = String(value || ''); if (/^\d{8}$/.test(v)) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`; return v ? v.slice(0, 10) : null; };
const money = value => (Number(value) > 100 ? Number(value) : null);

const [approvedHtml, reviewHtml] = await Promise.all([fetchText(PAGES.approved), fetchText(PAGES.review)]);
const listed = [...parseApproved(approvedHtml), ...parseReview(reviewHtml)];
if (listed.length < 5) throw new Error(`Expected the City's Live Local lists, found ${listed.length} rows.`);

const applications = [];
for (const item of listed) {
  const plan = await energov(item.planId);
  const folios = [plan.MainParcelNumber].filter(f => /^\d{13}$/.test(f || ''));
  const parcels = await parcelsFor(folios, item.location);
  const facts = item.order ? await orderFacts(item.order).catch(error => (console.error(`Order ${item.order}: ${error.message}`), {})) : {};
  const sites = parcels.map(f => ({
    folio: f.properties.FOLIO,
    address: cleanText(f.properties.TRUE_SITE_ADDR),
    // Company names only: drop 'C/O <person>' care-of lines.
    owner: [f.properties.TRUE_OWNER1, f.properties.TRUE_OWNER2].filter(Boolean).map(cleanText).join(' ').replace(/\s+C\/O\b.*$/i, '').trim(),
    lastSale: f.properties.DOS_1 ? { date: toDate(f.properties.DOS_1), price: money(f.properties.PRICE_1) } : null,
    zoning: f.properties.PRIMARY_ZONE || null,
    lotSize: f.properties.LOT_SIZE || null,
    existing: { yearBuilt: f.properties.YEAR_BUILT || null, floors: f.properties.FLOOR_COUNT || null, units: f.properties.UNIT_COUNT || null }
  }));
  applications.push({
    id: plan.PlanNumber || item.number,
    number: plan.PlanNumber || item.number,
    formerly: item.formerly,
    stage: item.stage,
    status: plan.PlanStatus,
    type: plan.PlanType,
    location: item.location,
    filed: toDate(plan.ApplyDate),
    completed: toDate(plan.CompleteDate),
    planner: plan.AssignedTo || null,
    stories: facts.stories || null,
    applicant: facts.applicant || null,
    uses: facts.uses || null,
    sites,
    center: center(parcels),
    links: { civicAccess: `${ENERGOV}#/plan/${item.planId}?tab=attachments`, cityList: item.cityPage, order: item.order || null }
  });
}

const features = [];
for (const a of applications) {
  for (const f of await parcelsFor(a.sites.map(s => s.folio), '')) features.push({ type: 'Feature', properties: { id: a.id, stage: a.stage, stories: a.stories }, geometry: f.geometry });
}

// Building footprints with LiDAR heights (feet) from Miami-Dade County's UBID/folio layer.
// Only height, floors, year and (for taller buildings) street address are kept; owner fields are never read.
const BUILDINGS = 'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/ArcGIS/rest/services/BuildingFootprintUBIDFolio_gdb/FeatureServer/0/query';
const buildings = [];
for (let offset = 0; offset < 30000; offset += 2000) {
  const url = new URL(BUILDINGS);
  url.search = new URLSearchParams({ where: "CITY='MIAMI BEACH'", outFields: 'BLDG_HEIGHT,FLOORS,YEAR_BUILT,ADDRESS', returnGeometry: 'true', outSR: '4326', geometryPrecision: '6', maxAllowableOffset: '0.000004', resultOffset: String(offset), resultRecordCount: '2000', orderByFields: 'OBJECTID', f: 'geojson' });
  const page = await fetchJson(url);
  for (const f of page.features || []) {
    if (!f.geometry) continue;
    const ft = Math.round(Number(f.properties.BLDG_HEIGHT) || 0);
    const props = { h: ft };
    if (ft >= 60 && f.properties.ADDRESS) props.a = cleanText(f.properties.ADDRESS);
    buildings.push({ type: 'Feature', properties: props, geometry: f.geometry });
  }
  if (!page.features || page.features.length < 2000) break;
}

// Neighborhood comparison for each application: tallest and typical heights within 1/4 mile and 1 mile,
// skipping buildings on the application's own parcels (those are what would be replaced).
const ring = g => (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]);
const centroid = g => { const r = ring(g); return [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length]; };
const meters = (a, b) => { const R = 6371000, k = Math.PI / 180, dLat = (b[1] - a[1]) * k, dLng = (b[0] - a[0]) * k; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * k) * Math.cos(b[1] * k) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const inside = (pt, poly) => { const polys = poly.type === 'Polygon' ? [poly.coordinates] : poly.coordinates; return polys.some(rings => { let c = false; const r = rings[0]; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { if (((r[i][1] > pt[1]) !== (r[j][1] > pt[1])) && (pt[0] < (r[j][0] - r[i][0]) * (pt[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0])) c = !c; } return c; }); };
const points = buildings.map(b => ({ c: centroid(b.geometry), h: b.properties.h, a: b.properties.a || null }));
const median = xs => { const s = [...xs].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
for (const app of applications) {
  if (!app.center) continue;
  const own = (await parcelsFor(app.sites.map(s => s.folio), '')).map(f => f.geometry);
  const near = points.filter(p => p.h > 0 && !own.some(g => inside(p.c, g))).map(p => ({ ...p, d: meters(app.center, p.c) }));
  const quarter = near.filter(p => p.d <= 402), mile = near.filter(p => p.d <= 1609);
  const top = xs => xs.reduce((m, p) => (p.h > (m?.h || 0) ? p : m), null);
  const pick = p => (p ? { ft: p.h, address: p.a, meters: Math.round(p.d) } : null);
  const estFt = app.stories ? Math.round((app.stories * 10.5) / 5) * 5 : null;
  app.heightFt = estFt;
  app.compare = {
    quarterMile: { tallest: pick(top(quarter)), typicalFt: median(quarter.map(p => p.h)), buildings: quarter.length, taller: estFt ? quarter.filter(p => p.h > estFt).length : null },
    mile: { tallest: pick(top(mile)), typicalFt: median(mile.map(p => p.h)), buildings: mile.length, taller: estFt ? mile.filter(p => p.h > estFt).length : null }
  };
}

if (buildings.length > 8000) {
  // Compact JSON (no indentation). Rewritten only when the footprints change.
  const file = path.join(ROOT, 'data/mb-buildings.json');
  const body = JSON.stringify(buildings);
  const previous = await readFile(file, 'utf8').then(t => JSON.stringify(JSON.parse(t).features)).catch(() => '');
  if (previous !== body) await writeFile(file, `{"type":"FeatureCollection","source":"${BUILDINGS.replace('/query', '')}","units":"feet","generatedAt":"${isoNow()}","features":${body}}\n`);
}

await writeSnapshot('data/live-local.json', {
  generatedAt: isoNow(),
  source: {
    label: 'City of Miami Beach Live Local Act pages, Civic Access, City parcel layer, signed orders, and Miami-Dade County LiDAR building heights',
    urls: [PAGES.approved, PAGES.review, `${ENERGOV}`, PARCELS.replace('/query', '')]
  },
  counts: { total: applications.length, approved: applications.filter(a => a.stage === 'approved').length, review: applications.filter(a => a.stage === 'review').length },
  applications,
  parcels: { type: 'FeatureCollection', features }
});
console.log(`Live Local: ${applications.length} applications (${applications.filter(a => a.stage === 'approved').length} approved), ${features.length} parcels.`);
