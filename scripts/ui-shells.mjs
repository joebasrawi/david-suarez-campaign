// Build-time placeholders arrive with the HTML, before fetches or page scripts.
export const loadingRegions = {
 '': [['official-updates','rows',3]],
 'resident-guide': [['guide-list','services',12]],
 search: [],
 meetings: [['next-meeting','meeting',1],['upcoming-meetings','events',4],['meeting-history','rows',3]],
 news: [['news-list','rows',4]],
 sources: [['source-status','rows',4]],
 about: [],
 commission: [['official-people','people',7]],
 legislation: [['law-list','rows',4],['law-registries','cards',2]],
 'commission-agenda': [['item-list','reader',6],['item-detail','detail',1]],
 'commission-actions': [['decision-list','reader',6],['decision-detail','detail',1]],
 media: [['player-art','video',1],['player-copy','video-copy',1],['media-grid','videos',6]],
 'active-projects': [['project-results','reader',6],['project-map','map',1],['project-detail','detail',1]]
};
export function skeleton(kind,count=3) {
 const unit = `<div class="skeleton-unit"><span class="skeleton-art"></span><div class="skeleton-copy"><span class="skeleton-line short"></span><span class="skeleton-line title"></span><span class="skeleton-line"></span></div></div>`;
 return `<div class="loading-skeleton skeleton-${kind}"><span class="sr-only" role="status">Loading content…</span><div class="skeleton-shapes" aria-hidden="true">${unit.repeat(count)}</div></div>`;
}
export function addLoadingShells(html,route) {
 for(const [id,kind,count] of loadingRegions[route] || []) {
  const start=new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\bid="${id}"[^>]*>`).exec(html);
  if(!start) throw new Error(`Missing loading region ${route}/${id}`);
  const from=start.index+start[0].length, tags=new RegExp(`<\\/?${start[1]}\\b[^>]*>`,'g');
  tags.lastIndex=from;
  let depth=1,end;
  while((end=tags.exec(html))) { depth+=end[0].startsWith('</')?-1:1; if(!depth)break; }
  if(!end)throw new Error(`Unclosed loading region ${id}`);
  const staticGuide=kind==='services'||kind==='video-copy';
  const old=html.slice(from,end.index).replace(/<!--loading-shell-->[\s\S]*?<!--\/loading-shell-->/g,'');
  const open=start[0].replace(/ (?:aria-busy|data-load-region|data-static-content)="[^"]*"/g,'').slice(0,-1)+` data-load-region="${kind}"${staticGuide?' data-static-content="true"':' aria-busy="true"'}>`;
  const fallback=staticGuide?'':`<noscript><p>JavaScript is needed for this view. <a href="https://www.miamibeachfl.gov/">Open the official City website</a>.</p></noscript>`;
  html=html.slice(0,start.index)+open+'<!--loading-shell-->'+skeleton(kind,count)+'<!--/loading-shell-->'+(staticGuide?old:'')+fallback+html.slice(end.index);
 }
 return html;
}
