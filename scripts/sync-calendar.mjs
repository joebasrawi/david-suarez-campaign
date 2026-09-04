import { cleanText, fetchText, isoNow, writeSnapshot } from './lib.mjs';

const FEED_URL = 'https://events.miamibeachfl.gov/events/month/?ical=1';
const CALENDAR_URL = 'https://events.miamibeachfl.gov/City%20Meetings/';

function unfold(value) {
  return value.replace(/\r?\n[ \t]/g, '');
}

function field(block, name) {
  const line = block.split(/\r?\n/).find(item => item.startsWith(`${name}:`) || item.startsWith(`${name};`));
  return line ? line.slice(line.indexOf(':') + 1).trim() : '';
}

function unescape(value) {
  return cleanText(value
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\'));
}

function localDate(value) {
  if (/^\d{8}T\d{6}Z$/.test(value)) return new Date(value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z')).toISOString();
  if (/^\d{8}T\d{6}$/.test(value)) return value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3T$4:$5:$6');
  if (/^\d{8}$/.test(value)) return value.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
  return value;
}

const ics = unfold(await fetchText(FEED_URL));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const items = [...ics.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)\r?\nEND:VEVENT/g)]
  .map(([, event]) => ({
    id: field(event, 'UID'),
    title: unescape(field(event, 'SUMMARY')),
    description: unescape(field(event, 'DESCRIPTION')),
    startLocal: localDate(field(event, 'DTSTART')),
    endLocal: localDate(field(event, 'DTEND')),
    location: unescape(field(event, 'LOCATION')),
    category: unescape(field(event, 'CATEGORIES')),
    url: field(event, 'URL')
  }))
  .filter(item => item.category.toLowerCase().includes('city government'))
  .filter(item => item.startLocal.slice(0, 10) >= today)
  .sort((a, b) => a.startLocal.localeCompare(b.startLocal));

if (items.length < 1 || items.some(item => !item.id || !item.title || !item.startLocal || !item.url)) {
  throw new Error(`City calendar validation failed: received ${items.length} upcoming government events.`);
}

await writeSnapshot('data/city-calendar.json', {
  generatedAt: isoNow(),
  timezone: 'America/New_York',
  source: { label: 'City of Miami Beach Events Calendar', url: CALENDAR_URL, feedUrl: FEED_URL },
  items
});

console.log(`Synced ${items.length} upcoming City Government events.`);
