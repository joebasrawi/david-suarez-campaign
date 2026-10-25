import assert from 'node:assert/strict';
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// Run the unmodified production sync in an isolated repository. All fetches are
// fixtures: this test never contacts YouTube or writes to the real snapshots.
const root = new URL('../', import.meta.url);
const temp = await mkdtemp(path.join(tmpdir(), 'suarez-youtube-test-'));
const channelId = 'UCFSRLFAu-wZdguhiP021UUA';
const channelUrl = 'https://www.youtube.com/@CommissionerDavidSuarez';
const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
const snapshotPath = path.join(temp, 'data/youtube.json');
const video = (id, title, publishedAt) => ({
  id, title, series: 'City Issues', publishedAt, updatedAt: publishedAt,
  url: `https://www.youtube.com/watch?v=${id}`,
  thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
});
const previous = {
  generatedAt: '2026-09-01T00:00:00.000Z',
  source: {label: 'Commissioner David Suarez on YouTube', url: channelUrl, feedUrl},
  channelId,
  items: [
    {...video('knownVid001', 'Previous title', '2026-09-01T12:00:00Z'), duration: '2:00'},
    video('oldVideo001', 'Older archive video', '2026-08-01T12:00:00Z')
  ]
};
const uploads = [
  video('newVideo004', 'New city update &amp; questions', '2026-10-25T12:00:00Z'),
  video('newVideo003', 'Ride Along: Street repair', '2026-10-24T12:00:00Z'),
  video('newVideo002', 'How government works', '2026-10-23T12:00:00Z'),
  video('newVideo001', 'Suarez Sound Off Ep. 007', '2026-10-22T12:00:00Z'),
  {...video('knownVid001', 'Updated title', '2026-09-01T12:00:00Z'), updatedAt: '2026-10-21T12:00:00Z'}
];
const feed = items => '<feed>' + items.map(item => `<entry>
  <yt:videoId>${item.id}</yt:videoId><title>${item.title}</title>
  <published>${item.publishedAt}</published><updated>${item.updatedAt}</updated>
</entry>`).join('') + '</feed>';
const readSnapshot = () => readFile(snapshotPath, 'utf8');
const seed = () => writeFile(snapshotPath, JSON.stringify(previous, null, 2) + '\n');

async function sync({body = feed(uploads), status = 200, archiveStatus = 200, now = '2026-10-25T16:00:00.000Z'} = {}) {
  await writeFile(path.join(temp, 'fixtures.json'), JSON.stringify({
    now,
    responses: {
      [feedUrl]: {status, body},
      [`${channelUrl}/videos`]: {status: archiveStatus, body: 'var ytInitialData = {"contents":{}};</script>'}
    }
  }));
  const result = spawnSync(process.execPath, [path.join(temp, 'run.mjs')], {encoding: 'utf8', timeout: 10000});
  if (result.error) throw result.error;
  const requests = JSON.parse(await readFile(path.join(temp, 'requests.json'), 'utf8'));
  assert.deepEqual(requests, result.status === 0 ? [feedUrl, `${channelUrl}/videos`] : [feedUrl], 'Only fixture URLs are requested');
  return result;
}

try {
  await mkdir(path.join(temp, 'scripts'));
  await mkdir(path.join(temp, 'data'));
  for (const file of ['lib.mjs', 'sync-youtube.mjs']) {
    await copyFile(new URL(`scripts/${file}`, root), path.join(temp, 'scripts', file));
  }
  await writeFile(path.join(temp, 'run.mjs'), `
import {readFile, writeFile} from 'node:fs/promises';
const fixture = JSON.parse(await readFile(new URL('./fixtures.json', import.meta.url), 'utf8'));
const NativeDate = Date;
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [fixture.now])); }
};
const requests = [];
globalThis.fetch = async url => {
  requests.push(String(url));
  const response = fixture.responses[String(url)];
  if (!response) throw new Error('Unexpected network request: ' + url);
  return {ok: response.status >= 200 && response.status < 300, status: response.status, text: async () => response.body};
};
try { await import('./scripts/sync-youtube.mjs'); }
finally { await writeFile(new URL('./requests.json', import.meta.url), JSON.stringify(requests)); }
`);

  await seed();
  let result = await sync();
  assert.equal(result.status, 0, result.stderr);
  const successfulBytes = await readSnapshot();
  const successful = JSON.parse(successfulBytes);
  assert.equal(successful.items.length, 6, 'RSS uploads merge with the saved archive');
  assert.equal(new Set(successful.items.map(item => item.id)).size, 6, 'Existing uploads are not duplicated');
  assert.equal(successful.items[0].id, 'newVideo004', 'The newest upload is first');
  assert.equal(successful.items[0].title, 'New city update & questions', 'Feed text is decoded');
  assert.equal(successful.items.at(-1).id, 'oldVideo001', 'Videos outside the RSS window remain available');
  assert.equal(successful.items.find(item => item.id === 'knownVid001').title, 'Updated title');
  assert.equal(successful.items.find(item => item.id === 'knownVid001').duration, '2:00', 'Archive metadata survives a feed update');
  assert.equal(successful.items.find(item => item.id === 'newVideo003').series, 'Ride Along');
  assert.equal(successful.items.find(item => item.id === 'newVideo002').series, 'Miami Beach Civics');
  assert.equal(successful.items.find(item => item.id === 'newVideo001').series, 'Suarez Sound Off');
  assert.equal(successful.generatedAt, '2026-10-25T16:00:00.000Z');

  result = await sync({now: '2026-10-26T16:00:00.000Z'});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readSnapshot(), successfulBytes, 'An identical refresh preserves bytes and generatedAt');

  for (const [name, options] of [
    ['HTTP 404', {status: 404}],
    ['empty feed', {body: '<feed></feed>'}],
    ['short feed', {body: feed(uploads.slice(0, 4))}],
    ['missing video ID', {body: feed(uploads.map((item, index) => index ? item : {...item, id: ''}))}],
    ['missing title', {body: feed(uploads.map((item, index) => index ? item : {...item, title: ''}))}]
  ]) {
    result = await sync(options);
    assert.notEqual(result.status, 0, `${name} must fail validation`);
    assert.match(result.stderr, /HTTP 404|YouTube feed validation failed/, name);
    assert.equal(await readSnapshot(), successfulBytes, `${name} retains the last good snapshot unchanged`);
  }

  await seed();
  result = await sync({archiveStatus: 503});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Channel archive discovery unavailable/);
  assert.equal(await readSnapshot(), successfulBytes, 'Archive discovery failure still publishes valid RSS updates and preserves history');
  console.log('YouTube sync tests passed: new uploads, archive merge, repeated refresh, invalid feeds, HTTP failure, and optional discovery failure (offline).');
} finally {
  await rm(temp, {recursive: true, force: true});
}
