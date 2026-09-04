const DATA_URLS = {
  agenda: '../data/city-agenda.json',
  commissioners: '../data/commissioners.json'
};

const state = {
  agenda: null,
  people: new Map(),
  activeSection: 'all',
  selectedItem: null,
  query: '',
  department: 'all',
  neighborhood: 'all',
  hearing: 'all',
  status: 'all',
  davidOnly: false
};

function escapeHtml(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function displayDate(value) {
  if (!value) return 'Date not listed';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function statusLabel(item) {
  if (/withdrawn/i.test(item.status)) return 'Withdrawal noted';
  if (/defer|continued/i.test(item.status)) return 'Deferral history noted';
  if (/first reading/i.test(item.status)) return 'First reading noted';
  if (/second reading/i.test(item.status)) return 'Second reading noted';
  if (/addendum/i.test(item.status)) return 'Addendum noted';
  return 'On agenda';
}
function optionLabel(value) {
  return value || 'Not specified';
}

async function loadJson(url) {
  const response = await fetch(`${url}?v=20260904`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function uniqueValues(items, getter) {
  return [...new Set(items.flatMap(getter).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function populateSelect(id, values) {
  const select = document.querySelector(id);
  const first = select.options[0];
  select.replaceChildren(first, ...values.map(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    return option;
  }));
}

function setupFilters() {
  const items = state.agenda.items;
  populateSelect('#department-filter', uniqueValues(items, item => item.departments));
  populateSelect('#neighborhood-filter', uniqueValues(items, item => [item.neighborhood]));
  populateSelect('#hearing-filter', uniqueValues(items, item => [item.hearingTime]));
  populateSelect('#status-filter', uniqueValues(items, item => [statusLabel(item)]));
}

function renderMeeting() {
  const meeting = state.agenda.nextMeeting;
  document.querySelector('#meeting-title').textContent = `Commission Agenda: ${displayDate(meeting.date).replace(/^[^,]+, /, '')}`;
  document.querySelector('#meeting-meta').textContent = `${displayDate(meeting.date)} · ${meeting.location} · ${meeting.itemCount} items`;
  document.querySelector('#official-agenda-link').href = meeting.officialAgendaUrl;
}

function renderTabs() {
  const tabs = [{ id: 'all', label: 'All items', count: state.agenda.items.length }, ...state.agenda.sections];
  document.querySelector('#section-tabs').innerHTML = tabs.map(tab => `<button type="button" role="tab" aria-selected="${state.activeSection === tab.id}" class="${state.activeSection === tab.id ? 'is-active' : ''}" data-section="${escapeHtml(tab.id)}">${escapeHtml(tab.label)} <span class="tab-count">${tab.count}</span></button>`).join('');
}

function filteredItems() {
  const query = state.query.toLowerCase();
  return state.agenda.items.filter(item => {
    const haystack = [item.itemNumber, item.title, item.officialTitle, item.section, item.neighborhood, item.status, ...item.departments, ...item.sponsors].join(' ').toLowerCase();
    return (state.activeSection === 'all' || item.section.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === state.activeSection)
      && (!query || haystack.includes(query))
      && (state.department === 'all' || item.departments.includes(state.department))
      && (state.neighborhood === 'all' || item.neighborhood === state.neighborhood)
      && (state.hearing === 'all' || item.hearingTime === state.hearing)
      && (state.status === 'all' || statusLabel(item) === state.status)
      && (!state.davidOnly || item.davidInvolved);
  });
}

function listMeta(item) {
  const department = item.departments[0] || item.type;
  return `<span>${escapeHtml(department)}</span>${item.davidInvolved ? '<span class="david-mark"><i class="fa-solid fa-star" aria-hidden="true"></i> David</span>' : ''}`;
}

function renderList({ preserveSelection = true } = {}) {
  const items = filteredItems();
  document.querySelector('#result-count').textContent = `${items.length} of ${state.agenda.items.length} agenda items shown`;
  document.querySelector('#list-count').textContent = items.length;
  const list = document.querySelector('#item-list');
  if(!preserveSelection)list.scrollTop=0;
  if (!items.length) {
    list.innerHTML = '<div class="empty-list"><strong>No items match these filters.</strong><br>Try clearing one or more filters.</div>';
    state.selectedItem = null;
    renderDetail();
    return;
  }
  if (!preserveSelection || !items.some(item => item.id === state.selectedItem)) state.selectedItem = items[0].id;
  list.innerHTML = items.map(item => `<button type="button" class="agenda-card ${state.selectedItem === item.itemNumber ? 'is-selected' : ''}" data-item="${escapeHtml(item.id)}" aria-pressed="${state.selectedItem === item.itemNumber}">
    <span class="agenda-number">${escapeHtml(item.itemNumber)}</span>
    <span class="agenda-card-copy"><h3>${escapeHtml(item.title)}</h3><span class="agenda-card-meta">${listMeta(item)}</span></span>
  </button>`).join('');
  renderDetail();
}

function sponsorCards(item) {
  if (!item.officialSponsors.length) return '<p class="department-sponsors">No elected official is listed as a sponsor on the source page.</p>';
  return `<div class="sponsor-grid">${item.officialSponsors.map(slug => {
    const person = state.people.get(slug);
    if (!person) return '';
    return `<a class="sponsor-card" href="${escapeHtml(person.profileUrl)}" target="_blank" rel="noreferrer">
      <img src="${escapeHtml(person.portrait)}" alt="Official portrait of ${escapeHtml(person.name)}">
      <span><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.title)} · ${escapeHtml(person.group)}</span></span>
    </a>`;
  }).join('')}</div>`;
}

function renderDetail() {
  const detail = document.querySelector('#item-detail');
  const item = state.agenda.items.find(candidate => candidate.id === state.selectedItem);
  if (!item) {
    detail.innerHTML = '<div class="empty-detail"><i class="fa-regular fa-file-lines" aria-hidden="true"></i><h2>Select an agenda item</h2><p>Choose an item from the list to see its resident-friendly overview and official sponsors.</p></div>';
    return;
  }
  const departments = item.departments.length ? item.departments.join(', ') : 'No department listed';
  const electedLabel = item.officialSponsors.length === 1 ? 'Elected sponsor' : 'Elected sponsors';
  detail.innerHTML = `<div class="detail-inner">
    <div class="detail-topline">
      <div class="detail-ident"><span class="detail-number">${escapeHtml(item.itemNumber)}</span><span class="detail-type">${escapeHtml(item.type)}</span></div>
      <span class="status-badge">${escapeHtml(statusLabel(item))}</span>
    </div>
    <h2>${escapeHtml(item.title)}</h2>
    <p class="detail-section">${escapeHtml(item.section)}</p>
    <div class="resident-overview"><span>Agenda item—not a recorded decision</span><p>Scheduled for consideration. This is not evidence that the item passed. Short titles are navigation aids from the third-party agenda navigator; consult the official title and packet.</p></div>
    <div class="detail-tools"><button type="button" data-copy-link>Copy item link</button><a href="../meetings/">Meeting details & participation</a><a href="../commission-actions/?q=${encodeURIComponent(item.title)}&outcome=all">Search recorded actions</a></div>
    <div class="detail-facts">
      <div class="detail-fact"><span>Department</span><strong>${escapeHtml(departments)}</strong></div>
      <div class="detail-fact"><span>Neighborhood</span><strong>${escapeHtml(optionLabel(item.neighborhood))}</strong></div>
      <div class="detail-fact"><span>Hearing time</span><strong>${escapeHtml(optionLabel(item.hearingTime))}</strong></div>
    </div>
    <section class="sponsors-section" aria-labelledby="sponsors-label"><h3 class="detail-label" id="sponsors-label">${electedLabel}</h3>${sponsorCards(item)}${item.departments.length ? `<p class="department-sponsors"><strong>Department sponsor:</strong> ${escapeHtml(departments)}</p>` : ''}</section>
    <div class="official-record">
      <i class="fa-solid fa-scale-balanced" aria-hidden="true"></i>
      <div><strong>Check the official record</strong><p>PrimeGov is the legal source for the final language, attachments, and any meeting updates.</p></div>
      <a href="${escapeHtml(state.agenda.nextMeeting.officialAgendaUrl)}" target="_blank" rel="noreferrer">Open PrimeGov <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>
    </div>
    <div class="details-stack">
      <details><summary>Source status & history</summary><div class="details-body"><p>${escapeHtml(item.status)}</p></div></details><details open><summary>Official agenda title</summary><div class="details-body"><p>${escapeHtml(item.officialTitle)}</p></div></details>
      <details><summary>Source and item navigation</summary><div class="details-body"><p>This resident guide uses a third-party agenda navigator to organize item-level metadata while preserving the official PrimeGov meeting link.</p><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Open this item in the agenda navigator</a></div></details>
    </div>
  </div>`;
  const params = new URLSearchParams(location.search);
  params.set('item', item.id);
  for (const [key,value] of Object.entries({q:state.query,department:state.department,neighborhood:state.neighborhood,hearing:state.hearing,status:state.status,section:state.activeSection,david:state.davidOnly?'1':''})) { if(value && value!=='all') params.set(key,value); else params.delete(key); }
  history.replaceState(null, '', `${location.pathname}?${params.toString()}${location.hash}`);
}

function resetFilters() {
  state.query = '';
  state.department = 'all';
  state.neighborhood = 'all';
  state.hearing = 'all';
  state.status = 'all';
  state.davidOnly = false;
  state.activeSection = 'all';
  document.querySelector('#agenda-search').value = '';
  document.querySelector('#department-filter').value = 'all';
  document.querySelector('#neighborhood-filter').value = 'all';
  document.querySelector('#hearing-filter').value = 'all';
  document.querySelector('#status-filter').value = 'all';
  document.querySelector('#david-filter').checked = false;
  renderTabs();
  renderList({ preserveSelection: false });
}

function bindEvents() {
  document.querySelector('#section-tabs').addEventListener('click', event => {
    const button = event.target.closest('[data-section]');
    if (!button) return;
    state.activeSection = button.dataset.section;
    renderTabs();
    renderList({ preserveSelection: false });
  });
  document.querySelector('#item-list').addEventListener('click', event => {
    const button = event.target.closest('[data-item]');
    if (!button) return;
    state.selectedItem = button.dataset.item;
    document.querySelectorAll('#item-list [data-item]').forEach(card => { const selected=card.dataset.item===state.selectedItem;card.classList.toggle('is-selected',selected);card.setAttribute('aria-pressed',String(selected)); });
    renderDetail();
    document.querySelector('#item-detail').scrollTop=0;
    if (matchMedia('(max-width: 860px)').matches) document.querySelector('#item-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.querySelector('#agenda-search').addEventListener('input', event => { state.query = event.target.value.trim(); renderList({ preserveSelection: false }); });
  [['#department-filter', 'department'], ['#neighborhood-filter', 'neighborhood'], ['#hearing-filter', 'hearing'], ['#status-filter', 'status']].forEach(([selector, key]) => {
    document.querySelector(selector).addEventListener('change', event => { state[key] = event.target.value; renderList({ preserveSelection: false }); });
  });
  document.querySelector('#david-filter').addEventListener('change', event => { state.davidOnly = event.target.checked; renderList({ preserveSelection: false }); });
  document.querySelector('#reset-filters').addEventListener('click', resetFilters);

}

async function initialize() {
  try {
    const [agenda, commissioners] = await Promise.all([loadJson(DATA_URLS.agenda), loadJson(DATA_URLS.commissioners)]);
    state.agenda = agenda;
    state.people = new Map(commissioners.items.map(person => [person.slug, person]));
    const params = new URLSearchParams(location.search);
    state.selectedItem = state.agenda.items.find(item=>item.id===params.get('item') || item.itemNumber===params.get('item'))?.id;
    state.query=params.get('q')||'';
    state.davidOnly=params.get('david')==='1';
    for(const key of ['department','neighborhood','hearing','status'])state[key]=params.get(key)||'all';
    state.activeSection=params.get('section')||'all';
    renderMeeting();
    setupFilters();
    document.querySelector("#agenda-search").value=state.query;
    document.querySelector("#david-filter").checked=state.davidOnly;
    for(const key of ["department","neighborhood","hearing","status"])document.querySelector("#"+key+"-filter").value=state[key];
    renderTabs();
    renderList();
    bindEvents();
  } catch (error) {
    console.error('Could not load agenda reader', error);
    document.querySelector('#item-detail').innerHTML = '<div class="empty-detail"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><h2>Agenda temporarily unavailable</h2><p>Please use the official PrimeGov link above while this page refreshes.</p></div>';
  }
}

initialize();
