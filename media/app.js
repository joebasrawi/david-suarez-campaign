const state = { items: [], series: 'all', query: '' };

function escapeHtml(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function displayDate(value) {
  return new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function thumbnail(item) { return `https://i.ytimg.com/vi/${encodeURIComponent(item.id)}/maxresdefault.jpg`; }

function render() {
  const query = state.query.toLowerCase();
  const items = state.items.filter(item => (state.series === 'all' || item.series === state.series) && (!query || `${item.title} ${item.series}`.toLowerCase().includes(query)));
  document.querySelector('#media-count').textContent = `${items.length} ${items.length === 1 ? 'video' : 'videos'} from the official channel`;
  document.querySelector('#media-grid').innerHTML = items.length ? items.map(item => `<article class="media-card"><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(thumbnail(item))}" alt="${escapeHtml(item.title)}" loading="lazy"><div class="media-card-copy"><span>${escapeHtml(item.series)}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(displayDate(item.publishedAt))} · Watch on YouTube <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></p></div></a></article>`).join('') : '<div class="media-empty"><strong>No videos match this view.</strong><br>Try another series or search term.</div>';
}

function setSeries(series) {
  const available = ['all', 'Suarez Sound Off', 'Miami Beach Civics', 'City Issues'];
  state.series = available.includes(series) ? series : ['Ride Along', 'Accountability'].includes(series) ? 'City Issues' : 'all';
  document.querySelectorAll('[data-series]').forEach(button => button.classList.toggle('is-active', button.dataset.series === state.series));
  render();
}

async function initialize() {
  try {
    const response = await fetch('../data/youtube.json?v=20260904b', { cache: 'no-store' });
    if (!response.ok) throw new Error(`YouTube data returned ${response.status}`);
    state.items = (await response.json()).items;
    setSeries(new URLSearchParams(location.search).get('series') || 'all');
  } catch (error) {
    console.error(error);
    document.querySelector('#media-grid').innerHTML = '<div class="media-empty">The video archive is temporarily unavailable. Please use the YouTube link above.</div>';
  }
}

document.querySelector('#media-filters').addEventListener('click', event => { const button = event.target.closest('[data-series]'); if (button) setSeries(button.dataset.series); });
document.querySelector('#media-search').addEventListener('input', event => { state.query = event.target.value.trim(); render(); });
document.querySelector('#menu-toggle').addEventListener('click', event => { const open = document.querySelector('#site-nav').classList.toggle('is-open'); event.currentTarget.setAttribute('aria-expanded', String(open)); });
initialize();
