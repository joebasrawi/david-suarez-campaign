const HOME_DATA = {
  youtube: 'data/youtube.json',
  calendar: 'data/city-calendar.json',
  news: 'data/city-news.json',
  projects: 'data/city-projects.json',
  records: 'data/records-status.json'
};

const UI_COPY = {
  en: {
    nav: ['Home', 'Resident dashboard', 'Projects near me', 'Legislation', 'Get updates'],
    search: 'Search Miami Beach', today: 'Miami Beach Today', todaySource: 'Official city sources',
    dashboard: 'Resident dashboard', videos: 'Watch and listen'
  },
  es: {
    nav: ['Inicio', 'Panel para residentes', 'Proyectos cerca de mí', 'Legislación', 'Recibir avisos'],
    search: 'Buscar Miami Beach', today: 'Miami Beach Hoy', todaySource: 'Fuentes oficiales de la ciudad',
    dashboard: 'Panel para residentes', videos: 'Ver y escuchar'
  }
};

let mediaItems = [];
let mediaFilter = 'all';

function homeEscape(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function displayDate(value, options = {}) {
  if (!value) return 'Date not listed';
  const normalized = value.length === 10 ? `${value}T12:00:00` : value;
  return new Date(normalized).toLocaleDateString('en-US', {
    month: options.short ? 'short' : 'long', day: 'numeric', year: 'numeric',
    timeZone: value.endsWith('Z') ? 'UTC' : 'America/New_York'
  });
}

function maxThumbnail(item) { return `https://i.ytimg.com/vi/${encodeURIComponent(item.id)}/maxresdefault.jpg`; }

async function loadJson(url) {
  const response = await fetch(`${url}?v=20260904`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function renderFeatured(youtube) {
  const item = youtube.items.find(video => video.series === 'Suarez Sound Off') || youtube.items[0];
  if (!item) return;
  const title = item.title.replace(/^Suarez Sound Off\s*Ep\.\s*\d+\s*[—-]\s*/i, '').replace(/\s*\|.*$/, '');
  document.querySelector('#featured-title').textContent = title;
  document.querySelector('#featured-series').textContent = item.series;
  document.querySelector('#featured-date').textContent = displayDate(item.publishedAt);
  document.querySelector('#featured-link').href = item.url;
  const image = document.querySelector('#featured-image');
  image.src = maxThumbnail(item);
  image.alt = item.title;
}

function officialItem(icon, label, title, description, url, linkLabel) {
  return `<article class="official-item"><span class="official-icon"><i class="${homeEscape(icon)}" aria-hidden="true"></i></span><div><span class="official-label">${homeEscape(label)}</span><h3>${homeEscape(title)}</h3><p>${homeEscape(description)}</p><a href="${homeEscape(url)}" target="_blank" rel="noreferrer">${homeEscape(linkLabel)}</a></div></article>`;
}

function renderOfficialUpdates(calendar, news, projects, records) {
  const meeting = calendar.items.find(item => /commission|board|committee|authority|meeting|hearing|workshop/i.test(item.title)) || calendar.items[0];
  const latestNews = news.items[0];
  const project = projects.items.find(item => item.phase === 'Construction' && item.title && item.link) || projects.items.find(item => item.phase === 'Construction');
  const ordinance = records.items.find(item => item.type === 'ordinances');
  const meetingDescription = meeting ? `${displayDate(meeting.startLocal, { short: true })}${meeting.location ? ` · ${meeting.location}` : ''}` : 'Check upcoming public meetings.';
  document.querySelector('#official-updates').innerHTML = [
    officialItem('fa-regular fa-calendar', 'Next public meeting', meeting?.title || 'City meeting calendar', meetingDescription, meeting?.url || calendar.source.url, 'View meeting'),
    officialItem('fa-solid fa-person-digging', 'Public Works update', project?.title || 'Active Public Works projects', project ? `${project.phase}${project.neighborhood ? ` · ${project.neighborhood}` : ''}` : `${projects.items.length} mapped project features`, project?.link || projects.source.url, 'View project source'),
    officialItem('fa-regular fa-newspaper', latestNews?.label || 'Official city news', latestNews?.title || 'City press releases', latestNews ? displayDate(latestNews.publishedAt, { short: true }) : 'Current City of Miami Beach announcements.', latestNews?.url || news.source.url, 'Read update')
  ].join('');
  document.querySelector('#meeting-summary').textContent = meeting ? `Next listed meeting: ${meeting.title}, ${displayDate(meeting.startLocal, { short: true })}.` : 'See upcoming public meetings and check whether an agenda is available.';
  document.querySelector('#project-summary').textContent = `${projects.items.length} official construction, design, and planning features are available in the current city snapshot.`;
  document.querySelector('#records-summary').textContent = ordinance ? `The official ordinance registry currently runs through ${displayDate(ordinance.currentThrough, { short: true })}.` : 'Search the City Clerk registry, then use the tracker below for resident-friendly context.';
}

function renderVideos() {
  const grid = document.querySelector('#video-grid');
  const filtered = mediaFilter === 'all' ? mediaItems : mediaItems.filter(item => item.series === mediaFilter);
  grid.innerHTML = filtered.length ? filtered.slice(0, 9).map(item => `<article class="video-card"><img src="${homeEscape(maxThumbnail(item))}" alt="${homeEscape(item.title)}" loading="lazy"><div class="video-card-copy"><span>${homeEscape(item.series)}</span><h3>${homeEscape(item.title)}</h3><a href="${homeEscape(item.url)}" target="_blank" rel="noreferrer">Watch on YouTube</a></div></article>`).join('') : '<p class="loading-copy">No recent videos in this series.</p>';
}

function applyLanguage(language) {
  const copy = UI_COPY[language];
  document.documentElement.lang = language;
  document.querySelectorAll('#site-nav a').forEach((link, index) => { link.textContent = copy.nav[index]; });
  document.querySelector('#search-toggle span').textContent = copy.search;
  document.querySelector('#today-title').textContent = copy.today;
  document.querySelector('.today-panel header p').textContent = copy.todaySource;
  document.querySelector('#resident-dashboard h2').textContent = copy.dashboard;
  document.querySelector('#video-library h2').textContent = copy.videos;
  const toggle = document.querySelector('#language-toggle');
  toggle.textContent = language === 'en' ? 'ES' : 'EN';
  toggle.setAttribute('aria-label', language === 'en' ? 'Cambiar a español' : 'Switch to English');
  toggle.dataset.language = language;
}

async function initializeHome() {
  try {
    const [youtube, calendar, news, projects, records] = await Promise.all(Object.values(HOME_DATA).map(loadJson));
    renderFeatured(youtube); renderOfficialUpdates(calendar, news, projects, records);
    mediaItems = youtube.items; renderVideos();
  } catch (error) {
    console.error('Could not load resident hub data', error);
    document.querySelector('#official-updates').innerHTML = '<p class="loading-copy">Official updates are temporarily unavailable. Use the source links below.</p>';
    document.querySelector('#video-grid').innerHTML = '<p class="loading-copy">Recent videos are temporarily unavailable. Open the YouTube channel for the latest posts.</p>';
  }
}

const searchToggle = document.querySelector('#search-toggle');
const searchPanel = document.querySelector('#site-search');
searchToggle?.addEventListener('click', () => {
  const open = searchPanel.hidden;
  searchPanel.hidden = !open; searchToggle.setAttribute('aria-expanded', String(open));
  if (open) document.querySelector('#site-search-input')?.focus();
});
document.querySelector('#site-search-form')?.addEventListener('submit', event => {
  event.preventDefault();
  const query = document.querySelector('#site-search-input').value.trim();
  if (!query) return;
  const legislationSearch = document.querySelector('#legislation-search');
  legislationSearch.value = query;
  legislationSearch.dispatchEvent(new Event('input', { bubbles: true }));
  location.hash = 'legislation'; searchPanel.hidden = true; searchToggle.setAttribute('aria-expanded', 'false');
});
document.querySelector('#language-toggle')?.addEventListener('click', event => applyLanguage(event.currentTarget.dataset.language === 'es' ? 'en' : 'es'));
document.querySelectorAll('#media-filters button').forEach(button => button.addEventListener('click', () => {
  mediaFilter = button.dataset.series;
  document.querySelectorAll('#media-filters button').forEach(item => item.classList.toggle('is-active', item === button));
  renderVideos();
}));
window.addEventListener('scroll', () => document.querySelector('.site-header')?.classList.toggle('is-scrolled', window.scrollY > 8), { passive: true });
applyLanguage('en'); initializeHome();
