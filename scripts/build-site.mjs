// Static page assembly: shared navigation, accessible fallbacks and page metadata.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {addLoadingShells} from './ui-shells.mjs';
import {homeLayout} from './home-layout.mjs';
import {aboutLayout, commissionLayout, directoryLayout, projectsLayout} from './editorial-layouts.mjs';
const root = new URL('../',import.meta.url);
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function header(route) {
 const b=route?'../':'./';
 const link=(slug,label)=>`<a href="${b}${slug}/"${route===slug?' aria-current="page"':''}>${label}</a>`;
 const city=['meetings','commission-agenda','commission-actions','legislation','news','commission'].includes(route);
 return `<header class="hub-header"><div class="container hub-top"><a class="brand" href="${b}" aria-label="David Suarez resident hub home"><span class="brand-first">David</span><span class="brand-last">Suarez</span><span class="brand-office">Miami Beach Commissioner</span></a><nav id="hub-nav" class="hub-nav" aria-label="Primary navigation">${link('resident-guide','Residents')}<details class="nav-group"${city?' data-current="true"':''}><summary>City Hall</summary><div class="nav-dropdown">${link('commission-agenda','Next agenda')}${link('commission-actions','Decisions & votes')}${link('meetings','Meetings & participation')}${link('legislation','Ordinances & resolutions')}${link('news','Miami Beach Today')}${link('commission','Mayor & commission')}</div></details>${link('active-projects','Projects')}${link('media','Watch')}${link('about','About David')}</nav><button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch to light mode" title="Switch to light mode"><span aria-hidden="true">◐</span> Display</button><button type="button" class="hub-menu" data-menu aria-expanded="false" aria-controls="hub-nav">Menu</button></div></header>`;
}
function footer(route) {
  const b = route ? '../' : './';
  return `<footer class="hub-footer"><div class="container"><div class="hub-footer-top"><div><strong class="footer-name">David Suarez</strong><p>Commissioner · Miami Beach Group 5</p><p>Not the official City website.</p></div><nav aria-label="Resident resources"><strong>For residents</strong><a href="${b}resident-guide/">Find a city service</a><a href="${b}news/">Miami Beach Today</a><a href="${b}meetings/">Attend a meeting</a><a href="${b}commission-actions/">Look up a decision</a><a href="${b}active-projects/">Explore city projects</a></nav><nav aria-label="Connect"><strong>Stay connected</strong><a href="https://www.instagram.com/davidsuarezmb/" target="_blank" rel="noreferrer">David on Instagram</a><a href="https://www.instagram.com/suarezsoundoff/" target="_blank" rel="noreferrer">Suarez Sound Off on Instagram</a><a href="https://www.tiktok.com/@suarezsoundoff" target="_blank" rel="noreferrer">Suarez Sound Off on TikTok</a><a href="https://www.youtube.com/@CommissionerDavidSuarez" target="_blank" rel="noreferrer">YouTube channel</a></nav></div><div class="hub-footer-bottom"><p>Official City records remain authoritative.</p><a href="mailto:david@miamibeachfl.gov">Contact the office</a></div></div></footer>`;
}
function page(route,title,description,body,{css='',script='pages.js'}={}) {
 return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | David Suarez</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="#062c4a"><meta property="og:title" content="${esc(title)} | David Suarez"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="../styles.css">${css}<link rel="stylesheet" href="../site.css"><link rel="stylesheet" href="../calm.css"></head><body data-page="${route}"><a class="skip-link" href="#main">Skip to main content</a>${header(route)}<main id="main">${body}</main>${footer(route)}<script type="module" src="../${script}"></script></body></html>`;
}
function head(title,description) {return `<section class="page-head"><div class="container"><p class="breadcrumb"><a href="../">Resident hub</a></p><h1>${title}</h1>${description?`<p>${description}</p>`:''}</div></section>`;}
const loading = '<p class="source-note" role="status">Loading the latest saved city records…</p><noscript><p>Enable JavaScript to search these records, or visit <a href="https://www.miamibeachfl.gov/">the official City website</a>.</p></noscript>';
const guide = JSON.parse(await readFile(new URL('data/resident-guide.json',root)));
const servicePaths = {
 report:'<path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z"/><path d="M12 7v5m0 3h.01"/>',
 parking:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
 sanitation:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
 trolley:'<rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 12h14M9 3v9M7 19v2m10-2v2M8 16h1m6 0h1"/>',
 permits:'<path d="m3 10 9-7 9 7M5 9v12h14V9M10 21v-7h4v7"/>',
 flooding:'<path d="M3 17q3-3 6 0t6 0t6 0M3 21q3-3 6 0t6 0t6 0M12 2s-5 6-5 9a5 5 0 0 0 10 0c0-3-5-9-5-9Z"/>',
 housing:'<path d="m3 10 9-7 9 7M5 9v12h14V9M9 14q3-4 6 0c0 3-3 4-3 4s-3-1-3-4Z"/>',
 'customer-service':'<path d="M4 14V10a8 8 0 0 1 16 0v7a4 4 0 0 1-4 4h-3"/><rect x="2" y="10" width="4" height="7" rx="2"/><rect x="18" y="10" width="4" height="7" rx="2"/>',
 records:'<path d="M14 2H5v20h14V7l-5-5v5h5M8 11h8M8 15h8M8 19h5"/>',
 participate:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
 alerts:'<path d="M18 8a6 6 0 0 0-12 0c0 8-3 8-3 9h18c0-1-3-1-3-9M10 21h4"/>',
 parks:'<path d="m12 2-6 8h3l-5 7h16l-5-7h3l-6-8Zm0 15v5M7 22h10"/>'
};
function serviceIcon(id) { return `<span class="service-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${servicePaths[id] || servicePaths.records}</svg></span>`; }
const pages = {
 'resident-guide': page('resident-guide','Your Miami Beach resident guide','Find resident parking, garbage pickup, permits, trolley routes, public records and help from the right City office.',head('Resident services','')+`<section class="page-body"><div class="container"><div class="hub-toolbar"><label class="hub-field grow"><span class="sr-only">Find a service</span><input id="guide-search" type="search" placeholder="Search services"></label><label class="hub-field">Category<select id="guide-category"><option value="all">All services</option>${[...new Set(guide.items.map(i=>i.category))].map(c=>`<option>${c}</option>`).join('')}</select></label></div><p class="result-meta" hidden id="guide-count" aria-live="polite">${guide.items.length} resident resources</p><div class="topic-grid" id="guide-list">${guide.items.map(i=>`<details class="topic-card" name="resident-service" id="${i.id}" data-category="${esc(i.category)}" data-search="${esc([i.title,i.description,i.keywords].join(' '))}"><summary><h2>${i.title}</h2></summary><div class="service-detail"><p>${i.description}</p><h3>Before you start</h3><p>${i.prepare}</p><a href="${i.url}" target="_blank" rel="noreferrer">${i.linkLabel} ↗</a></div></details>`).join('')}</div><p id="guide-empty" class="empty-state" hidden>No services match. Try a broader search or choose all services.</p><p class="source-note">Emergencies: call 911. Confirm current requirements with the City.</p><p class="source-note">Reviewed September 4, 2026</p></div></section>`),
 'search': page('search','Explore Miami Beach','Find the right section of the Miami Beach resident hub.',directoryLayout),
 'meetings': page('meetings','Meetings & participation','See upcoming Miami Beach public meetings, read the commission agenda, participate and find approved meeting outcomes.',head('Meetings & participation','')+`<section class="page-body"><div class="container"><div id="next-meeting">${loading}</div><div class="two-column"><section><div class="section-heading"><h2>Coming up</h2><a href="https://events.miamibeachfl.gov/City%20Meetings/" target="_blank" rel="noreferrer">Full city calendar ↗</a></div><div id="upcoming-meetings">${loading}</div></section><aside><details class="help-box disclosure"><summary>How to participate</summary><ol><li><strong>Find your item.</strong> Read the agenda and note its item number. Check attachments and hearing times in the official packet.</li><li><strong>Check the meeting notice.</strong> Confirm the date, venue, public-comment instructions and any remote access details for that specific meeting.</li><li><strong>Participate.</strong> The City’s meeting page explains in-person and virtual participation. Follow the meeting’s posted instructions.</li><li><strong>Follow the outcome.</strong> Watch the recording, then check approved minutes when they are published.</li></ol><a href="https://www.miamibeachfl.gov/city-hall/city-clerk/city-commission-meeting-dates/" target="_blank" rel="noreferrer">Official participation guide ↗</a></details><details class="help-box disclosure"><summary>Agenda language, explained</summary><p><strong>Consent agenda:</strong> items grouped for one motion unless pulled for separate consideration. Being listed on consent does not prove an item passed.</p><p><strong>First reading:</strong> a step in considering an ordinance, not final adoption.</p><p><strong>Approved minutes:</strong> the City’s published record of actions. Publication can follow the meeting by weeks.</p><a href="../media/?series=Miami%20Beach%20Civics">Watch Miami Beach Civics</a></details></aside></div><details class="meeting-history disclosure"><summary>Past meetings · 2026</summary><div class="section-heading"><h2 class="sr-only">2026 meeting record</h2><a href="../commission-actions/">Search all recorded actions</a></div><p class="source-note">The City’s published 2026 commission schedule begins in February and lists an August recess. Special meetings and budget meetings may have different times. Always check the official notice.</p><div id="meeting-history">${loading}</div></details></div></section>`),
 'news': page('news','Miami Beach Today','Latest City of Miami Beach announcements, with publication dates and direct official sources.',head('Miami Beach Today','The latest announcements from the City of Miami Beach.')+`<section class="page-body"><div class="container"><div class="hub-toolbar"><label class="hub-field grow">Search city news<input id="news-search" type="search" placeholder="Search a subject or announcement"></label><a class="hub-button secondary" href="https://www.miamibeachfl.gov/city-hall/communications/subscriptions/" target="_blank" rel="noreferrer">Get city alerts ↗</a></div><p id="news-status" class="result-meta" aria-live="polite"></p><div id="news-list">${loading}</div></div></section>`),
 'about': page('about','About David Suarez','Meet Commissioner David Suarez, a Miami Beach neighbor and Group 5 representative. Contact his office and follow his work.',aboutLayout),
 'legislation': page('legislation','Ordinances & resolutions','Browse upcoming Miami Beach legislation and 2026 recorded ordinance and resolution actions, with original City Clerk sources.',head('Ordinances & resolutions','')+`<section class="page-body"><div class="container"><div class="hub-toolbar"><label class="hub-field grow">Search legislation<input id="law-search" type="search" placeholder="Keyword, item number or ordinance number"></label><label class="hub-field">Record stage<select id="law-stage"><option value="upcoming">Upcoming agenda</option><option value="recorded">2026 recorded actions</option></select></label><label class="hub-field">Type<select id="law-type"><option value="all">Both types</option><option value="Ordinance">Ordinances</option><option value="Resolution">Resolutions</option></select></label></div><div class="notice"><strong>A vote is not always a new law.</strong><p>An ordinance may have more than one reading. An approved first reading does not mean final adoption. The City Clerk’s ordinance and resolution registries are the source for adopted legal text.</p></div><p id="law-count" class="result-meta" aria-live="polite"></p><div id="law-list">${loading}</div><button id="law-more" class="hub-button secondary" hidden>Show more legislation</button><section class="meeting-history"><div class="section-heading"><h2>Go to the legal record</h2></div><div id="law-registries" class="two-column">${loading}</div></section></div></section>`)
};
pages['resident-guide'] = pages['resident-guide'].replace(/(<details class="topic-card"[^>]*id="([^"]+)"[^>]*><summary>)/g,(_,start,id)=>start+serviceIcon(id));
pages['resident-guide'] = pages['resident-guide'].replace(/<section class="page-head">[\s\S]*?<\/section>/,`<section class="page-head resident-hero" aria-labelledby="resident-title"><video id="resident-film" muted loop playsinline preload="none" poster="../assets/miami-beach-lifeguard.jpg" data-src="../assets/resident-beach.mp4" aria-hidden="true" tabindex="-1"></video><div class="container"><h1 id="resident-title">Resident services</h1></div><button id="resident-film-control" class="hero-film-control" type="button" aria-label="Play background video" hidden></button></section>`).replace('</head>','<script type="module" src="../resident-film.js"></script></head>');
pages.commission = page('commission','Mayor & commission','Meet Miami Beach’s elected officials, with official portraits and City profiles.',commissionLayout);
// Keep old shared URLs useful without maintaining the removed global search.
for (const [route,html] of Object.entries(pages)) { await mkdir(new URL(`${route}/`,root),{recursive:true}); await writeFile(new URL(`${route}/index.html`,root),html); }
// Keep the existing readers, homepage, media and map implementations; unify their chrome.
for (const route of ['', 'commission-agenda','commission-actions','media','active-projects']) {
 const file = new URL(`${route ? route+'/' : ''}index.html`,root);
 let html = await readFile(file,'utf8');
 if(route===''){
   html=html.replace(/<main\b[\s\S]*?<\/main>/,homeLayout()).replace('<body>','<body class="home-cinematic">');
 }
 if(route==='active-projects')html=html.replace(/<main\b[\s\S]*?<\/main>/,projectsLayout);
 html = html.replace(/<header class="(?:site-header|hub-header|topbar)"[\s\S]*?<\/header>/,header(route));
 if (/<footer[\s\S]*?<\/footer>/.test(html)) html = html.replace(/<footer[\s\S]*?<\/footer>/,footer(route));
 else html = html.replace('</body>',footer(route)+'</body>');
 const b=route?'../':'';
 if (!html.includes('href="'+b+'calm.css')) html=html.replace('</head>',`<link rel="stylesheet" href="${b}calm.css"></head>`);
 if (!html.includes('href="'+b+'site.css')) html=html.replace('</head>',`<link rel="stylesheet" href="${b}site.css"></head>`);
 if (['commission-agenda','commission-actions'].includes(route)) {
   if (!html.includes('src="'+b+'shared.js')) html=html.replace('</body>',`<script type="module" src="${b}shared.js"></script></body>`);
 } else html=html.replace(/<script type="module" src="(?:\.\.\/)?shared\.js[^"]*"><\/script>/g,'');
 await writeFile(file,html);
}
// Version the shared module dependency as well as each page entry point.
const sharedHash=createHash('sha256').update(await readFile(new URL('shared.js',root))).digest('hex').slice(0,10);
for(const entry of ['home.js','pages.js','media/app.js','active-projects/explorer.js']){
 const file=new URL(entry,root);
 const code=await readFile(file,'utf8');
 await writeFile(file,code.replace(/(from ['"](?:\.\.\/|\.\/)shared\.js)(?:\?v=[a-f0-9]+)?(['"])/g,'$1?v='+sharedHash+'$2'));
}
// Content-versioned local assets prevent older browser caches hiding a release.
const mapHash=createHash('sha256').update(await readFile(new URL('city-map.js',root))).digest('hex').slice(0,10);
for(const entry of ['home.js','active-projects/explorer.js']){
 const file=new URL(entry,root),code=await readFile(file,'utf8');
 await writeFile(file,code.replace(/(from ['"](?:\.\.\/|\.\/)city-map\.js)(?:\?v=[a-f0-9]+)?(['"])/g,'$1?v='+mapHash+'$2'));
}
for (const route of [...Object.keys(pages),'','commission-agenda','commission-actions','media','active-projects']) {
 const file=new URL(`${route?route+'/':''}index.html`,root);
 let html=await readFile(file,'utf8');
 html=html.replace(/<body([^>]*)>/,(_,attrs)=>'<body'+attrs.replace(/ data-page="[^"]*"/,'')+' data-page="'+route+'">');
 html=html.replace('Site-wide searches run in your browser.','Page-specific filters run in your browser.');
 // Remove legacy decorative introductions from retained reader pages as well.
 html=html.replace(/<p class="(?:chapter-label|editorial-deck)">[^<]*<\/p>/g,'');
 if(route==='media')html=html.replace('<div class="player-copy">','<div class="player-copy" id="player-copy">');
 html=addLoadingShells(html,route);
 if(!html.includes('id="loading-noscript"')) html=html.replace('</head>','<noscript id="loading-noscript"><style>.loading-skeleton{display:none!important}</style></noscript></head>');
 const base=route?'../':'';
 if(!html.includes('href="'+base+'experience.css')) html=html.replace('</head>',`<link rel="stylesheet" href="${base}experience.css"></head>`);
 if(!html.includes('src="'+base+'experience.js')) html=html.replace('</head>',`<script defer src="${base}experience.js"></script></head>`);
 if(route===''&&!html.includes('href="home-visual.css'))html=html.replace('</head>','<link rel="stylesheet" href="home-visual.css"></head>');
 if(!html.includes('src="'+base+'theme.js'))html=html.replace(/(<meta charset="[^"]*">)/i,'$1'+`<script src="${base}theme.js"></script>`);
 // This theme layer is intentionally last, including on the cinematic homepage.
 html=html.replace(/<link rel="stylesheet" href="(?:\.\.\/)?coastal\.css[^"]*">/g,'').replace('</head>',`<link rel="stylesheet" href="${base}coastal.css"></head>`);
 if(route==='')for(const match of [...html.matchAll(/data-(?:video|mobile)-src="([^"?]+)(?:\?[^" ]*)?"/g)]){
   const hash=createHash('sha256').update(await readFile(new URL(match[1],file))).digest('hex').slice(0,10);
   html=html.replace(match[0],match[0].split('=')[0]+'="'+match[1]+'?v='+hash+'"');
 }
 for(const match of [...html.matchAll(/(?:href|src)="((?!https?:)[^"?]+\.(?:css|js))(?:\?[^" ]*)?"/g)]) {
   const asset=new URL(match[1],file);const hash=createHash('sha256').update(await readFile(asset)).digest('hex').slice(0,10);
   html=html.replace(match[0],match[0].split('=')[0]+'="'+match[1]+'?v='+hash+'"');
 }
 await writeFile(file,html);
}
console.log(`Built ${Object.keys(pages).length} resident pages and unified navigation on five existing pages.`);
