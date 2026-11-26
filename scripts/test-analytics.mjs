// Every published page loads Cloudflare Web Analytics exactly once.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const root = new URL('../', import.meta.url);
const pages = execFileSync('git', ['ls-files', '*.html'], {cwd: root, encoding: 'utf8'}).split('\n').filter(f => f && (f.endsWith('index.html') || f === '404.html') && !f.startsWith('tmp/'));
assert.ok(pages.length > 20, 'found the published pages');
for (const page of pages) {
  const html = await readFile(new URL(page, root), 'utf8');
  const beacons = html.match(/static\.cloudflareinsights\.com\/beacon\.min\.js/g) || [];
  assert.equal(beacons.length, 1, `${page} loads the analytics beacon once`);
  assert.ok(html.includes('"token": "b9c3765864224c3a8eb5d020bfe7ef56"'), `${page} uses the site token`);
  assert.ok(html.indexOf('beacon.min.js') < html.indexOf('</head>'), `${page} has the beacon in <head>`);
}
console.log(`Analytics beacon on ${pages.length} pages.`);
