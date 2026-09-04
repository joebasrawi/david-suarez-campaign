import { cleanText, fetchJson, isoNow, writeSnapshot } from './lib.mjs';

const SERVICE_URL = 'https://gis.miamibeachfl.gov/public/rest/services/gc/gc_Projects_PW/MapServer';
const layers = [
  [1, 'Construction', 'site'], [2, 'Design', 'site'], [3, 'Planning', 'site'],
  [5, 'Construction', 'right-of-way'], [6, 'Design', 'right-of-way'], [7, 'Planning', 'right-of-way'],
  [9, 'Construction', 'area'], [10, 'Design', 'area'], [11, 'Planning', 'area'],
  [12, 'Active', 'citywide']
];

function coordinates(value, output = []) {
  if (!Array.isArray(value)) return output;
  if (typeof value[0] === 'number' && typeof value[1] === 'number') output.push(value);
  else value.forEach(item => coordinates(item, output));
  return output;
}

function center(geometry) {
  const points = coordinates(geometry?.coordinates);
  if (!points.length) return null;
  const [lng, lat] = points.reduce(([x, y], [nextX, nextY]) => [x + nextX, y + nextY], [0, 0]);
  return { lat: lat / points.length, lng: lng / points.length };
}

function date(value) {
  if (typeof value === 'number') return new Date(value).toISOString().slice(0, 10);
  const match = String(value || '').match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/);
  return match ? match[0].replaceAll('/', '-') : null;
}

function stableId(properties, layerId, objectId) {
  const base = cleanText(properties.ProjectNumber || properties.CapitalProjectNumber || `${layerId}-${objectId}`);
  return `${base}-${layerId}-${objectId}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const batches = await Promise.all(layers.map(async ([layerId, phase, shape]) => {
  const query = new URL(`${SERVICE_URL}/${layerId}/query`);
  query.search = new URLSearchParams({ where: '1=1', outFields: '*', returnGeometry: 'true', outSR: '4326', f: 'geojson' });
  const data = await fetchJson(query);
  if (!Array.isArray(data.features)) throw new Error(`Layer ${layerId} did not return GeoJSON features.`);
  return data.features.map(feature => {
    const p = feature.properties || {};
    const point = center(feature.geometry);
    return {
      id: stableId(p, layerId, feature.id ?? p.OBJECTID),
      projectNumber: cleanText(p.ProjectNumber),
      title: cleanText(p.ProjectName) || 'Untitled city project',
      phase: cleanText(p.ProjectStatus) || phase,
      status: cleanText(p.Status),
      type: cleanText(p.Type) || 'City project',
      department: cleanText(p.Department),
      owner: cleanText(p.ProjectOwner),
      neighborhood: cleanText(p.Neighborhood),
      corridor: cleanText(p.Corridor),
      limits: cleanText(p.Limits),
      description: cleanText(p.Description),
      startDate: date(p.StartDate),
      endDate: date(p.EndDate),
      link: /^https?:\/\//i.test(p.Hyperlink || '') ? p.Hyperlink : '',
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      geometryType: feature.geometry?.type || null,
      sourceLayer: { id: layerId, phase, shape, objectId: feature.id ?? p.OBJECTID }
    };
  });
}));

const items = batches.flat().sort((a, b) => a.title.localeCompare(b.title) || a.phase.localeCompare(b.phase));
if (items.length < 50 || items.some(item => !item.id || !item.title || !item.phase)) {
  throw new Error(`City projects validation failed: received ${items.length} usable features.`);
}

await writeSnapshot('data/city-projects.json', {
  generatedAt: isoNow(),
  source: { label: 'City of Miami Beach Public Works GIS', url: SERVICE_URL },
  disclaimer: 'Official city GIS data mirrored for resident-friendly search. Project status and dates should be confirmed on the linked city source when available.',
  items
});

console.log(`Synced ${items.length} active city project features across ${layers.length} GIS layers.`);
