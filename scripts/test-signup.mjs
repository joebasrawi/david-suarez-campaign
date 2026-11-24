import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {handle, validate} from '../worker/src/index.js';
import {SIGNUP_ENDPOINT} from './home-layout.mjs';
import {spanish} from '../locales/es.js';
const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');

// Homepage section: present, labelled, hidden until the Worker URL is set, and translated.
const html = await read('index.html');
const section = html.match(/<section class="home-signup"[^]*?<\/section>/)?.[0];
assert.ok(section, 'homepage has the Stay informed section');
assert.ok(section.includes('<h2 id="signup-title">Stay informed</h2>'));
for (const name of ['firstName', 'lastName', 'email', 'phone', 'website']) assert.ok(section.includes(`name="${name}"`), `field ${name}`);
assert.equal(section.includes(' hidden>'), !SIGNUP_ENDPOINT, 'hidden exactly when no endpoint is set');
assert.ok(html.indexOf('home-signup') < html.indexOf('home-contact'), 'signup sits above the office contact');
const home = await read('home.js');
const copy = [...section.matchAll(/>([^<>]+)</g), ...home.slice(home.indexOf('function initSignup')).matchAll(/'([A-Z][^']+[.…])'/g)].map(m => m[1].trim()).filter(Boolean);
for (const text of copy) if (!['Website'].includes(text)) assert.ok(spanish[text], `Spanish for "${text}"`);

// Popup: opens once after a delay, stays away after closing (14 days) or signing up, and clones the same form.
assert.ok(home.includes('dialog.showModal()'), 'popup uses a modal dialog');
assert.ok(home.includes('14*864e5'), 'closing the popup snoozes it for 14 days');
assert.ok(home.includes("remember({signedUp:true})"), 'signing up stops the popup for good');
assert.ok(home.includes("section.querySelector('form').cloneNode(true)"), 'popup reuses the section form');
assert.ok(spanish['Close'], 'Spanish for the close button');

// Every page with the main menu has the Stay informed link, pointing at the homepage section.
const pages = execFileSync('git', ['ls-files', '*.html'], {cwd: new URL('.', root)}).toString().trim().split('\n');
for (const page of pages) {
  const text = await read(page);
  if (!text.includes('id="hub-nav"')) continue;
  const depth = page.split('/').length - 1;
  assert.ok(text.includes(`<a class="nav-signup" href="${page === '404.html' ? '/' : depth ? '../'.repeat(depth) : './'}#stay-informed" data-signup-open>Stay informed</a>`), `${page}: Stay informed menu link`);
}
assert.ok(home.includes("location.hash==='#stay-informed'"), 'arriving at /#stay-informed opens the popup');

// Validation.
assert.deepEqual(validate({firstName: ' Ana ', email: 'ANA@Example.com '}).signup, {firstName: 'Ana', lastName: '', email: 'ana@example.com', phone: ''});
assert.equal(validate({firstName: '', email: 'a@b.co'}).error, 'first_name');
assert.equal(validate({firstName: 'A', email: 'nope'}).error, 'email');
assert.equal(validate({firstName: 'A', email: 'a@b.co', phone: '12345'}).error, 'phone');
assert.equal(validate({firstName: 'A', email: 'a@b.co', phone: '(305) 555-0100'}).signup.phone, '(305) 555-0100');

// Worker against a fake iContact.
const env = {ALLOWED_ORIGINS: 'https://davidsuarezmb.com', ICONTACT_ACCOUNT_ID: '11', ICONTACT_FOLDER_ID: '22', ICONTACT_LIST_ID: '33', ICONTACT_APP_ID: 'app', ICONTACT_USERNAME: 'user', ICONTACT_PASSWORD: 'pass'};
const post = (body, origin = 'https://davidsuarezmb.com') => new Request('https://worker.test/', {method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin}, body: JSON.stringify(body)});
function fakeIcontact(fail) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({url, init, body: JSON.parse(init.body)});
    if (fail) return new Response('{"errors":["nope"]}', {status: 500});
    return Response.json(url.endsWith('/contacts') ? {contacts: [{contactId: '777'}]} : {subscriptions: [{}]});
  };
  return {calls, impl};
}

let api = fakeIcontact();
let res = await handle(post({firstName: 'Ana', lastName: 'Diaz', email: 'ana@example.com', phone: '305-555-0100'}), env, api.impl);
assert.equal(res.status, 200);
assert.deepEqual(await res.json(), {ok: true});
assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://davidsuarezmb.com');
assert.equal(api.calls.length, 2);
assert.equal(api.calls[0].url, 'https://app.icontact.com/icp/a/11/c/22/contacts');
assert.deepEqual(api.calls[0].body, [{email: 'ana@example.com', firstName: 'Ana', lastName: 'Diaz', phone: '305-555-0100'}]);
assert.equal(api.calls[0].init.headers['API-Version'], '2.2');
assert.equal(api.calls[0].init.headers['API-Password'], 'pass');
assert.equal(api.calls[1].url, 'https://app.icontact.com/icp/a/11/c/22/subscriptions');
assert.deepEqual(api.calls[1].body, [{contactId: '777', listId: '33', status: 'normal'}]);

api = fakeIcontact();
res = await handle(post({firstName: 'Ana', email: 'ana@example.com'}, 'https://evil.example'), env, api.impl);
assert.equal(res.status, 403); assert.equal(api.calls.length, 0, 'other origins never reach iContact');

res = await handle(post({firstName: 'Bot', email: 'bot@example.com', website: 'spam.biz'}), env, api.impl);
assert.equal(res.status, 200); assert.equal(api.calls.length, 0, 'honeypot drops bots quietly');

res = await handle(post({firstName: 'Ana', email: 'bad'}), env, api.impl);
assert.equal(res.status, 400); assert.equal((await res.json()).error, 'email');

res = await handle(new Request('https://worker.test/', {method: 'OPTIONS', headers: {Origin: 'https://davidsuarezmb.com'}}), env, api.impl);
assert.equal(res.status, 204); assert.equal(res.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');

const failing = fakeIcontact(true), quiet = console.error; console.error = () => {};
res = await handle(post({firstName: 'Ana', email: 'ana@example.com'}), env, failing.impl);
console.error = quiet;
assert.equal(res.status, 502); assert.equal((await res.json()).error, 'upstream');

console.log('Stay informed signup checks passed.');
