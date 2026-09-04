/* Progressive enhancement: nothing is hidden while waiting for JavaScript.
   One-shot viewport entrances work for static and newly rendered modules. */
(() => {
  document.documentElement.classList.add('ui-loading');
  const pending = new Set(document.querySelectorAll('[data-load-region]'));
  pending.forEach(region => region.setAttribute('aria-busy','true'));
  function finishRegion(region) {
    region.setAttribute('aria-busy','false');
    pending.delete(region);
  }
  function finishPage() {
    document.documentElement.classList.remove('ui-loading');
    pending.forEach(region => {
      const shell=region.querySelector('.loading-skeleton');
      if(shell && region.dataset.staticContent) shell.remove();
      else if(shell) {
        const note=document.createElement('p');
        note.className='notice';
        note.append('This section could not load. ');
        const link=document.createElement('a');
        const video=region.dataset.loadRegion==='video'||region.dataset.loadRegion==='videos';
        link.href=video?'https://www.youtube.com/@CommissionerDavidSuarez':'https://www.miamibeachfl.gov/';
        link.textContent=video?'Open David’s YouTube channel':'Open the official City website';
        note.append(link); shell.replaceWith(note);
      }
      finishRegion(region);
    });
  }
  document.addEventListener('page:ready',finishPage,{once:true});
  // Failed entry-point downloads must not leave permanent loading placeholders.
  window.addEventListener('error',event => {
    if(event.target instanceof HTMLScriptElement) finishPage();
  },true);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Set();
  const seen = new WeakSet();
  const selector = '.home-welcome,.discovery-heading,.home-map-frame,.map-project-link,.city-today-photo,.home-service-bar,.page-head .container,.agenda-intro .container,.media-intro .container,.featured-story,.today-panel,.official-item,.series-card,.home-explore a,.home-contact .container,.hub-toolbar,.topic-card,.help-box,.result-row,.event-row,.person,.reader-shell,.agenda-card,.detail-inner,.media-card,.player-section,.project-explorer,.project-result,#project-detail,.section-heading,.section-line,.meeting-history,.notice,.hub-footer-top > *';
  function enter(element, delay = 0) {
    if (reduced.matches || !element.animate || element.closest('[hidden]')) return;
    const animation = element.animate([
      {opacity:0, transform:'translateY(10px)'},
      {opacity:1, transform:'translateY(0)'}
    ], {duration:420, delay, easing:'cubic-bezier(.22,1,.36,1)', fill:'backwards'});
    running.add(animation);
    animation.finished.catch(() => {}).finally(() => running.delete(animation));
  }
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    let index = 0;
    entries.forEach(({target,isIntersecting}) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      // Avoid doubling a child's entrance while its parent is already moving.
      if (![...running].some(a => a.effect?.target?.contains(target))) enter(target, Math.min(index++ * 40,160));
    });
  }, {threshold:0, rootMargin:'0px 0px -16px 0px'}) : null;
  function scan(root) {
    if (!(root instanceof Element)) return;
    const images=[...(root.matches('img')?[root]:[]),...root.querySelectorAll('img')];
    images.forEach(img=>{
      if(img.complete || img.hasAttribute('data-image-pending'))return;
      img.setAttribute('data-image-pending','');
      const done=()=>img.removeAttribute('data-image-pending');
      img.addEventListener('load',done,{once:true});
      img.addEventListener('error',done,{once:true});
    });
    const nodes = [...(root.matches(selector) ? [root] : []),...root.querySelectorAll(selector)];
    nodes.forEach(el => {
      if (seen.has(el)) return;
      seen.add(el);
      if (!reduced.matches) observer?.observe(el);
    });
  }
  scan(document.body);
  new MutationObserver(records => {
    pending.forEach(region=>{if(!region.querySelector('.loading-skeleton'))finishRegion(region);});
    for (const record of records) {
      record.addedNodes.forEach(scan);
      record.removedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        observer?.unobserve(node);
        node.querySelectorAll(selector).forEach(el => observer?.unobserve(el));
      });
    }
  }).observe(document.querySelector('main') || document.body, {childList:true,subtree:true});
  // Native disclosures keep their keyboard behavior and require no height hacks.
  document.addEventListener('toggle', event => {
    const panel = event.target;
    if (!(panel instanceof HTMLDetailsElement) || !panel.open) return;
    const body = panel.querySelector('.service-detail,.nav-dropdown,.filter-options') || panel.querySelector(':scope > :not(summary)');
    if (body) enter(body);
  }, true);
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    observer?.disconnect();
    running.forEach(animation => animation.cancel());
    running.clear();
  });
})();
