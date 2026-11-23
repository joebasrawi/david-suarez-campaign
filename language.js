import {spanish} from './locales/es.js';

const key = 'suarez-language';
const params = new URLSearchParams(location.search);
let language = params.get('lang');
try { if (!['en', 'es'].includes(language)) language = localStorage.getItem(key); } catch {}
if (!['en', 'es'].includes(language)) language = 'en';
const originals = new WeakMap();
const attributes = new WeakMap();
const ignored = 'script,style,noscript,code,pre,[translate="no"],[data-language-toggle]';
export const locale = () => language === 'es' ? 'es-US' : 'en-US';
export function translate(value) {
  if (language !== 'es') return value;
  const text = value.replace(/\s+/g, ' ').trim();
  let result = spanish[text];
  if (!result) {
    const arrow = text.match(/^(.*?)\s*([↗↘])$/);
    if (arrow && spanish[arrow[1]]) result = spanish[arrow[1]] + ' ' + arrow[2];
  }
  if (!result && text.includes(' · ')) result = text.split(' · ').map(part => translate(part)).join(' · ');
  if (!result && text.includes(' | ')) result = text.split(' | ').map(part => spanish[part] || part).join(' | ');
  if (!result) {
    for (const [pattern, replacement] of patterns) {
      if (pattern.test(text)) { result = text.replace(pattern, replacement); break; }
    }
  }
  const output = result || text;
  const dated = output.replace(/\b(?:(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), )?(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})\b/g, (match, weekday, month, day, year) => {
    const date = new Date(`${month} ${day}, ${year} 12:00:00`);
    return date.toLocaleDateString('es-US', {year:'numeric', month:month.length <= 3 ? 'short' : 'long', day:'numeric', ...(weekday ? {weekday:'long'} : {})});
  });
  return value.replace(value.trim(), dated);
}
const patterns = [
  [/^(\d+) items for consideration\.?$/, '$1 asuntos para consideración'],
  [/^(\d+) of (\d+) agenda items shown$/, '$1 de $2 asuntos de la agenda'],
  [/^([\d,]+) recorded actions? shown$/, '$1 decisiones registradas'],
  [/^(\d+) mapped features? across Miami Beach$/, '$1 elementos de proyectos en Miami Beach'],
  [/^(\d+) mapped features? in (.+)$/, '$1 elementos de proyectos en $2'],
  [/^(\d+) mapped features?$/, '$1 elementos de proyectos'],
  [/^(\d+) projects?$/, '$1 proyectos'],
  [/^(\d+) project features\. Zoom in to explore\.$/, '$1 elementos de proyectos. Acerque el mapa para explorar.'],
  [/^(\d+) project features$/, '$1 elementos de proyectos'],
  [/^City announcement$/, 'Anuncio de la Ciudad'],
  [/^(\d+) official announcements$/, '$1 anuncios oficiales'],
  
  [/^(\d+) upcoming items$/, '$1 asuntos próximos'],
  [/^2026 approved minutes$/, 'Actas aprobadas de 2026'],
  [/^(.+): (Approved minutes published|Pending approved minutes)$/, (_, date, status) => `${date}: ${spanish[status]}`],
  [/^2026 records through (.+)$/, 'Documentos de 2026 hasta el $1'],
  [/^(\d+) meetings indexed from published minutes$/, '$1 reuniones indexadas a partir de actas publicadas'],
  [/^(.+) \((\d+)\)$/, (_, label, count) => `${spanish[label] || label} (${count})`],
  [/^(.+) · (\d+) listed items$/, '$1 · $2 asuntos enumerados'],
  [/^(\d+) listed items$/, '$1 asuntos enumerados'],
  [/^Using (.+)$/, 'Dirección seleccionada: $1'],
  [/^Published index through (.+)\. This coverage date may lag the latest approved minutes\.$/, 'Índice publicado hasta el $1. Esta fecha puede ser anterior a las actas aprobadas más recientes.'],
  [/^Calendar snapshot saved (.+)\. (\d+) upcoming events in the saved feed\. Dates and access details can change\.$/, 'Calendario guardado el $1. Hay $2 próximos eventos en la fuente guardada. Las fechas y los datos de acceso pueden cambiar.'],
  [/^City Public Works GIS$/, 'GIS de Obras Públicas de la Ciudad'],
  [/^Snapshot saved (.+)\. Checked by the six-hour publishing workflow\. A project can have several mapped features\.$/, 'Datos guardados el $1. Revisados por el proceso de actualización cada seis horas. Un proyecto puede tener varios elementos en el mapa.'],

  [/^Snapshot saved (.+)$/, 'Datos guardados el $1'],
  [/^(\d+) resident resources?$/, '$1 recursos para residentes'],
  [/^(\d+) videos · Official YouTube channel$/, '$1 videos · Canal oficial de YouTube'],
  [/^Show all (\d+) upcoming events$/, 'Mostrar los $1 próximos eventos'],
  [/^(\d+) recorded actions$/, '$1 decisiones registradas'],
  [/^\((\d+) active\)$/, '($1 activos)'],
  [/^Official City portrait of (.+)$/, 'Retrato oficial de $1'],
  [/^Watch (.+)$/, 'Ver $1'],
  [/^Previous (.+) videos$/, 'Videos anteriores de $1'],
  [/^Next (.+) videos$/, 'Siguientes videos de $1'],
  [/^(.+) videos$/, '$1 videos'],
  [/^Group (\d+)$/, 'Grupo $1'],
];
function textNode(node) {
  if (!node.parentElement || node.parentElement.closest(ignored)) return;
  // Preserve option values even where the original HTML relied on its label as the value.
  const option = node.parentElement.closest('option');
  if (option && !option.hasAttribute('value')) option.value = option.textContent;
  let saved = originals.get(node);
  if (!saved || node.nodeValue !== saved.rendered) saved = {source: node.nodeValue};
  const rendered = translate(saved.source);
  if (node.nodeValue !== rendered) node.nodeValue = rendered;
  saved.rendered = rendered;
  originals.set(node, saved);
}
function element(node) {
  if (node.closest(ignored)) return;
  let saved = attributes.get(node);
  if (!saved) { saved = {}; attributes.set(node, saved); }
  for (const name of ['aria-label', 'title', 'placeholder', 'alt']) {
    const current = node.getAttribute(name);
    if (current === null) continue;
    if (!saved[name] || current !== saved[name].rendered) saved[name] = {source: current};
    const rendered = translate(saved[name].source);
    if (current !== rendered) node.setAttribute(name, rendered);
    saved[name].rendered = rendered;
  }
}
function visit(root) {
  if (root.nodeType === Node.TEXT_NODE) return textNode(root);
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) element(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode.nodeType === Node.TEXT_NODE) textNode(walker.currentNode);
    else element(walker.currentNode);
  }
}
const observer = new MutationObserver(records => {
  observer.disconnect();
  for (const record of records) {
    if (record.type === 'childList') record.addedNodes.forEach(visit);
    else visit(record.target);
  }
  observe();
});
function observe() {
  observer.observe(document.documentElement, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['aria-label','title','placeholder','alt']});
}
function apply() {
  observer.disconnect();
  document.documentElement.lang = language;
  visit(document.documentElement);
  document.querySelectorAll('[data-language-toggle]').forEach(button => {
    button.setAttribute('aria-label', language === 'es' ? 'Switch to English' : 'Cambiar a español');
    button.title = language === 'es' ? 'Switch to English' : 'Cambiar a español';
    button.setAttribute('aria-pressed', String(language === 'es'));
    button.querySelector('[data-lang-es]')?.classList.toggle('is-current', language === 'es');
    button.querySelector('[data-lang-en]')?.classList.toggle('is-current', language === 'en');
  });
  document.querySelectorAll('[data-language-note]').forEach(note => { note.hidden = language !== 'es'; });
  observe();
}
// Used by data renderers to format newly loaded dates in the selected language.
window.suarezLocale = locale;
// Carry the choice through links even when browser storage is disabled.
document.addEventListener('click', event => {
  const anchor = event.target.closest('a[href]');
  if (!anchor) return;
  const url = new URL(anchor.href);
  if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
  url.searchParams.set('lang', language);
  anchor.href = url.href;
}, true);
document.addEventListener('click', event => {
  if (!event.target.closest('[data-language-toggle]')) return;
  language = language === 'en' ? 'es' : 'en';
  try { localStorage.setItem(key, language); } catch {}
  const url = new URL(location.href);
  url.searchParams.set('lang', language);
  history.replaceState(null, '', url);
  apply();
  document.dispatchEvent(new CustomEvent('language:change', {detail:language}));
});
window.addEventListener('storage', event => {
  if (event.key === key) { language = event.newValue === 'es' ? 'es' : 'en'; apply(); }
});
apply();
