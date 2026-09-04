import { readFile } from 'node:fs/promises';
import { cleanText, fetchText, isoNow, writeSnapshot } from './lib.mjs';

const NAVIGATOR_URL = 'https://miamibeachagenda.com/';
const commissioners = JSON.parse(await readFile(new URL('../data/commissioners.json', import.meta.url), 'utf8'));
const officialByAlias = new Map(
  commissioners.items.flatMap(person => person.aliases.map(alias => [alias.toLowerCase(), person]))
);

function decode(value = '') {
  return cleanText(value
    .replaceAll('&amp;quot;', '"')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&nbsp;', ' '));
}

function normalizeAcronyms(value = '') {
  return value.replace(/\b(Fdle|Lpr|Far|Ldr|Fdot|Rfp|Rfq|Cpi|Ada|Ai)\b/g, word => word.toUpperCase());
}

function meetingDateFromUrl(url) {
  const match = url.match(/\/agenda\/([^/]+)\/(\d{1,2})\/(\d{4})/i);
  if (!match) return '';
  const month = new Date(`${match[1]} 1, 2000`).getMonth() + 1;
  return `${match[3]}-${String(month).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`;
}

function normalizeSection(value) {
  return decode(value)
    .replace(/\s*\/\/\s*/g, ' — ')
    .replace(/^(Consent Agenda|Regular Agenda)\s+(?!(?:—|$))/, '$1 — ')
    .replace(/\s*—\s*—\s*/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim();
}

function itemType(itemNumber) {
  if (/^R5/i.test(itemNumber)) return 'Ordinance';
  if (/^(C7|R7)/i.test(itemNumber)) return 'Resolution';
  if (/^C2/i.test(itemNumber)) return 'Competitive bid report';
  if (/^C4/i.test(itemNumber)) return 'Committee assignment';
  if (/^C6/i.test(itemNumber)) return 'Committee report';
  return 'Commission item';
}

function residentSummary(title, type) {
  return `${title.replace(/[.!?]+$/, '')}. Open the official record for complete legal language, attachments, and fiscal details.`;
}

const indexHtml = await fetchText(NAVIGATOR_URL);
const nextSection = indexHtml.match(/<!-- Next Meeting Section -->([\s\S]*?)<\/section>/i)?.[1] || '';
const agendaUrl = nextSection.match(/href="(https:\/\/miamibeachagenda\.com\/agenda\/[^"]+)"/i)?.[1];
const meetingDate = meetingDateFromUrl(agendaUrl || '');

if (!agendaUrl || !meetingDate) {
  throw new Error('Could not identify the next Miami Beach City Commission agenda.');
}

const agendaHtml = await fetchText(agendaUrl);
const officialAgendaUrl = agendaHtml.match(/href="(https:\/\/miamibeachfl\.primegov\.com\/Portal\/Meeting\?[^\"]+)"[^>]*>View original agenda/i)?.[1];
const pageItemCount = Number(agendaHtml.match(/id="agenda-count"[^>]*>([\d,]+)<\/span>/i)?.[1]?.replaceAll(',', ''));
if (!officialAgendaUrl) throw new Error('Next commission agenda is missing its official PrimeGov source link.');

const sections = [];
const items = [];
const sectionMatches = [...agendaHtml.matchAll(/<h2 class="agenda-section-header"[^>]*>([\s\S]*?)<\/h2>[\s\S]*?<section class="cards agenda-grid"[^>]*>([\s\S]*?)<\/section>/gi)];

for (const [, sectionHeading, sectionBlock] of sectionMatches) {
  const section = normalizeSection(sectionHeading);
  const sectionItems = [...sectionBlock.matchAll(/<article class="card" id="item-([^"]+)"\s+data-sponsors="([^"]*)"[\s\S]*?<\/article>/gi)]
    .map(match => {
      const [, itemNumber] = match;
      const block = match[0];
      const sponsors = [...block.matchAll(/sponsor-caption">([^<]+)<\/span>/gi)].map(result => decode(result[1]));
      const officialSponsors = sponsors
        .map(sponsor => officialByAlias.get(sponsor.toLowerCase()))
        .filter(Boolean)
        .map(person => person.slug)
        .filter((slug, index, all) => all.indexOf(slug) === index);
      const departments = sponsors.filter(sponsor => !officialByAlias.has(sponsor.toLowerCase()));
      const officialTitle = decode(block.match(/original-title-display card-title-text">([\s\S]*?)<\/div>/i)?.[1]);
      const title = normalizeAcronyms(decode(block.match(/card-ai-summary">([\s\S]*?)<\/div>/i)?.[1]) || officialTitle);
      const status = decode(block.match(/card-status-alert">([\s\S]*?)<\/div>/i)?.[1]) || 'On upcoming agenda';
      const url = block.match(/<a href="([^"]+)" class="card-item-link"/i)?.[1] || agendaUrl;
      const metadata = [...block.matchAll(/<span class="[^"]*badge-meta[^"]*">([\s\S]*?)<\/span>/gi)].map(result => decode(result[1]));
      const hearingTime = metadata.find(value => /\b\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.)/i.test(value)) || '';
      const neighborhood = metadata.find(value => /^(Citywide|South Beach|Middle Beach|Mid Beach|North Beach)$/i.test(value)) || 'Citywide';
      const type = itemType(itemNumber);
      return {
        id: `${meetingDate}-${section.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${itemNumber.toLowerCase()}`,
        itemNumber,
        type,
        section,
        title: /^(?:C|R)\d+\s*[A-Z]{1,3}$/i.test(title) ? officialTitle.slice(0,180) : title,
        summary: residentSummary(title, type),
        officialTitle,
        status,
        meetingDate,
        hearingTime,
        neighborhood,
        departments,
        sponsors,
        officialSponsors,
        davidInvolved: officialSponsors.includes('david-suarez'),
        isNew: /data-is-new="true"/i.test(block),
        url
      };
    });

  sections.push({ id: section.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), label: section, count: sectionItems.length });
  items.push(...sectionItems);
}

const itemCount = Number.isFinite(pageItemCount) && pageItemCount > 0 ? pageItemCount : items.length;
if (items.length < 100 || itemCount !== items.length) {
  throw new Error(`Agenda parsing mismatch: page reports ${itemCount} items and ${items.length} were parsed.`);
}

await writeSnapshot('data/city-agenda.json', {
  generatedAt: isoNow(),
  timezone: 'America/New_York',
  source: {
    label: 'Miami Beach Agenda navigator',
    url: NAVIGATOR_URL,
    note: 'Resident-friendly navigation layer. The official PrimeGov agenda remains the legal source.'
  },
  nextMeeting: {
    type: 'City Commission',
    date: meetingDate,
    location: 'City Hall Commission Chamber, 1700 Convention Center Drive, Miami Beach, FL 33139',
    itemCount,
    url: agendaUrl,
    officialAgendaUrl
  },
  sections,
  items
});

const davidCount = items.filter(item => item.davidInvolved).length;
console.log(`Synced the ${meetingDate} commission agenda with ${itemCount} items; ${davidCount} list David Suarez as sponsor or co-sponsor.`);
