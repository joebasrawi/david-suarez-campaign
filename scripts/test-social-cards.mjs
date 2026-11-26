// Every shared link should preview its own page: its own image, a description and the right URL.
import {readFile,readdir,stat} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),SITE='https://davidsuarezmb.com/';
const skip=new Set(['node_modules','tmp','outputs','docs','sources','work','scripts','worker','.git','live-local']);
async function* pages(dir='',depth=0){
 for(const entry of await readdir(new URL(dir||'.',root),{withFileTypes:true})){
  if(depth===0&&skip.has(entry.name))continue;
  if(entry.isDirectory())yield* pages(dir+entry.name+'/',depth+1);
  else if(entry.name==='index.html')yield dir;
 }
}
const seen=new Map();let count=0;
for await(const route of pages()){
 const html=await readFile(new URL(route+'index.html',root),'utf8');
 if(html.includes('http-equiv="refresh"'))continue;
 count++;
 const get=key=>html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1];
 const image=get('og:image');
 assert.ok(image,`${route||'/'} has no og:image`);
 assert.equal(html.split('property="og:image"').length,2,`${route||'/'} has more than one og:image`);
 assert.equal(get('og:url'),SITE+route,`${route||'/'} og:url`);
 assert.ok(get('og:title'),`${route||'/'} has no og:title`);
 assert.ok(get('og:description'),`${route||'/'} has no og:description`);
 assert.equal(get('twitter:card'),'summary_large_image');
 assert.ok(get('og:image:alt'),`${route||'/'} has no image alt text`);
 const file=image.replace(SITE,'').split('?')[0];
 assert.match(image,/\?v=[a-f0-9]{10}$/,`${route||'/'} image URL needs a version so caches refresh`);
 assert.ok((await stat(new URL(file,root))).size>10000,`${file} is missing or empty`);
 if(route&&route!=='julia-tuttle-cleanup/'){
  assert.ok(file.startsWith('assets/social/'),`${route} still uses the generic preview image`);
  assert.ok(!seen.has(file),`${route} shares ${file} with ${seen.get(file)}`);
 }
 seen.set(file,route);
}
assert.ok(count>20,'expected to check every page');
console.log(`Link previews: ${count} pages each have their own image, description and URL.`);
