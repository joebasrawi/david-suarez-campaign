const DATA_URLS = {
  actions: '../data/commission-actions.json',
  commissioners: '../data/commissioners.json'
};

const state = {
  data: null,
  people: new Map(),
  selectedId: null,
  query: '',
  meeting: 'all',
  outcome: 'Passed',
  voteType: 'all',
  amendedOnly: false
};

function escapeHtml(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function displayDate(value, short = false) {
  if (!value) return 'Date unavailable';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', short
    ? { month: 'short', day: 'numeric', year: 'numeric' }
    : { month: 'long', day: 'numeric', year: 'numeric' });
}

function friendlyTitle(value = '') {
  const trimmed = value
    .replace(/^(?:A RESOLUTION|AN ORDINANCE) OF THE MAYOR AND CITY COMMISSION OF THE CITY OF MIAMI BEACH,? FLORIDA,?\s*/i, '')
    .replace(/^REQUEST FOR APPROVAL TO\s*/i, '')
    .replace(/^DISCUSS(?:\/TAKE ACTION)?(?:\s*[-–—:]\s*|\s+)/i, '')
    .split(/;\s+(?:AND|FURTHER)\b/i)[0]
    .replace(/\s+/g, ' ')
    .trim();
  const shortened = trimmed.length > 210 ? `${trimmed.slice(0, 207).replace(/\s+\S*$/, '')}…` : trimmed;
  return shortened.toLowerCase()
    .replace(/^./, letter => letter.toUpperCase())
    .replace(/\bmiami beach\b/g, 'Miami Beach')
    .replace(/\bmiami-dade\b/g, 'Miami-Dade')
    .replace(/\b(rfp|rfq|itb|itn|fy|derm|lpr|far|ldr|nbcra|rda)\b/g, word => word.toUpperCase());
}

async function loadJson(url) {
  const response = await fetch(`${url}?v=20260904b`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function populateSelect(selector, values) {
  const select = document.querySelector(selector);
  values.forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
}

function renderCoverage() {
  const { coverage, meetings, items } = state.data;
  const passed = items.filter(item => item.outcome === 'Passed').length;
  const amended = items.filter(item => item.amendments.length).length;
  document.querySelector('#coverage-summary').textContent = `January 1 through ${displayDate(coverage.throughDate)} · Refreshes automatically when the City publishes approved minutes`;
  document.querySelector('#passed-stat').textContent = passed.toLocaleString();
  document.querySelector('#meeting-stat').textContent = coverage.publishedMinutesCount;
  document.querySelector('#amended-stat').textContent = amended;
  document.querySelector('#meeting-status-row').innerHTML = meetings.map(meeting => `<span class="${meeting.minutesStatus.includes('Pending') ? 'is-pending' : ''}"><i class="fa-solid ${meeting.minutesStatus.includes('Pending') ? 'fa-clock' : 'fa-circle-check'}" aria-hidden="true"></i>${escapeHtml(displayDate(meeting.date, true))}: ${escapeHtml(meeting.minutesStatus)}</span>`).join('');
}

function setupFilters() {
  populateSelect('#meeting-filter', [...state.data.meetings].reverse().map(meeting => ({ value: meeting.date, label: `${displayDate(meeting.date, true)} · ${meeting.title}` })));
  const outcomes = [...new Set(state.data.items.map(item => item.outcome))].sort();
  populateSelect('#outcome-filter', outcomes.filter(value => value !== 'Passed').map(value => ({ value, label: value })));
  populateSelect('#vote-type-filter', [...new Set(state.data.items.map(item => item.voteType))].sort().map(value => ({ value, label: value })));
}

function filteredItems() {
  const query = state.query.toLowerCase();
  return state.data.items.filter(item => {
    const sponsorText = item.sponsors.map(slug => state.people.get(slug)?.name || '').join(' ');
    const haystack = [item.itemNumber, item.title, item.action, item.motion, item.voteSummary, item.voteType, item.outcome, sponsorText, ...item.amendments].join(' ').toLowerCase();
    return (!query || haystack.includes(query))
      && (state.meeting === 'all' || item.meetingDate === state.meeting)
      && (state.outcome === 'all' || item.outcome === state.outcome)
      && (state.voteType === 'all' || item.voteType === state.voteType)
      && (!state.amendedOnly || item.amendments.length > 0);
  }).sort((a, b) => b.meetingDate.localeCompare(a.meetingDate) || a.itemNumber.localeCompare(b.itemNumber, undefined, { numeric: true }));
}

function renderList({ preserveSelection = true } = {}) {
  const items = filteredItems();
  document.querySelector('#result-count').textContent = `${items.length.toLocaleString()} recorded ${items.length === 1 ? 'action' : 'actions'} shown`;
  document.querySelector('#list-count').textContent = items.length.toLocaleString();
  const list = document.querySelector('#decision-list');
  if (!items.length) {
    list.innerHTML = '<div class="empty-list"><strong>No decisions match these filters.</strong><br>Try searching another phrase or clearing a filter.</div>';
    state.selectedId = null;
    renderDetail();
    return;
  }
  if (!preserveSelection || !items.some(item => item.id === state.selectedId)) state.selectedId = items[0].id;
  list.innerHTML = items.map(item => `<button type="button" class="agenda-card decision-card ${state.selectedId === item.id ? 'is-selected' : ''}" data-item="${escapeHtml(item.id)}" aria-pressed="${state.selectedId === item.id}">
    <span class="agenda-number">${escapeHtml(item.itemNumber)}</span>
    <span class="agenda-card-copy">
      <h3>${escapeHtml(friendlyTitle(item.title))}</h3>
      <span class="decision-badges"><span class="${item.outcome === 'Passed' ? 'is-passed' : ''}">${escapeHtml(item.outcome)}</span><span>${escapeHtml(item.voteType)}</span>${item.amendments.length ? '<span class="is-amended">Amended</span>' : ''}</span>
      <span class="decision-date">${escapeHtml(displayDate(item.meetingDate, true))}${item.voteSummary ? ` · ${escapeHtml(item.voteSummary)}` : ''}</span>
    </span>
  </button>`).join('');
  renderDetail();
}

function renderSponsors(item) {
  if (!item.sponsors.length) return '<p class="department-sponsors">No elected sponsor was identified in the approved minutes for this item.</p>';
  return `<div class="sponsor-grid">${item.sponsors.map(slug => {
    const person = state.people.get(slug);
    if (!person) return '';
    return `<a class="sponsor-card" href="${escapeHtml(person.profileUrl)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(person.portrait)}" alt="Official portrait of ${escapeHtml(person.name)}"><span><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.title)} · ${escapeHtml(person.group)}</span></span></a>`;
  }).join('')}</div>`;
}

