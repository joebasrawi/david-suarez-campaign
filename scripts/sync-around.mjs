// "Getting around" and "Parks & beaches" layers for /map/, from public map servers:
//  - City of Miami Beach: active right-of-way / lane closure permits, trolley routes and stops, bike lanes, city limits
//  - Miami-Dade County: municipal park boundaries and beach areas (clipped to Miami Beach city limits)
import { cleanText, fetchJson, isoNow, writeSnapshot } from './lib.mjs';

const CITY = 'https://gis.miamibeachfl.gov/public/rest/services/gc';
const COUNTY = 'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/ArcGIS/rest/services';
const ENVELOPE = '-80.20,25.75,-80.11,25.88';

async function query(url, params = {}) {
  const u = new URL(`${url}/query`);
  u.search = new URLSearchParams({ where: '1=1', outFields: '*', returnGeometry: 'true', outSR: '4326', geometryPrecision: '6', maxAllowableOffset: '0.00002', f: 'geojson', ...params });
  const data = await fetchJson(u);
  if (!Array.isArray(data.features)) throw new Error(`${url} returned no features`);
  return data.features.filter(f => f.geometry);
}

const pointIn = (pt, geom) => {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  let c = false;
  for (const rings of polys) for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    if ((r[i][1] > pt[1]) !== (r[j][1] > pt[1]) && pt[0] < ((r[j][0] - r[i][0]) * (pt[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  return c;
};
const centroid = g => { const r = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]; return [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length]; };
const ms = v => (v ? new Date(v).toISOString().slice(0, 10) : null);
const title = s => cleanText(s || '').toLowerCase().replace(/\b\w/g, m => m.toUpperCase());

const [boundary] = await query(`${CITY}/gc_Cadastral/MapServer/0`, { maxAllowableOffset: '0.0002' });
const inCity = g => pointIn(centroid(g), boundary.geometry);

// Lane closures: active permits only. Descriptions name contractors (companies), never people.
const closures = (await query(`${CITY}/gc_LaneClosures/MapServer/0`, { where: "USER_status_desc='Active'" })).map(f => {
  const p = f.properties;
  return { type: 'Feature', geometry: f.geometry, properties: {
    permit: p.USER_permit_number, kind: cleanText(p.USER_work_class || ''),
    address: title(p.USER_main_address_line_1),
    issued: ms(p.USER_issue_date), expires: ms(p.USER_expiration_date),
    desc: cleanText(p.USER_description || '').split(/\s*(?:Initial Issuance|Extension \d)/i)[0].slice(0, 260)
  } };
});

const trolleyRoutes = (await query(`${CITY}/gc_Transportation/MapServer/4`)).map(f => ({ type: 'Feature', geometry: f.geometry, properties: { name: cleanText(f.properties.Name || '') } }));
const trolleyStops = (await query(`${CITY}/gc_Transportation/MapServer/2`)).map(f => ({ type: 'Feature', geometry: f.geometry, properties: { name: [f.properties.Main_Street, f.properties.Cross_Street].filter(Boolean).map(title).join(' & '), route: cleanText(f.properties.Trolley_Route || '') } }));
const bikeways = (await query(`${CITY}/gc_Transportation/MapServer/3`)).map(f => ({ type: 'Feature', geometry: f.geometry, properties: { name: title(f.properties.FULL_NAME), type: cleanText(f.properties.Bikeway_Type || ''), protected: /^y/i.test(f.properties.Protected || '') } }));

const parks = (await query(`${COUNTY}/MunicipalParkBoundary_gdb/FeatureServer/0`, { geometry: ENVELOPE, geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects' }))
  .filter(f => inCity(f.geometry))
  .map(f => ({ type: 'Feature', geometry: f.geometry, properties: { name: cleanText(f.properties.NAME || ''), address: title(f.properties.ADDRESS), acres: f.properties.TOTACRE ? +(+f.properties.TOTACRE).toFixed(1) : null, type: cleanText(f.properties.TYPE || ''), phone: f.properties.PHONE || null, center: centroid(f.geometry).map(n => +n.toFixed(6)) } }));
const beaches = (await query(`${COUNTY}/Beach_Areas/FeatureServer/0`, { geometry: ENVELOPE, geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects' }))
  .filter(f => inCity(f.geometry))
  .map(f => ({ type: 'Feature', geometry: f.geometry, properties: { name: cleanText(f.properties.NAME || ''), center: centroid(f.geometry).map(n => +n.toFixed(6)) } }));

const fc = features => ({ type: 'FeatureCollection', features });
await writeSnapshot('data/around.json', {
  generatedAt: isoNow(),
  source: { label: 'City of Miami Beach map server (lane closures, trolley, bike lanes) and Miami-Dade County open data (parks, beaches)', urls: [`${CITY}/gc_LaneClosures/MapServer`, `${CITY}/gc_Transportation/MapServer`, `${COUNTY}/MunicipalParkBoundary_gdb/FeatureServer/0`, `${COUNTY}/Beach_Areas/FeatureServer/0`] },
  closures: fc(closures), trolleyRoutes: fc(trolleyRoutes), trolleyStops: fc(trolleyStops), bikeways: fc(bikeways), parks: fc(parks), beaches: fc(beaches)
});
console.log(`Around: ${closures.length} active closures, ${trolleyRoutes.length} trolley routes, ${trolleyStops.length} stops, ${bikeways.length} bikeway segments, ${parks.length} parks, ${beaches.length} beach areas.`);
