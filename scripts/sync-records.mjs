import { createHash } from 'node:crypto';
import { cleanText, fetchText, isoNow, writeSnapshot } from './lib.mjs';

const PUBLIC_RECORDS_URL = 'https://www.miamibeachfl.gov/egovapp/city-hall/cityclerkdepartment/public-records/';
const DIRECTORIES = {
  ordinances: 'https://docmgmt.miamibeachfl.gov/WebLink/Browse.aspx?id=61343&dbid=0&repo=CityClerk',
  resolutions: 'https://docmgmt.miamibeachfl.gov/WebLink/Browse.aspx?id=61344&dbid=0&repo=CityClerk'
};

function findRegistryUrl(html, type) {
  const links = [...html.matchAll(/href=["']([^"']+\.pdf)["']/gi)].map(match => match[1].replaceAll('&amp;', '&'));
  const result = links.find(link => link.toLowerCase().includes(type));
  if (!result) throw new Error(`Could not find the ${type} registry PDF.`);
  return new URL(result, PUBLIC_RECORDS_URL).toString();
}

function dateFromFilename(url) {
  const match = decodeURIComponent(url).match(/(?:to|-)(January|February|March|April|May|June|July|August|September|October|November|December)-(\d{1,2})-(\d{4})\.pdf/i);
  if (!match) return null;
  const [, month, day, year] = match;
  const parsed = new Date(`${month} ${day}, ${year} 12:00:00 UTC`);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10);
}

async function inspectPdf(type, url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`${type} registry returned HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 10_000 || bytes.subarray(0, 4).toString() !== '%PDF') throw new Error(`${type} registry is not a valid PDF.`);
  return {
    type,
    currentThrough: dateFromFilename(url),
    registryPdf: url,
    recordsDirectory: DIRECTORIES[type],
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    sourceLastModified: response.headers.get('last-modified')
  };
}

const html = await fetchText(PUBLIC_RECORDS_URL);
const items = await Promise.all([
  inspectPdf('ordinances', findRegistryUrl(html, 'ordinance')),
  inspectPdf('resolutions', findRegistryUrl(html, 'resolution'))
]);

if (items.some(item => !item.currentThrough || !item.registryPdf || !item.sha256)) {
  throw new Error('City Clerk registry validation failed.');
}

await writeSnapshot('data/records-status.json', {
  generatedAt: isoNow(),
  source: { label: 'City of Miami Beach Public Records', url: PUBLIC_RECORDS_URL },
  note: 'Registry changes are detected automatically. Resident-facing summaries require human verification against the official record before publication.',
  items
});

console.log(`Verified ${items.length} City Clerk registry files.`);