function renderRollCall(item) {
  if (!item.rollCall.length) return '<p class="roll-call-empty">The approved minutes do not list a separate member-by-member roll call for this action.</p>';
  return `<div class="roll-call-list">${item.rollCall.map(vote => `<span class="roll-call-item ${/David Suarez/i.test(vote.member) ? 'is-david' : ''}"><span>${escapeHtml(vote.member)}</span><strong>${escapeHtml(vote.vote)}</strong></span>`).join('')}</div>`;
}

function renderDetail() {
  const detail = document.querySelector('#decision-detail');
  const item = state.data?.items.find(candidate => candidate.id === state.selectedId);
  if (!item) {
    detail.innerHTML = '<div class="empty-detail"><i class="fa-regular fa-circle-check" aria-hidden="true"></i><h2>Select a decision</h2><p>Choose an item to see its vote path, roll call, amendments, sponsors, and official minutes.</p></div>';
    return;
  }
  const meeting = state.data.meetings.find(candidate => candidate.id === item.meetingId);
  detail.innerHTML = `<div class="detail-inner">
    <div class="detail-topline"><div class="detail-ident"><span class="detail-number">${escapeHtml(item.itemNumber)}</span><span class="detail-type">${escapeHtml(displayDate(item.meetingDate))}</span></div><span class="outcome-badge" data-outcome="${escapeHtml(item.outcome)}">${escapeHtml(item.outcome)}</span></div>
    <h2>${escapeHtml(friendlyTitle(item.title))}</h2>
    <p class="detail-section">Approved minutes · ${escapeHtml(meeting?.title || 'City Commission Meeting')}</p>
    <div class="action-summary"><span>Recorded action</span><p>${escapeHtml(item.action)}</p></div>
    <div class="detail-facts">
      <div class="detail-fact"><span>Vote path</span><strong>${escapeHtml(item.voteType)}</strong></div>
      <div class="detail-fact"><span>Vote result</span><strong>${escapeHtml(item.voteSummary || 'Not separately recorded')}</strong></div>
      <div class="detail-fact"><span>Amendments</span><strong>${item.amendments.length ? 'Yes — see below' : 'None recorded'}</strong></div>
    </div>
    <div class="vote-panel"><div class="vote-overview"><h3>Commission vote</h3><span class="vote-score">${escapeHtml(item.voteSummary || '—')}</span><span class="vote-kind">${escapeHtml(item.voteType)}</span></div><div class="roll-call"><h3>Member-by-member record</h3>${renderRollCall(item)}</div></div>
    ${item.amendments.length ? `<section class="amendment-panel"><h3><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Amendment recorded</h3>${item.amendments.map(amendment => `<p>${escapeHtml(amendment)}</p>`).join('')}</section>` : ''}
    ${item.motion ? `<section class="motion-panel"><h3>Motion</h3><p>${escapeHtml(item.motion)}</p></section>` : ''}
    <section class="sponsors-section"><h3 class="detail-label">Elected sponsors listed in the record</h3>${renderSponsors(item)}</section>
    <div class="details-stack"><details><summary>Official agenda title</summary><div class="details-body"><p>${escapeHtml(item.title)}</p></div></details></div>
    <div class="official-record"><i class="fa-solid fa-scale-balanced" aria-hidden="true"></i><div><strong>Verify the official record</strong><p>The approved City minutes are the source for this outcome, vote, and amendment summary.</p></div><div class="decision-links"><a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">Open approved minutes <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>${meeting?.videoUrl ? `<a href="${escapeHtml(meeting.videoUrl)}" target="_blank" rel="noreferrer">Watch meeting</a>` : ''}</div></div>
  </div>`;
  const params = new URLSearchParams(location.search);
  params.set('item', item.id);
  history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
}

