const HOME_DATA = {
  youtube: 'data/youtube.json',
  calendar: 'data/city-calendar.json',
  agenda: 'data/city-agenda.json',
  actions: 'data/commission-actions.json',
  news: 'data/city-news.json',
  projects: 'data/city-projects.json',
  records: 'data/records-status.json'
};

const UI_COPY = {
  en: {
    nav: ['Home', 'Next agenda', 'Decisions & votes', 'Projects', 'Watch'],
    search: 'Search Miami Beach', today: 'Miami Beach Today', todaySource: 'Official city sources',
    dashboard: 'Resident dashboard'
  },
  es: {
    nav: ['Inicio', 'Próxima agenda', 'Decisiones y votos', 'Proyectos', 'Ver'],
    search: 'Buscar Miami Beach', today: 'Miami Beach Hoy', todaySource: 'Fuentes oficiales de la ciudad',
    dashboard: 'Panel para residentes'
  }
};

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

function renderOfficialUpdates(calendar, agenda, actions, news, projects, records) {
  const meeting = agenda.nextMeeting;
  const latestNews = news.items[0];
  const project = projects.items.find(item => item.phase === 'Construction' && item.title && item.link) || projects.items.find(item => item.phase === 'Construction');
  const ordinance = records.items.find(item => item.type === 'ordinances');
  const meetingDescription = meeting ? `${displayDate(meeting.date, { short: true })} · ${meeting.itemCount} agenda items` : 'Check upcoming public meetings.';
  document.querySelector('#official-updates').innerHTML = [
    officialItem('fa-regular fa-calendar', 'Next commission agenda', meeting?.type || 'City Commission', meetingDescription, meeting?.officialAgendaUrl || calendar.source.url, 'Open official agenda'),
    officialItem('fa-solid fa-person-digging', 'Public Works update', project?.title || 'Active Public Works projects', project ? `${project.phase}${project.neighborhood ? ` · ${project.neighborhood}` : ''}` : `${projects.items.length} mapped project features`, project?.link || projects.source.url, 'View project source'),
    officialItem('fa-regular fa-newspaper', latestNews?.label || 'Official city news', latestNews?.title || 'City press releases', latestNews ? displayDate(latestNews.publishedAt, { short: true }) : 'Current City of Miami Beach announcements.', latestNews?.url || news.source.url, 'Read update')
  ].join('');
  document.querySelector('#meeting-summary').textContent = meeting ? `Next City Commission agenda: ${displayDate(meeting.date, { short: true })}, with ${meeting.itemCount} listed items.` : 'See upcoming public meetings and check whether an agenda is available.';
  document.querySelector('#current-agenda-link').href = 'commission-agenda/';
  document.querySelector('#official-agenda-link').href = meeting?.officialAgendaUrl || records.source.url;
  const passed = actions.items.filter(item => item.outcome === 'Passed').length;
  const amended = actions.items.filter(item => item.amendments.length).length;
  document.querySelector('#decisions-summary').textContent = `${passed.toLocaleString()} passed actions and ${amended} amended items are indexed from approved 2026 minutes through ${displayDate(actions.coverage.throughDate, { short: true })}.`;
  document.querySelector('#project-summary').textContent = `${projects.items.length} official construction, design, and planning features are available in the current city snapshot.`;
  document.querySelector('#records-summary').textContent = ordinance ? `The official ordinance registry currently runs through ${displayDate(ordinance.currentThrough, { short: true })}.` : 'Search the City Clerk registry, then use the tracker below for resident-friendly context.';
}

function applyLanguage(language) {
  const copy = UI_COPY[language];
  document.documentElement.lang = language;
  document.querySelectorAll('#site-nav a').forEach((link, index) => { link.textContent = copy.nav[index]; });
  document.querySelector('#search-toggle span').textContent = copy.search;
  document.querySelector('#today-title').textContent = copy.today;
  document.querySelector('.today-panel header p').textContent = copy.todaySource;
  document.querySelector('#resident-dashboard h2').textContent = copy.dashboard;
  const toggle = document.querySelector('#language-toggle');
  toggle.textContent = language === 'en' ? 'ES' : 'EN';
  toggle.setAttribute('aria-label', language === 'en' ? 'Cambiar a español' : 'Switch to English');
  toggle.dataset.language = language;
}

async function initializeHome() {
  try {
    const [youtube, calendar, agenda, actions, news, projects, records] = await Promise.all(Object.values(HOME_DATA).map(loadJson));
    renderFeatured(youtube); renderOfficialUpdates(calendar, agenda, actions, news, projects, records);
  } catch (error) {
    console.error('Could not load resident hub data', error);
    document.querySelector('#official-updates').innerHTML = '<p class="loading-copy">Official updates are temporarily unavailable. Use the source links below.</p>';
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
  location.href = `legislation/?q=${encodeURIComponent(query)}`;
});
document.querySelector('#language-toggle')?.addEventListener('click', event => applyLanguage(event.currentTarget.dataset.language === 'es' ? 'en' : 'es'));
const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('.site-nav');
menuToggle?.addEventListener('click', () => {
  const open = siteNav.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(open));
});
siteNav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  siteNav.classList.remove('is-open');
  menuToggle?.setAttribute('aria-expanded', 'false');
}));
window.addEventListener('scroll', () => document.querySelector('.site-header')?.classList.toggle('is-scrolled', window.scrollY > 8), { passive: true });
applyLanguage('en'); initializeHome();
