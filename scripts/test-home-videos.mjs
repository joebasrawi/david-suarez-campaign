import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, mkdir, copyFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {HOME_VIDEO_SERIES, selectHomeVideos, renderHomeVideos} from '../home-videos.js';
import {homeLayout} from './home-layout.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const catalog = JSON.parse(await read('data/youtube.json')).items;
const summary = JSON.parse(await read('data/home-summary.json'));
const video = (id, series, publishedAt, title = 'A new video') => ({id, title, series, publishedAt});
const old = video('OLD_VIDEO_1', 'Suarez Sound Off', '2026-09-01T12:00:00Z');
const latest = video('NEW_VIDEO_1', 'City Issues', '2026-10-01T12:00:00Z', 'New issue | Full title');
const ride = video('NEW_RIDE__1', 'Ride Along', '2026-09-30T12:00:00Z');
const items = [old, latest, ride];
assert.equal(selectHomeVideos(items)[0], latest, 'Newest upload wins regardless of series or input order');
assert.deepEqual(items, [old, latest, ride], 'Selection does not mutate the source');
assert.equal(selectHomeVideos([...items].reverse())[0], latest);
assert.equal(selectHomeVideos([old, old]).length, 1, 'A featured series video is not duplicated');
assert.equal(selectHomeVideos([
  video('OFFSET____1', 'City Issues', '2026-10-01T09:00:00-07:00'), latest
])[0].id, 'OFFSET____1', 'Sort real instants, not timestamp strings');
for (const invalid of [undefined, null, {}, [], [null, {}, {...latest, id: 'bad'}, {...latest, title: ''}, {...latest, publishedAt: 'invalid'}]]) {
  assert.deepEqual(selectHomeVideos(invalid), []);
}
assert.deepEqual(summary.youtube.items, selectHomeVideos(catalog), 'The checked-in summary follows the current catalog');
for (const series of HOME_VIDEO_SERIES) {
  assert.equal(selectHomeVideos(catalog).find(item => item.series === series)?.id,
    [...catalog].filter(item => item.series === series).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0]?.id);
}

function harness() {
  const nodes = new Map();
  const root = {querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {textContent: 'Saved snapshot', innerHTML: '', src: 'saved.jpg', alt: 'Saved image', href: 'media/', complete: false, naturalWidth: 1280});
    return nodes.get(selector);
  }};
  return {root, nodes, get: selector => root.querySelector(selector)};
}
const h = harness();
renderHomeVideos(items, h.root);
assert.equal(h.get('#featured-title').textContent, latest.title, 'Non-series titles stay intact');
assert.equal(h.get('#featured-link').href, 'media/?video=' + latest.id);
assert.equal(h.get('#featured-date').textContent, 'October 1, 2026');
assert.equal(h.get('[data-video-series="Ride Along"] img').alt, ride.title);
const image = h.get('#featured-image');
assert.match(image.src, /NEW_VIDEO_1\/maxresdefault.jpg$/);
image.onerror();
assert.match(image.src, /NEW_VIDEO_1\/hqdefault.jpg$/);
image.onerror();
assert.match(image.src, /NEW_VIDEO_1\/hqdefault.jpg$/, 'A missing fallback does not loop');
const count = h.nodes.size;
renderHomeVideos(items, h.root);
assert.equal(h.nodes.size, count, 'Repeated renders reuse the existing cards');
assert.match(image.src, /hqdefault.jpg$/, 'Repeated renders do not retry a known missing high-resolution thumbnail');
const newer = {...latest, id: 'NEW_VIDEO_2', publishedAt: '2026-10-02T12:00:00Z', title: '<script>alert("x")</script>'};
renderHomeVideos([newer, ...items], h.root);
assert.equal(h.get('#featured-title').textContent, newer.title, 'Source titles are assigned as text');
assert.match(image.src, /NEW_VIDEO_2\/maxresdefault.jpg$/);
image.naturalWidth = 120;
image.onload();
assert.match(image.src, /NEW_VIDEO_2\/hqdefault.jpg$/, 'YouTube placeholder thumbnails fall back');
for (const invalid of [null, [], [{}]]) renderHomeVideos(invalid, h.root);
assert.equal(h.get('#featured-title').textContent, newer.title, 'Invalid refreshes retain the last usable card');
renderHomeVideos([old], h.root);
assert.equal(h.get('[data-video-series="Ride Along"] img').alt, ride.title, 'Missing series retain their fallback');

const markup = homeLayout([newer, ...items]);
assert.ok(markup.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'));
assert.ok(markup.includes('media/?video=NEW_VIDEO_2'));
assert.equal((markup.match(/class="series-card"/g) || []).length, 4, 'Keep the existing four series links');
assert.throws(() => homeLayout([]), /No usable YouTube videos/, 'A bad build cannot erase the fallback');

// Execute the actual homepage initialization with successful and failed fetches.
const homeCode = (await read('home.js')).replace(/^import .*\n/gm, '').split('// The local background film')[0];
for (const failure of [false, true]) {
  const page = harness();
  let ready;
  const finished = new Promise(resolve => { ready = resolve; });
  vm.runInNewContext(homeCode, {
    document: {...page.root, dispatchEvent: ready}, Event: class {}, console: {error() {}},
    json: async name => { assert.equal(name, 'home-summary'); if (failure) throw Error('HTTP 503'); return {youtube: {items}, agenda: null, news: null}; },
    renderHomeVideos: data => renderHomeVideos(data, page.root)
  });
  await finished;
  assert.equal(page.get('#featured-title').textContent, failure ? 'Saved snapshot' : latest.title);
  if (failure) assert.match(page.get('#official-updates').innerHTML, /Updates could not be loaded/);
}

// Run the production summary generator in an isolated copy; never rewrite real fixtures.
const dir = await mkdtemp(join(tmpdir(), 'suarez-home-videos-'));
try {
  await mkdir(join(dir, 'scripts'));
  await mkdir(join(dir, 'data'));
  for (const path of ['home-videos.js', 'scripts/lib.mjs', 'scripts/build-home-summary.mjs']) {
    await copyFile(new URL('../' + path, import.meta.url), join(dir, path));
  }
  await writeFile(join(dir, 'package.json'), '{"type":"module"}');
  const save = (name, data) => writeFile(join(dir, 'data', name + '.json'), JSON.stringify(data));
  await save('youtube', {items});
  await save('city-agenda', {nextMeeting: {date: '2026-10-14'}});
  await save('city-news', {items: []});
  await save('commission-actions', {items: []});
  const build = () => execFileSync(process.execPath, ['scripts/build-home-summary.mjs'], {cwd: dir});
  const output = () => readFile(join(dir, 'data/home-summary.json'), 'utf8');
  build();
  const first = await output();
  assert.equal(JSON.parse(first).youtube.items[0].id, latest.id);
  build();
  assert.equal(await output(), first, 'An unchanged sync leaves the generated timestamp and snapshot unchanged');
  await save('youtube', {items: [...items, newer]});
  build();
  assert.equal(JSON.parse(await output()).youtube.items[0].id, newer.id, 'A new upload advances the homepage summary automatically');
} finally { await rm(dir, {recursive: true, force: true}); }

console.log('Homepage video tests passed: newest uploads, series thumbnails, static fallback, failed/malformed/repeated refreshes, safe text, thumbnail fallback and summary generation.');