function resetFilters() {
  state.query = '';
  state.meeting = 'all';
  state.outcome = 'Passed';
  state.voteType = 'all';
  state.amendedOnly = false;
  document.querySelector('#decision-search').value = '';
  document.querySelector('#meeting-filter').value = 'all';
  document.querySelector('#outcome-filter').value = 'Passed';
  document.querySelector('#vote-type-filter').value = 'all';
  document.querySelector('#amended-filter').checked = false;
  renderList({ preserveSelection: false });
}

function bindEvents() {
  document.querySelector('#decision-list').addEventListener('click', event => {
    const button = event.target.closest('[data-item]');
    if (!button) return;
    state.selectedId = button.dataset.item;
    renderList();
    if (matchMedia('(max-width: 860px)').matches) document.querySelector('#decision-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.querySelector('#decision-search').addEventListener('input', event => { state.query = event.target.value.trim(); renderList({ preserveSelection: false }); });
  document.querySelector('#meeting-filter').addEventListener('change', event => { state.meeting = event.target.value; renderList({ preserveSelection: false }); });
  document.querySelector('#outcome-filter').addEventListener('change', event => { state.outcome = event.target.value; renderList({ preserveSelection: false }); });
  document.querySelector('#vote-type-filter').addEventListener('change', event => { state.voteType = event.target.value; renderList({ preserveSelection: false }); });
  document.querySelector('#amended-filter').addEventListener('change', event => { state.amendedOnly = event.target.checked; renderList({ preserveSelection: false }); });
  document.querySelector('#reset-filters').addEventListener('click', resetFilters);
  document.querySelector('#menu-toggle').addEventListener('click', event => {
    const open = document.querySelector('#site-nav').classList.toggle('is-open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
  });
}

async function initialize() {
  try {
    const [data, commissioners] = await Promise.all([loadJson(DATA_URLS.actions), loadJson(DATA_URLS.commissioners)]);
    state.data = data;
    state.people = new Map(commissioners.items.map(person => [person.slug, person]));
    state.selectedId = new URLSearchParams(location.search).get('item');
    renderCoverage();
    setupFilters();
    renderList();
    bindEvents();
  } catch (error) {
    console.error('Could not load commission decisions', error);
    document.querySelector('#decision-detail').innerHTML = '<div class="empty-detail"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><h2>Decision history temporarily unavailable</h2><p>Please use the official PrimeGov archive above while this page refreshes.</p></div>';
  }
}

initialize();
