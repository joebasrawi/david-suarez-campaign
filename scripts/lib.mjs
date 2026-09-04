import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');

export async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'DavidSuarezResidentHub/1.0 (+https://github.com/joebasrawi/david-suarez-campaign)' },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

export async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

export async function writeJson(relativePath, value) {
  const outputPath = path.join(ROOT, relativePath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function writeSnapshot(relativePath, value) {
  const outputPath = path.join(ROOT, relativePath);
  try {
    const previous = JSON.parse(await readFile(outputPath, 'utf8'));
    const previousComparable = { ...previous, generatedAt: null };
    const nextComparable = { ...value, generatedAt: null };
    if (JSON.stringify(previousComparable) === JSON.stringify(nextComparable)) return false;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await writeJson(relativePath, value);
  return true;
}

export function cleanText(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

export function isoNow() {
  return new Date().toISOString();
}
