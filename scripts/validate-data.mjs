import { access, readFile } from 'node:fs/promises';
import { ROOT } from './lib.mjs';

const checks = [
  ['data/youtube.json', 5],
  ['data/city-calendar.json', 1],
  ['data/city-agenda.json', 100],
  ['data/city-news.json', 3],
  ['data/city-projects.json', 50],
  ['data/records-status.json', 2]
];

for (const [file, minimum] of checks) {
  const data = JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
  if (!data.generatedAt || !data.source?.url || !Array.isArray(data.items) || data.items.length < minimum) {
    throw new Error(`${file} failed validation.`);
  }
  console.log(`${file}: ${data.items.length} items`);
}

const agenda = JSON.parse(await readFile(new URL('../data/city-agenda.json', import.meta.url), 'utf8'));
if (!agenda.nextMeeting?.date || !agenda.nextMeeting?.officialAgendaUrl || agenda.nextMeeting.itemCount < 1) {
  throw new Error('data/city-agenda.json failed next-meeting validation.');
}
if (!Array.isArray(agenda.sections) || agenda.sections.length < 6 || agenda.sections.reduce((total, section) => total + section.count, 0) !== agenda.items.length) {
  throw new Error('data/city-agenda.json failed section validation.');
}

const commissioners = JSON.parse(await readFile(new URL('../data/commissioners.json', import.meta.url), 'utf8'));
const commissionerSlugs = new Set(commissioners.items.map(person => person.slug));
if (!commissioners.source?.url || commissioners.items.length !== 7) {
  throw new Error('data/commissioners.json failed roster validation.');
}
for (const person of commissioners.items) {
  if (!person.name || !person.profileUrl?.startsWith('https://www.miamibeachfl.gov/') || !person.portraitSource?.startsWith('https://www.miamibeachfl.gov/')) {
    throw new Error(`Official source validation failed for ${person.slug}.`);
  }
  await access(new URL(`../assets/commissioners/${person.portrait.split('/').at(-1)}`, import.meta.url));
}
for (const item of agenda.items) {
  if (!item.itemNumber || !item.officialTitle || !item.section || !item.officialSponsors.every(slug => commissionerSlugs.has(slug))) {
    throw new Error(`Agenda item validation failed for ${item.itemNumber || 'unknown item'}.`);
  }
}

console.log(`Validated public data in ${ROOT}.`);
