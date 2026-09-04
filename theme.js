// Apply before first paint. A visitor's choice follows them between pages.
(() => {
  const key = 'suarez-display';
  const system = matchMedia('(prefers-color-scheme: dark)');
  let choice = 'dark';
  try { choice = localStorage.getItem(key) || 'dark'; } catch {}
  if (!['dark', 'light', 'system'].includes(choice)) choice = 'dark';
  function apply() {
    const value = choice === 'system' ? (system.matches ? 'dark' : 'light') : choice;
    document.documentElement.dataset.theme = value;
    document.documentElement.style.colorScheme = value;
    document.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === choice)));
    document.dispatchEvent(new CustomEvent('theme:change', {detail: value}));
  }
  apply();
  system.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-theme-choice]');
      if (!button) return;
      choice = button.dataset.themeChoice;
      try { localStorage.setItem(key, choice); } catch {}
      apply();
    });
  });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    choice = ['dark', 'light', 'system'].includes(event.newValue) ? event.newValue : 'dark';
    apply();
  });
})();
