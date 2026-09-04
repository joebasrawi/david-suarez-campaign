import { cleanText, fetchJson, isoNow, writeSnapshot } from './lib.mjs';

const SITE_URL = 'https://www.miamibeachfl.gov/city-hall/communications/press-releases/';
const API_ROOT = 'https://www.miamibeachfl.gov/wp-json/wp/v2';
const year = Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'America/New_York' }).format(new Date()));
const categorySlug = `${year}-press-releases`;

const categories = await fetchJson(`${API_ROOT}/categories?slug=${categorySlug}&per_page=1`);
if (!Array.isArray(categories) || !categories[0]?.id) {
  throw new Error(`Could not find the official ${year} press release category.`);
}

const posts = await fetchJson(`${API_ROOT}/posts?categories=${categories[0].id}&per_page=10&orderby=date&order=desc&_fields=id,date,link,title,excerpt`);
const items = posts.map(post => ({
  id: String(post.id),
  title: cleanText(post.title?.rendered),
  summary: cleanText(post.excerpt?.rendered)
    .replace(/^Download Press Release Share:\s*/i, '')
    .replace(/\s*\[…\]$/u, ''),
  publishedAt: post.date,
  url: post.link,
  label: 'Official city news'
}));

if (items.length < 3 || items.some(item => !item.id || !item.title || !item.publishedAt || !item.url)) {
  throw new Error(`City news validation failed: received ${items.length} official posts.`);
}

await writeSnapshot('data/city-news.json', {
  generatedAt: isoNow(),
  timezone: 'America/New_York',
  source: { label: 'City of Miami Beach Press Releases', url: SITE_URL, apiUrl: API_ROOT },
  items
});

console.log(`Synced ${items.length} official City of Miami Beach news items.`);
