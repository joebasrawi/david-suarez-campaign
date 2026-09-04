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
  amendedOnly: false,
  davidOnly: false
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
  document.querySelector('#coverage-summary').textContent = `2026 records through ${displayDate(coverage.throughDate)} · ${meetings.length} meetings indexed from published minutes`;
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
      && (!state.amendedOnly || item.amendments.length > 0)
      && (!state.davidOnly || item.sponsors.includes('david-suarez'));
  }).sort((a, b) => b.meetingDate.localeCompare(a.meetingDate) || a.itemNumber.localeCompare(b.itemNumber, undefined, { numeric: true }));
}

function renderList({ preserveSelection = true } = {}) {
  const items = filteredItems();
  document.querySelector('#result-count').textContent = `${items.length.toLocaleString()} recorded ${items.length === 1 ? 'action' : 'actions'} shown`;
  document.querySelector('#list-count').textContent = items.length.toLocaleString();
  const list = document.querySelector('#decision-list');
  if(!preserveSelection)list.scrollTop=0;
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
    <p class="detail-section">Approved minutes · ${escapeHtml(meeting?.title || 'City Commission Meeting')}</p>${/first reading/i.test(item.action)?'<p class="notice"><strong>First reading—not final adoption.</strong> This recorded action advances an ordinance for further consideration.</p>':""}
    <div class="action-summary"><span>Recorded action</span><p>${escapeHtml(item.action)}</p></div>
    <div class="detail-facts">
      <div class="detail-fact"><span>Vote path</span><strong>${escapeHtml(item.voteType)}</strong></div>
      <div class="detail-fact"><span>Vote result</span><strong>${escapeHtml(item.voteSummary || 'Not separately recorded')}</strong></div>
      <div class="detail-fact"><span>Amendments</span><strong>${item.amendments.length ? 'Yes — see below' : 'No amendment identified'}</strong></div>
    </div>
    <div class="detail-tools"><button type="button" data-copy-link>Copy decision link</button><a href="../meetings/">Meeting history</a></div>
    <p class="source-note">${escapeHtml(item.voteBasis || 'Extracted from approved minutes. Verify the official record.')}</p>
    <div class="vote-panel"><div class="vote-overview"><h3>Commission vote</h3><span class="vote-score">${escapeHtml(item.voteSummary || '—')}</span><span class="vote-kind">${escapeHtml(item.voteType)}</span></div><div class="roll-call"><h3>Member-by-member record</h3>${renderRollCall(item)}</div></div>
    ${item.amendments.length ? `<section class="amendment-panel"><h3><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Amendment recorded</h3>${item.amendments.map(amendment => `<p>${escapeHtml(amendment)}</p>`).join('')}</section>` : ''}
    ${item.motion ? `<section class="motion-panel"><h3>Motion</h3><p>${escapeHtml(item.motion)}</p></section>` : ''}
    <section class="sponsors-section"><h3 class="detail-label">Elected sponsors listed in the record</h3>${renderSponsors(item)}</section>
    <div class="details-stack">${item.recordExcerpt ? `<details><summary>Read the extracted action record</summary><div class="details-body record-evidence">${escapeHtml(item.recordExcerpt)}${item.recordExcerpt.length >= 18000 ? "\nExcerpt shortened. See the linked minutes for the complete record." : ""}</div></details>` : ""}<details><summary>Official agenda title</summary><div class="details-body"><p>${escapeHtml(item.title)}</p></div></details></div>
    <div class="official-record"><i class="fa-solid fa-scale-balanced" aria-hidden="true"></i><div><strong>Verify the official record</strong><p>The approved City minutes are the source for this outcome, vote, and amendment summary.</p></div><div class="decision-links"><a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">Open approved minutes <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>${meeting?.videoUrl ? `<a href="${escapeHtml(meeting.videoUrl)}" target="_blank" rel="noreferrer">Watch meeting</a>` : ''}</div></div>
  </div>`;
  const params = new URLSearchParams(location.search);
  params.set('item', item.id);
  for(const [key,value] of Object.entries({q:state.query,meeting:state.meeting,outcome:state.outcome,vote:state.voteType,amended:state.amendedOnly?'1':'',david:state.davidOnly?'1':''})){if(value && value!=='all')params.set(key,value);else params.delete(key);}
  if(state.outcome==='all')params.set('outcome','all');
  history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
}

function resetFilters() {
  state.query = '';
  state.meeting = 'all';
  state.outcome = 'Passed';
  state.voteType = 'all';
  state.amendedOnly = false;
  state.davidOnly = false;
  document.querySelector("#decision-david").checked=false;
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
    document.querySelectorAll('#decision-list [data-item]').forEach(card=>{const selected=card.dataset.item===state.selectedId;card.classList.toggle('is-selected',selected);card.setAttribute('aria-pressed',String(selected));});
    renderDetail();document.querySelector('#decision-detail').scrollTop=0;
    if (matchMedia('(max-width: 860px)').matches) document.querySelector('#decision-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.querySelector('#decision-search').addEventListener('input', event => { state.query = event.target.value.trim(); renderList({ preserveSelection: false }); });
  document.querySelector('#meeting-filter').addEventListener('change', event => { state.meeting = event.target.value; renderList({ preserveSelection: false }); });
  document.querySelector('#outcome-filter').addEventListener('change', event => { state.outcome = event.target.value; renderList({ preserveSelection: false }); });
  document.querySelector('#vote-type-filter').addEventListener('change', event => { state.voteType = event.target.value; renderList({ preserveSelection: false }); });
  document.querySelector('#decision-david').addEventListener('change',event=>{state.davidOnly=event.target.checked;renderList({preserveSelection:false});});
  document.querySelector('#amended-filter').addEventListener('change', event => { state.amendedOnly = event.target.checked; renderList({ preserveSelection: false }); });
  document.querySelector('#reset-filters').addEventListener('click', resetFilters);

}

async function initialize() {
  try {
    const [data, commissioners] = await Promise.all([loadJson(DATA_URLS.actions), loadJson(DATA_URLS.commissioners)]);
    state.data = data;
    state.people = new Map(commissioners.items.map(person => [person.slug, person]));
    const params=new URLSearchParams(location.search);
    state.selectedId=params.get('item');
    state.query=params.get('q')||'';
    state.meeting=params.get('meeting')||'all';
    state.outcome=params.get('outcome')||'Passed';
    state.voteType=params.get('vote')||'all';
    state.amendedOnly=params.get('amended')==='1';
    state.davidOnly=params.get('david')==='1';
    const selected=data.items.find(item=>item.id===state.selectedId);
    if(selected&&!params.has('outcome'))state.outcome=selected.outcome;
    renderCoverage();
    setupFilters();
    document.querySelector('#decision-search').value=state.query;
    document.querySelector('#meeting-filter').value=state.meeting;
    document.querySelector('#outcome-filter').value=state.outcome;
    document.querySelector('#vote-type-filter').value=state.voteType;
    document.querySelector('#amended-filter').checked=state.amendedOnly;
    document.querySelector('#decision-david').checked=state.davidOnly;
    renderList();
    bindEvents();
  } catch (error) {
    console.error('Could not load commission decisions', error);
    document.querySelector('#decision-detail').innerHTML = '<div class="empty-detail"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><h2>Decision history temporarily unavailable</h2><p>Please use the official PrimeGov archive above while this page refreshes.</p></div>';
  }
}

initialize();
