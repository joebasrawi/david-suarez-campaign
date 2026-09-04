import { readFile } from 'node:fs/promises';
import { ROOT } from './lib.mjs';

const checks = [
  ['data/youtube.json', 5],
  ['data/city-calendar.json', 1],
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

console.log(`Validated public data in ${ROOT}.`);
