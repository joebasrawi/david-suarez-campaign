export const HOME_VIDEO_SERIES = ['Suarez Sound Off', 'Miami Beach Civics', 'Ride Along', 'Accountability'];

// Feature the newest upload, not the newest episode of just one program.
// Keep one current thumbnail per existing series without expanding the layout.
export function selectHomeVideos(items) {
  const videos = (Array.isArray(items) ? items : []).filter(item =>
    item && typeof item.id === 'string' && /^[\w-]{11}$/.test(item.id) && typeof item.title === 'string' && item.title.trim() &&
    typeof item.series === 'string' && typeof item.publishedAt === 'string' && Number.isFinite(Date.parse(item.publishedAt))
  ).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const selected = [videos[0], ...HOME_VIDEO_SERIES.map(series => videos.find(item => item.series === series))].filter(Boolean);
  return [...new Map(selected.map(item => [item.id, item])).values()];
}

export const homeVideoTitle = item => item.series === 'Suarez Sound Off'
  ? item.title.replace(/^Suarez Sound Off\s*Ep\.\s*\d+\s*[—-]\s*/i, '').replace(/\s*\|.*$/, '')
  : item.title;
export const homeVideoDate = item => new Date(item.publishedAt).toLocaleDateString('en-US', {
  month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York'
});

function updateImage(image, item) {
  if (!image) return;
  const high = `https://i.ytimg.com/vi/${item.id}/maxresdefault.jpg`;
  const fallback = `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
  // Assign handlers rather than stacking listeners on repeated refreshes.
  image.onerror = () => { if (image.src !== fallback) image.src = fallback; };
  image.onload = () => { if (image.naturalWidth < 200) image.onerror(); };
  image.alt = item.title;
  if (image.src !== high && image.src !== fallback) image.src = high;
  if (image.complete && image.naturalWidth < 200) image.onerror();
}

export function renderHomeVideos(items, root = document) {
  const videos = selectHomeVideos(items), featured = videos[0];
  // Leave the built snapshot intact when the request is empty or malformed.
  if (!featured) return;
  const find = selector => root.querySelector(selector);
  find('#featured-title').textContent = homeVideoTitle(featured);
  find('#featured-series').textContent = featured.series;
  find('#featured-date').textContent = homeVideoDate(featured);
  find('#featured-link').href = `media/?video=${featured.id}`;
  find('#featured-link').innerHTML = 'Watch video <span aria-hidden="true">↗</span>';
  updateImage(find('#featured-image'), featured);
  for (const series of HOME_VIDEO_SERIES) {
    const item = videos.find(video => video.series === series);
    if (item) updateImage(find(`[data-video-series="${series}"] img`), item);
  }
}
