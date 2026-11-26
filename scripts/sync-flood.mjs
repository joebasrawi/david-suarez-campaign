// Flood risk layers for /live-local/, from the City of Miami Beach's public map server:
//  - FEMA effective flood zones (VE / AE / X) with base flood elevation
//  - The City's mapped tidal flooding spots, by how often they flood in high tides
import { fetchJson, isoNow, writeSnapshot } from './lib.mjs';

const BASE = 'https://gis.miamibeachfl.gov/public/rest/services/gc';
async function layer(path, outFields) {
  const url = new URL(`${BASE}/${path}/query`);
  url.search = new URLSearchParams({ where: '1=1', outFields, returnGeometry: 'true', outSR: '4326', geometryPrecision: '6', maxAllowableOffset: '0.00002', f: 'geojson' });
  const data = await fetchJson(url);
  if (!Array.isArray(data.features) || !data.features.length) throw new Error(`${path} returned no features`);
  return data.features.filter(f => f.geometry);
}

const zones = (await layer('gc_FloodZones/MapServer/0', 'FLD_ZONE,STATIC_BFE,ZONE_SUBTY')).map(f => ({
  type: 'Feature',
  properties: { zone: f.properties.FLD_ZONE, bfe: f.properties.STATIC_BFE > 0 ? f.properties.STATIC_BFE : null, sub: f.properties.ZONE_SUBTY || null },
  geometry: f.geometry
}));
const spots = (await layer('gc_Stormwater/MapServer/16', 'Frequency,descriptio')).map(f => ({
  type: 'Feature',
  properties: { freq: f.properties.Frequency, desc: f.properties.descriptio },
  geometry: f.geometry
}));

await writeSnapshot('data/flood.json', {
  generatedAt: isoNow(),
  source: { label: 'City of Miami Beach map server: FEMA flood zones and tidal flooding areas of concern', urls: [`${BASE}/gc_FloodZones/MapServer/0`, `${BASE}/gc_Stormwater/MapServer/16`] },
  zones: { type: 'FeatureCollection', features: zones },
  tidal: { type: 'FeatureCollection', features: spots }
});
console.log(`Flood: ${zones.length} FEMA zone polygons, ${spots.length} tidal flooding spots.`);
