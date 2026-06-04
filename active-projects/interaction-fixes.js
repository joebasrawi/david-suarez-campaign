(function () {
  els.reset = document.getElementById('reset-search');

  function hasActiveFilters() {
    return state.origin || els.hood.value !== 'all' || els.cat.value !== 'all' || els.radius.value !== '1' || els.address.value.trim();
  }

  function setResetVisibility() {
    if (els.reset) els.reset.hidden = !hasActiveFilters();
  }

  function clearSearch() {
    state.origin = null;
    state.radius = 1;
    els.address.value = '';
    els.radius.value = '1';
    els.hood.value = 'all';
    els.cat.value = 'all';
    if (state.userMarker) {
      state.layer.removeLayer(state.userMarker);
      state.userMarker = null;
    }
    els.status.textContent = 'Showing all projects.';
    applyFilters();
    setResetVisibility();
  }

  const originalLocalGuess = localGuess;
  geocode = async function (query) {
    const q = query.trim();
    const pair = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (pair) return { lat: +pair[1], lng: +pair[2], label: q };
    const local = originalLocalGuess(q);
    if (local) return local;
    const providers = [
      `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(q + ', Miami Beach, FL')}&f=json&maxLocations=1`,
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + ', Miami Beach, Florida')}`
    ];
    for (const url of providers) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.candidates?.[0]) return { lat: data.candidates[0].location.y, lng: data.candidates[0].location.x, label: q };
        if (data[0]) return { lat: +data[0].lat, lng: +data[0].lon, label: q };
      } catch (e) {
        console.warn('Geocoder failed', e);
      }
    }
    throw new Error('Address not found. Try a Miami Beach landmark, intersection, or coordinates.');
  };

  const originalSetView = setView;
  setView = function (view, shouldRender = true) {
    const origin = state.origin;
    const userMarker = state.userMarker;
    originalSetView(view, shouldRender);
    state.origin = origin;
    state.userMarker = userMarker;
    if (state.userMarker) state.userMarker.addTo(state.layer);
    els.status.textContent = state.origin ? `Showing projects within ${els.radius.value} mile${els.radius.value === '1' ? '' : 's'} of ${state.origin.label}.` : 'Search to highlight nearby projects.';
    setResetVisibility();
    if (shouldRender && state.origin) applyFilters();
  };

  const originalApplyFilters = applyFilters;
  applyFilters = function () {
    originalApplyFilters();
    setResetVisibility();
  };

  const originalRenderList = renderList;
  renderList = function () {
    originalRenderList();
    if (!state.filtered.length) {
      els.list.innerHTML = '<p>No projects match this search. Try a larger radius, fewer filters, or use Show all projects.</p>';
    }
  };

  els.reset?.addEventListener('click', clearSearch);
  [els.hood, els.cat, els.radius].forEach(el => el.addEventListener('change', setResetVisibility));
  els.address.addEventListener('input', setResetVisibility);
  setResetVisibility();
})();
