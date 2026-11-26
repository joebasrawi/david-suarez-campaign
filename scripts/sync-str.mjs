// Short-term rental Certificates of Use, counted by building (never by unit or owner), from the City's
// Civic Access portal (plan type "Certificate of Use - Short Term Rental"), read anonymously.
// A completed certificate means the City approved the unit for short-term rental; it does not prove it is rented.
import { cleanText, fetchJson, isoNow, writeSnapshot } from './lib.mjs';

const SEARCH = 'https://energovcss.miamibeachfl.gov/energovprod/selfservice/api/energov/search/search';
const PARCELS = 'https://gis.miamibeachfl.gov/public/rest/services/gc/gc_Cadastral/MapServer/6/query';
const HEADERS = { accept: 'application/json', 'content-type': 'application/json;charset=UTF-8', tenantId: '3', tenantName: 'miamibeachflprod2', 'Tyler-TenantUrl': 'MiamiBeachFLProd', 'Tyler-Tenant-Culture': 'en-US', 'user-agent': 'DavidSuarezResidentHub/1.0 (+https://github.com/joebasrawi/david-suarez-mb)' };
const TYPE = 'cd4df2d8-3534-4af9-bcfc-96a0a79fc013', WORKCLASS = '38ba4b34-47b3-b041-e09f-abc2e3118165';

async function search(page) {
  const body = {
    Keyword: '', ExactMatch: false, SearchModule: 3, FilterModule: 1, SearchMainAddress: false, PageNumber: page, PageSize: 100, SortBy: 'ApplyDate', SortAscending: false,
    PlanCriteria: { PlanTypeId: TYPE, PlanWorkclassId: WORKCLASS, PlanStatusId: 'none', SearchMainAddress: false, EnableDescriptionSearch: false, PageNumber: page, PageSize: 100, SortBy: 'ApplyDate', SortAscending: false },
    PermitCriteria: {}, InspectionCriteria: {}, CodeCaseCriteria: {}, RequestCriteria: {}, BusinessLicenseCriteria: {}, ProfessionalLicenseCriteria: {}, LicenseCriteria: {}, ProjectCriteria: {}
  };
  const r = await fetch(SEARCH, { method: 'POST', headers: HEADERS, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000) });
  if (!r.ok) throw new Error(`Civic Access search returned HTTP ${r.status}`);
  const d = await r.json();
  if (!d.Success || !d.Result) throw new Error('Civic Access search returned no result');
  return d.Result;
}

const cases = [];
for (let page = 1; page <= 30; page++) {
  const r = await search(page);
  cases.push(...(r.EntityResults || []));
  if (page >= (r.TotalPages || 1)) break;
}
if (cases.length < 100) throw new Error(`Expected hundreds of short-term rental certificates, found ${cases.length}.`);

// Resolve each case to a building parcel: exact folio, else the condo's reference parcel (first 9 digits + 0001).
const folios = [...new Set(cases.map(c => c.MainParcel).filter(f => /^\d{13}$/.test(f || '')))];
const candidates = [...new Set(folios.flatMap(f => [f, f.slice(0, 9) + '0001']))];
const parcels = new Map();
for (let i = 0; i < candidates.length; i += 80) {
  const u = new URL(PARCELS);
  u.search = new URLSearchParams({ where: `FOLIO IN (${candidates.slice(i, i + 80).map(f => `'${f}'`).join(',')})`, outFields: 'FOLIO,TRUE_SITE_ADDR', returnGeometry: 'true', outSR: '4326', geometryPrecision: '6', f: 'geojson' });
  for (const f of (await fetchJson(u)).features || []) if (f.geometry) parcels.set(f.properties.FOLIO, f);
}
const centroid = g => { const r = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]; return [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length].map(n => +n.toFixed(6)); };
const street = c => cleanText(`${c.Address?.AddressLine1 || ''} ${c.Address?.AddressLine2 || ''}`).toLowerCase().replace(/\b\w/g, m => m.toUpperCase());

const buildings = new Map();
let unmapped = 0;
for (const c of cases) {
  const f = c.MainParcel;
  const parcel = parcels.get(f) || parcels.get((f || '').slice(0, 9) + '0001');
  if (!parcel) { unmapped++; continue; }
  const key = parcel.properties.FOLIO;
  if (!buildings.has(key)) buildings.set(key, { id: 'STR-' + key, folio: key, address: street(c) || cleanText(parcel.properties.TRUE_SITE_ADDR || ''), center: centroid(parcel.geometry), geometry: parcel.geometry, licensed: 0, pending: 0, closed: 0, latest: null });
  const b = buildings.get(key);
  if (c.CaseStatus === 'Complete') b.licensed++;
  else if (c.CaseStatus === 'Under Review') b.pending++;
  else b.closed++;
  const d = (c.ApplyDate || '').slice(0, 10);
  if (d && (!b.latest || d > b.latest)) b.latest = d;
}
const list = [...buildings.values()].filter(b => b.licensed + b.pending > 0).sort((a, b) => b.licensed - a.licensed || b.pending - a.pending);

await writeSnapshot('data/str.json', {
  generatedAt: isoNow(),
  since: cases.reduce((m, c) => ((c.ApplyDate || '9') < m ? c.ApplyDate : m), '9').slice(0, 10),
  source: { label: 'City of Miami Beach Civic Access: Certificate of Use - Short Term Rental cases, counted by building', urls: ['https://energovcss.miamibeachfl.gov/EnerGovProd/SelfService', PARCELS.replace('/query', '')] },
  counts: { cases: cases.length, licensed: cases.filter(c => c.CaseStatus === 'Complete').length, pending: cases.filter(c => c.CaseStatus === 'Under Review').length, buildings: list.length, unmapped },
  buildings: list.map(({ geometry, ...b }) => b),
  parcels: { type: 'FeatureCollection', features: list.map(b => ({ type: 'Feature', properties: { id: b.id, licensed: b.licensed, pending: b.pending }, geometry: b.geometry })) }
});
console.log(`STR: ${cases.length} certificates, ${list.length} buildings, ${unmapped} unmapped.`);
