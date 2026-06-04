(function () {
  function iconFor(category) {
    if (/Stormwater|Flood/i.test(category)) return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 34c-6 0-10-4-10-9s4-9 10-9c3-7 10-10 17-7 5 2 8 6 9 11 7 1 12 5 12 12 0 6-5 11-12 11H18z"/><path d="M22 48l-3 7M34 48l-3 7M46 48l-3 7"/></svg>';
    if (/Pump/i.test(category)) return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 44h36v10H14z"/><path d="M20 44V22h22v22"/><path d="M26 22v-8h10v8"/><path d="M42 30h8c4 0 6 2 6 6v8"/><path d="M25 32h12"/></svg>';
    if (/Fire/i.test(category)) return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M31 55c-9-4-14-10-14-18 0-8 5-13 10-18 1 6 5 9 9 12 2-6 1-12-2-18 9 6 15 14 15 25 0 8-6 14-18 17z"/><path d="M32 45c-4-2-6-5-6-9 0-3 2-6 5-9 2 5 7 7 7 12 0 3-2 5-6 6z"/></svg>';
    if (/Neighborhood/i.test(category)) return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 50h40"/><path d="M18 50V26l14-10 14 10v24"/><path d="M26 50V36h12v14"/><path d="M12 34h8M44 34h8"/><path d="M32 16V8"/></svg>';
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8c10 12 16 21 16 30 0 10-7 18-16 18s-16-8-16-18c0-9 6-18 16-30z"/><path d="M24 39c2 4 5 6 10 6"/></svg>';
  }

  function spread(projects) {
    const buckets = new Map();
    projects.forEach(project => {
      const key = `${Math.round(project.lat * 1300)}:${Math.round(project.lng * 1300)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(project);
    });
    const positions = new Map();
    buckets.forEach(group => {
      const ordered = [...group].sort((a, b) => a.id.localeCompare(b.id));
      if (ordered.length === 1) {
        positions.set(ordered[0].id, { mapLat: ordered[0].lat, mapLng: ordered[0].lng });
        return;
      }
      const radius = Math.min(0.00024, 0.0001 + ordered.length * 0.000018);
      ordered.forEach((project, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index / ordered.length);
        positions.set(project.id, {
          mapLat: project.lat + Math.sin(angle) * radius,
          mapLng: project.lng + Math.cos(angle) * radius
        });
      });
    });
    return projects.map(project => ({ ...project, ...(positions.get(project.id) || { mapLat: project.lat, mapLng: project.lng }) }));
  }

  renderMap = function () {
    state.layer.clearLayers();
    state.markers = [];
    const visiblePins = spread(state.filtered);
    visiblePins.forEach(project => {
      const color = colorForCategory(project.category);
      const linkText = state.view === 'future' ? 'Open source presentation' : 'Open official project page';
      const detail = state.view === 'future' ? `${project.area} / ${project.category} / ${formatMoney(project.totalNeed)}` : `${project.area} / ${project.category}`;
      const marker = L.marker([project.mapLat, project.mapLng], { icon: pin(color) }).bindPopup(`<div class="popup"><strong>${project.title}</strong><p><i style="background:${color}"></i>${detail}</p><a href="${project.link}" target="_blank" rel="noreferrer">${linkText}</a></div>`);
      marker.addTo(state.layer);
      state.markers.push(marker);
    });
    if (state.userMarker) state.userMarker.addTo(state.layer);
    const points = [...visiblePins.map(project => [project.mapLat, project.mapLng]), ...(state.origin ? [[state.origin.lat, state.origin.lng]] : [])];
    if (points.length > 1) state.map.fitBounds(points, { padding: [34, 34], maxZoom: 14 });
    if (points.length === 1) state.map.setView(points[0], 14);
  };

  renderList = function () {
    const label = state.view === 'future' ? 'future project' : 'project';
    els.count.textContent = `${state.filtered.length} ${label}${state.filtered.length === 1 ? '' : 's'}`;
    els.title.textContent = state.origin ? `Near ${state.origin.label} within ${state.radius} mile${state.radius === 1 ? '' : 's'}` : DATASET_LABELS[state.view].title;
    if (!state.filtered.length) {
      els.list.innerHTML = '<p>No projects match this search. Try a larger radius or fewer filters.</p>';
      return;
    }
    const linkText = state.view === 'future' ? 'Open source presentation' : 'Open official project page';
    els.list.innerHTML = state.filtered.map(project => `
      <article class="project-card">
        ${project.image ? `<img class="thumb" src="${project.image}" alt="">` : state.view === 'future' ? `<div class="thumb future-thumb" style="--thumb-color:${colorForCategory(project.category)}" aria-hidden="true">${iconFor(project.category)}</div>` : '<div class="thumb" aria-hidden="true"></div>'}
        <div>
          <h3>${project.title}</h3>
          ${state.view === 'future' ? `<div class="future-meta"><span class="cost-pill">${formatMoney(project.totalNeed)} planned need</span><span class="cost-pill">${project.phaseWindow}</span></div>` : ''}
          <p>${project.summary || project.address || 'Project details available from the official city page.'}</p>
          <div class="meta">
            <span class="pill">${project.area}</span>
            <span class="pill">${project.hood}</span>
            <span class="pill">${project.category}</span>
            ${state.view === 'future' ? `<span class="pill">${project.address}</span>` : ''}
            ${project.distance != null ? `<span class="pill">${project.distance.toFixed(2)} mi</span>` : ''}
          </div>
          <p><a href="${project.link}" target="_blank" rel="noreferrer">${linkText}</a></p>
        </div>
      </article>`).join('');
  };

  setTimeout(() => {
    try {
      if (state.projects.length) applyFilters();
    } catch (error) {
      console.warn('Future map fixes could not rerender yet', error);
    }
  }, 800);
})();
