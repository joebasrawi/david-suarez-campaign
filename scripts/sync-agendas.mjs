import { cleanText, fetchText, isoNow, writeSnapshot } from './lib.mjs';

const NAVIGATOR_URL = 'https://miamibeachagenda.com/';

function decode(value = '') {
  return cleanText(value
    .replaceAll('&amp;quot;', '"')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&nbsp;', ' '));
}

function normalizeAcronyms(value = '') {
  return value.replace(/\b(Fdle|Lpr|Far|Ldr)\b/g, word => word.toUpperCase());
}

function meetingDateFromUrl(url) {
  const match = url.match(/\/agenda\/([^/]+)\/(\d{1,2})\/(\d{4})/i);
  if (!match) return '';
  const month = new Date(`${match[1]} 1, 2000`).getMonth() + 1;
  return `${match[3]}-${String(month).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`;
}

const indexHtml = await fetchText(NAVIGATOR_URL);
const nextSection = indexHtml.match(/<!-- Next Meeting Section -->([\s\S]*?)<\/section>/i)?.[1] || '';
const agendaUrl = nextSection.match(/href="(https:\/\/miamibeachagenda\.com\/agenda\/[^"]+)"/i)?.[1];
const itemCount = Number(nextSection.match(/([\d,]+)\s+agenda items/i)?.[1]?.replaceAll(',', ''));
const meetingDate = meetingDateFromUrl(agendaUrl || '');

if (!agendaUrl || !meetingDate || !Number.isFinite(itemCount) || itemCount < 1) {
  throw new Error('Could not identify the next Miami Beach City Commission agenda.');
}

const agendaHtml = await fetchText(agendaUrl);
const officialAgendaUrl = agendaHtml.match(/href="(https:\/\/miamibeachfl\.primegov\.com\/Portal\/Meeting\?[^\"]+)"[^>]*>View original agenda/i)?.[1];
if (!officialAgendaUrl) throw new Error('Next commission agenda is missing its official PrimeGov source link.');

const items = [...agendaHtml.matchAll(/<article class="card" id="item-([^"]+)"\s+data-sponsors="([^"]*)"[\s\S]*?<\/article>/gi)]
  .filter(([, , sponsors]) => decode(sponsors).includes('Commissioner David Suarez'))
  .map(match => {
    const [, itemNumber] = match;
    const block = match[0];
    const sponsors = [...block.matchAll(/sponsor-caption">([^<]+)<\/span>/gi)].map(match => decode(match[1]));
    const officialTitle = decode(block.match(/original-title-display card-title-text">([\s\S]*?)<\/div>/i)?.[1]);
    const plainTitle = normalizeAcronyms(decode(block.match(/card-ai-summary">([\s\S]*?)<\/div>/i)?.[1]) || officialTitle);
    const status = decode(block.match(/card-status-alert">([\s\S]*?)<\/div>/i)?.[1]) || 'On upcoming agenda';
    const url = block.match(/<a href="([^"]+)" class="card-item-link"/i)?.[1] || agendaUrl;
    return {
      id: `${meetingDate}-${itemNumber.toLowerCase()}`,
      itemNumber,
      type: /^R5/i.test(itemNumber) ? 'Ordinance' : /^(C7|R7)/i.test(itemNumber) ? 'Resolution' : 'Commission item',
      title: plainTitle,
      officialTitle,
      status,
      meetingDate,
      sponsors,
      davidRole: 'Sponsor or co-sponsor',
      url
    };
  });

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
    itemCount,
    url: agendaUrl,
    officialAgendaUrl
  },
  items
});

console.log(`Synced the ${meetingDate} commission agenda with ${itemCount} items; ${items.length} list David Suarez as sponsor or co-sponsor.`);
