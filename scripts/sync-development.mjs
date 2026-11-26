// Development projects from Miami Beach's land use boards (Design Review Board, Historic Preservation Board,
// Planning Board conditional uses and rezonings), read anonymously from the City's Civic Access portal.
// Keeps new buildings, major redevelopment and rezonings; leaves out single-family homes, facade tweaks, signs,
// art, decks, outdoor dining and the like. Live Local cases are on their own layer (sync-live-local.mjs).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, cleanText, fetchJson, isoNow, writeSnapshot } from './lib.mjs';

const ENERGOV = 'https://energovcss.miamibeachfl.gov/EnerGovProd/SelfService';
const SEARCH = 'https://energovcss.miamibeachfl.gov/energovprod/selfservice/api/energov/search/search';
const PARCELS = 'https://gis.miamibeachfl.gov/public/rest/services/gc/gc_Cadastral/MapServer/6/query';
const HEADERS = { accept: 'application/json', 'content-type': 'application/json;charset=UTF-8', tenantId: '3', tenantName: 'miamibeachflprod2', 'Tyler-TenantUrl': 'MiamiBeachFLProd', 'Tyler-Tenant-Culture': 'en-US', 'user-agent': 'DavidSuarezResidentHub/1.0 (+https://github.com/joebasrawi/david-suarez-mb)' };
const SINCE = '2023-01-01T00:00:00.000Z';
const BOARDS = {
  'ad310bc0-83e2-429e-88f9-c6a40af1f8a2': 'Planning Board',
  '19b67a65-a013-49df-a82d-b13b8b8dfb24': 'Design Review Board',
  'b991ce2c-2a58-46bf-8d75-fdcab5c3b5a7': 'Historic Preservation Board'
};
const KEEP_WORKCLASS = new Set(['DRB Approval', 'HPB Approval', 'Conditional Use', 'Map Amendment', 'FLUM (Small Scale)', 'FLUM (Large Scale)', 'Modification of Board Approval']);
const DEAD = new Set(['Void', 'Withdrawn', 'Abandoned']);
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };

const STRONG_NEW = /new [\w() -]{0,30}(\d+|\w+)[- ]?\(?\d*\)?[- ]stor(y|ies)|construction of (a|an) new|new construction|ground[- ]up|new (multi[- ]family|mixed[- ]use|hotel|commercial|office|residential|apartment|townhome|building|tower|structure)|townhome (project|development)|multi[- ]family|mixed[- ]use (building|development)|exceeding 50,000|over 50,000|redevelopment|total demolition/i;
const MAJOR_RENO = /substantial demolition|partial demolition[\w ,]{0,80}(addition|renovation)|(renovation|rehabilitation)[\w ,]{0,60}(addition|expansion)|ground floor and rooftop additions|vertical addition/i;
const NOT_DEVELOPMENT = /single[- ]family|\bresidence\b|fa[cç]ade|exterior (design )?modifications|hanging sign|\bsign(age)?\b|pergola|trellis|canopy structure|roof (deck|terrace)|mansard|padel|pickleball|kiosk|art in public places|\baipp\b|mural|\bdeck\b|shoring|outdoor (dining|seating|bar)|landscap|lighting|parking lifts|after[- ]the[- ]fact/i;

function stories(text) {
  const vals = [...String(text).matchAll(new RegExp(`\\b(\\d{1,2}|${Object.keys(WORDS).join('|')})\\s*[- ]?\\(?\\d*\\)?[- ]stor(?:y|ies)`, 'gi'))]
    .map(m => (/^\d+$/.test(m[1]) ? Number(m[1]) : WORDS[m[1].toLowerCase()]));
  return vals.length ? Math.max(...vals) : null;
}

function classify(c) {
  const wc = (c.CaseWorkclass || '').trim();
  const d = c.Description || '';
  if (!KEEP_WORKCLASS.has(wc) || DEAD.has(c.CaseStatus)) return null;
  if (/Map Amendment|FLUM/.test(wc)) return 'rezoning';
  const st = stories(d);
  const multi = /multi[- ]family|hotel|mixed[- ]use|commercial|office|townhome|apartment|condominium/i.test(d);
  if (/single[- ]family|\bresidence\b|\b(new |residential )home\b|\bhome\b/i.test(d) && !multi) return null;
  if (NOT_DEVELOPMENT.test(d) && !multi && !(st >= 3)) return null;
  if (/padel|pickleball|installation of|public art|sculpture|entry canopy|thoughtful renovations|restoration of the existing/i.test(d) && !multi) return null;
  if (!d.trim()) return null;
  if (STRONG_NEW.test(d) && !(st && st <= 2 && !multi)) return 'new';
  if (MAJOR_RENO.test(d) && multi) return 'major';
  if (NOT_DEVELOPMENT.test(d)) return null;
  return null;
}

