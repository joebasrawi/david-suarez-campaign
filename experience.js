/* Progressive enhancement: nothing is hidden while waiting for JavaScript.
   One-shot viewport entrances work for static and newly rendered modules. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Set();
  const seen = new WeakSet();
  const selector = '.home-welcome,.page-head .container,.agenda-intro .container,.media-intro .container,.featured-story,.today-panel,.series-card,.home-explore a,.home-contact .container,.hub-toolbar,.topic-card,.help-box,.result-row,.event-row,.person,.reader-shell,.media-card,.player-section,.project-explorer,.section-heading,.section-line,.meeting-history,.notice';
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
    const nodes = [...(root.matches(selector) ? [root] : []),...root.querySelectorAll(selector)];
    nodes.forEach(el => {
      if (seen.has(el)) return;
      seen.add(el);
      if (!reduced.matches) observer?.observe(el);
    });
  }
  scan(document.querySelector('main'));
  new MutationObserver(records => {
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
