export const ROOT = new URL('./', import.meta.url);
export const href = path => new URL(path, ROOT).href;
export const escape = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
export const date = (value, short = false) => value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('en-US', {month: short ? 'short' : 'long', day:'numeric', year:'numeric', timeZone:'America/New_York'}) : 'Not published';
export async function json(file) {
  const response = await fetch(href(`data/${file}.json`), {cache:'no-cache',signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(`${file} unavailable`);
  return response.json();
}
export function words(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]+/g) || []; }
export function matches(query, text) { const target = words(text).join(' '); return words(query).every(word => target.includes(word)); }
export function recordTitle(value = '', limit = 160) {
  let clean = value.replace(/^(?:A RESOLUTION|AN ORDINANCE) OF THE MAYOR AND CITY COMMISSION OF THE CITY OF MIAMI BEACH,? FLORIDA,?\s*/i,'').replace(/\s+/g,' ').trim();
  if(clean===clean.toUpperCase()) clean=clean.toLowerCase().replace(/^./,c=>c.toUpperCase()).replace(/\b(miami beach|miami-dade|north beach|south beach|middle beach|florida|collins avenue|ocean drive|alton road|lincoln road|west avenue)\b/g,phrase=>phrase.replace(/\b\w/g,c=>c.toUpperCase())).replace(/\b(rfp|rfq|itb|fdot|ada|fy|lpr|far|ldr|rda|nbcra)\b/g,word=>word.toUpperCase());
  return clean.length > limit ? clean.slice(0,limit).replace(/\s+\S*$/,'') + '…' : clean;
}
export const sourceLink = (url, label = 'Official source') => `<a href="${escape(url)}" target="_blank" rel="noreferrer">${escape(label)} <span aria-hidden="true">↗</span></a>`;
export function newsExcerpt(value='') { return value.replace(/^for immediate release[\s\S]*?[–—]\s*/i,'').replace(/\s*\[(?:&hellip;|…)\]\s*$/,'…').replaceAll('&hellip;','…').replaceAll('&nbsp;',' ').trim(); }
export function thumbnailFallback(scope = document) {
  scope.querySelectorAll('img[data-video]').forEach(img => {
    const fallback = () => { if (!img.src.includes('/hqdefault.')) img.src = `https://i.ytimg.com/vi/${img.dataset.video}/hqdefault.jpg`; };
    img.addEventListener('error', fallback, {once:true});
    img.addEventListener('load', () => { if (img.naturalWidth < 200) fallback(); });
    if (img.complete && img.naturalWidth < 200) fallback();
  });
}
const menu = document.querySelector('[data-menu]');
const nav = document.querySelector('#hub-nav');
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded',String(open)); nav.classList.toggle('is-open',open);
});
document.addEventListener('keydown', event => {
  if(event.key!=='Escape')return;
  const openGroup=document.querySelector('.nav-group[open],.filter-disclosure[open]');
  if(openGroup){openGroup.open=false;openGroup.querySelector('summary').focus();return;}
  if (menu?.getAttribute('aria-expanded') === 'true') {
    menu.setAttribute('aria-expanded','false'); nav.classList.remove('is-open'); menu.focus();
  }
});
document.addEventListener('click', async event => {
  if(event.target.closest('[data-back-to-list]')){
    const selected=document.querySelector('.item-browser [aria-pressed="true"]')||document.querySelector('.item-browser button');
    selected?.focus({preventScroll:true}); document.querySelector('.item-browser')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  const copy = event.target.closest('[data-copy-link]');
  if (copy) {
    try { await navigator.clipboard.writeText(location.href); copy.textContent = 'Link copied'; }
    catch { copy.textContent = 'Copy the address from your browser'; }
  }
});
thumbnailFallback();

 // Secondary navigation is deliberate: click/tap to open, Escape or outside click to close.
 document.addEventListener('click', event => {
   document.querySelectorAll('.nav-group[open],.filter-disclosure[open]').forEach(group => {
     if(!group.contains(event.target)) group.open=false;
   });
 });

 // Keep hidden filters understandable, including filters restored from a shared URL.
 function updateFilterCounts(){
   document.querySelectorAll('.filter-disclosure').forEach(panel=>{
     const count=[...panel.querySelectorAll('select')].filter(select=>select.value && select.value!=='all').length;
     const label=panel.querySelector('.filter-count'),text=count?'('+count+' active)':'';
     if(label.textContent!==text)label.textContent=text;
   });
 }
 document.addEventListener('change',updateFilterCounts);
 document.querySelector('#reset-filters')?.addEventListener('click',()=>queueMicrotask(updateFilterCounts));
 new MutationObserver(updateFilterCounts).observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
 updateFilterCounts();