async function search(typeId, page) {
  const body = {
    Keyword: '', ExactMatch: false, SearchModule: 3, FilterModule: 1, SearchMainAddress: false, PageNumber: page, PageSize: 100, SortBy: 'ApplyDate', SortAscending: false,
    PlanCriteria: { PlanNumber: null, PlanTypeId: typeId, PlanWorkclassId: null, PlanStatusId: 'none', ProjectName: null, ApplyDateFrom: SINCE, ApplyDateTo: null, ExpireDateFrom: null, ExpireDateTo: null, CompleteDateFrom: null, CompleteDateTo: null, Address: null, Description: null, SearchMainAddress: false, ContactId: null, ParcelNumber: null, TypeId: null, WorkClassIds: null, ExcludeCases: null, EnableDescriptionSearch: false, PageNumber: page, PageSize: 100, SortBy: 'ApplyDate', SortAscending: false },
    PermitCriteria: {}, InspectionCriteria: {}, CodeCaseCriteria: {}, RequestCriteria: {}, BusinessLicenseCriteria: {}, ProfessionalLicenseCriteria: {}, LicenseCriteria: {}, ProjectCriteria: {}
  };
  const response = await fetch(SEARCH, { method: 'POST', headers: HEADERS, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`Civic Access search returned HTTP ${response.status}`);
  const data = await response.json();
  if (!data.Success || !data.Result) throw new Error('Civic Access search returned no result');
  return data.Result;
}

const cases = [];
for (const [typeId, board] of Object.entries(BOARDS)) {
  for (let page = 1; page <= 20; page++) {
    const result = await search(typeId, page);
    for (const c of result.EntityResults || []) cases.push({ ...c, board });
    if (page >= (result.TotalPages || 1)) break;
  }
}
if (cases.length < 200) throw new Error(`Expected hundreds of land use board cases, found ${cases.length}.`);

// Group kept cases by parcel (one project usually has several cases).
const groups = new Map();
for (const c of cases) {
  const kind = classify(c);
  if (!kind) continue;
  const folio = /^\d{13}$/.test(c.MainParcel || '') ? c.MainParcel : null;
  const key = folio || `case:${c.CaseNumber}`;
  if (!groups.has(key)) groups.set(key, { folio, cases: [] });
  groups.get(key).cases.push({ ...c, kind });
}

// Live Local sites stay on their own layer.
const liveLocal = JSON.parse(await readFile(path.join(ROOT, 'data/live-local.json'), 'utf8').catch(() => '{"applications":[]}'));
const liveFolios = new Set(liveLocal.applications.flatMap(a => a.sites.map(s => s.folio)));

async function parcels(folios) {
  if (!folios.length) return [];
  const out = [];
  for (let i = 0; i < folios.length; i += 80) {
    const url = new URL(PARCELS);
    url.search = new URLSearchParams({ where: `FOLIO IN (${folios.slice(i, i + 80).map(f => `'${f}'`).join(',')})`, outFields: 'FOLIO,TRUE_SITE_ADDR,TRUE_OWNER1,TRUE_OWNER2,LOT_SIZE,YEAR_BUILT,FLOOR_COUNT,DOR_DESC', returnGeometry: 'true', outSR: '4326', geometryPrecision: '6', f: 'geojson' });
    out.push(...((await fetchJson(url)).features || []));
  }
  return out;
}
const parcelFeatures = await parcels([...groups.values()].map(g => g.folio).filter(Boolean));
const byFolio = new Map(parcelFeatures.map(f => [f.properties.FOLIO, f]));

const ring = g => (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]);
const centroid = g => { const r = ring(g); return [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length].map(n => +n.toFixed(6)); };
const toDate = v => (v ? String(v).slice(0, 10) : null);
const title = s => cleanText(s).toLowerCase().replace(/\b\w/g, m => m.toUpperCase()).replace(/\bFl\b.*$/, '').replace(/\s+/g, ' ').trim();
const STATUS_RANK = { 'Under Review': 3, 'On Hold': 2, Approved: 4, Complete: 4, Denied: 1 };
const KIND_RANK = { new: 3, major: 2, rezoning: 1 };

// Neighborhood comparison from the County LiDAR footprints written by sync-live-local.
const buildings = JSON.parse(await readFile(path.join(ROOT, 'data/mb-buildings.json'), 'utf8').catch(() => '{"features":[]}')).features
  .map(b => ({ c: centroid(b.geometry), h: b.properties.h, a: b.properties.a || null }));
const meters = (a, b) => { const R = 6371000, k = Math.PI / 180, dLat = (b[1] - a[1]) * k, dLng = (b[0] - a[0]) * k; return 2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * k) * Math.cos(b[1] * k) * Math.sin(dLng / 2) ** 2)); };
const median = xs => { const s = [...xs].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

const projects = [];
const features = [];
for (const [key, g] of groups) {
  if (g.folio && liveFolios.has(g.folio)) continue;
  const parcel = g.folio ? byFolio.get(g.folio) : null;
  if (!parcel) continue; // no map location
  // Single-family lots stay out unless the cases describe multi-family, hotel or commercial work.
  if (/SINGLE FAMILY/i.test(parcel.properties.DOR_DESC || '') && !g.cases.some(c => /multi[- ]family|hotel|mixed[- ]use|commercial|townhome|apartment/i.test(c.Description || ''))) continue;
  g.cases.sort((a, b) => (b.ApplyDate || '').localeCompare(a.ApplyDate || ''));
  const lead = [...g.cases].sort((a, b) => KIND_RANK[b.kind] - KIND_RANK[a.kind] || (b.ApplyDate || '').localeCompare(a.ApplyDate || ''))[0];
  const st = Math.max(0, ...g.cases.map(c => stories(c.Description) || 0)) || null;
  const statuses = g.cases.map(c => c.CaseStatus);
  const status = statuses.includes('Under Review') || statuses.includes('On Hold') ? (statuses.includes('Under Review') ? 'Under Review' : 'On Hold') : statuses.includes('Denied') && !statuses.some(s => s === 'Approved' || s === 'Complete') ? 'Denied' : 'Approved';
  const stage = status === 'Approved' ? 'approved' : status === 'Denied' ? 'denied' : 'review';
  const center = centroid(parcel.geometry);
  const heightFt = st ? Math.round((st * 10.5) / 5) * 5 : null;
  const near = buildings.filter(b => b.h > 0).map(b => ({ ...b, d: meters(center, b.c) })).filter(b => b.d > 25);
  const q = near.filter(b => b.d <= 402);
  const top = xs => xs.reduce((m, b) => (b.h > (m?.h || 0) ? b : m), null);
  const owner = [parcel.properties.TRUE_OWNER1, parcel.properties.TRUE_OWNER2].filter(Boolean).map(cleanText).join(' ').replace(/\s+C\/O\b.*$/i, '').trim();
  const id = lead.CaseNumber;
  projects.push({
    id, kind: lead.kind, stage, status, stories: st, heightFt,
    location: title(parcel.properties.TRUE_SITE_ADDR || lead.AddressDisplay || ''),
    folio: g.folio, owner: /REFERENCE ONLY/i.test(owner) ? null : owner || null,
    lotSize: parcel.properties.LOT_SIZE || null,
    existing: { yearBuilt: parcel.properties.YEAR_BUILT || null, floors: parcel.properties.FLOOR_COUNT || null },
    summary: cleanText(lead.Description).replace(/^[A-Z]{2,3}\d{2}-\d{4}(\s*a\.k\.a\.[^,]+)?,\s*[^.]+\.\s*/i, '').replace(/\s+NEW CONSTRUCTION\s*-.*$/, '').slice(0, 420),
    filed: toDate(g.cases[g.cases.length - 1].ApplyDate),
    updated: toDate(g.cases[0].ApplyDate),
    boards: [...new Set(g.cases.map(c => c.board))],
    cases: g.cases.map(c => ({ number: c.CaseNumber, board: c.board, type: (c.CaseWorkclass || '').trim(), status: c.CaseStatus, filed: toDate(c.ApplyDate), link: `${ENERGOV}#/plan/${c.CaseId}?tab=attachments` })),
    center,
    compare: heightFt ? { quarterMile: { tallest: top(q) ? { ft: top(q).h, address: top(q).a } : null, typicalFt: median(q.map(b => b.h)), taller: q.filter(b => b.h > heightFt).length } } : null
  });
  features.push({ type: 'Feature', properties: { id, stage, kind: lead.kind, stories: st }, geometry: parcel.geometry });
}

projects.sort((a, b) => (b.stories || 0) - (a.stories || 0) || (b.updated || '').localeCompare(a.updated || ''));
await writeSnapshot('data/development.json', {
  generatedAt: isoNow(),
  since: SINCE.slice(0, 10),
  source: { label: 'City of Miami Beach Civic Access (Design Review Board, Historic Preservation Board and Planning Board cases) and City parcel layer', urls: [ENERGOV, PARCELS.replace('/query', '')] },
  counts: { total: projects.length, new: projects.filter(p => p.kind === 'new').length, major: projects.filter(p => p.kind === 'major').length, rezoning: projects.filter(p => p.kind === 'rezoning').length, review: projects.filter(p => p.stage === 'review').length },
  projects,
  parcels: { type: 'FeatureCollection', features }
});
console.log(`Development: ${projects.length} projects from ${cases.length} board cases since ${SINCE.slice(0, 10)}.`);
