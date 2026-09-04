import { readFile } from 'node:fs/promises';
import { cleanText, fetchText, isoNow, writeSnapshot } from './lib.mjs';

const CHANNEL_ID = 'UCFSRLFAu-wZdguhiP021UUA';
const CHANNEL_URL = 'https://www.youtube.com/@CommissionerDavidSuarez';
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

function tag(title, id) {
  if (id === '2fU3AA-g20k') return 'Ride Along';
  if (id === 'V2sDUO2tT5Y') return 'Accountability';
  const value = title.toLowerCase();
  if (value.includes('suarez sound off')) return 'Suarez Sound Off';
  if (value.includes('civics 101') || value.includes('government works')) return 'Miami Beach Civics';
  if (/ride[ -]along/.test(value)) return 'Ride Along';
  return 'City Issues';
}

function pick(block, expression) {
  return cleanText(block.match(expression)?.[1] || '');
}

const xml = await fetchText(FEED_URL);
const items = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, entry]) => {
  const videoId = pick(entry, /<yt:videoId>([^<]+)<\/yt:videoId>/);
  const title = pick(entry, /<title>([\s\S]*?)<\/title>/);
  return {
    id: videoId,
    title,
    series: tag(title, videoId),
    publishedAt: pick(entry, /<published>([^<]+)<\/published>/),
    updatedAt: pick(entry, /<updated>([^<]+)<\/updated>/),
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  };
});

if (items.length < 5 || items.some(item => !item.id || !item.title)) {
  throw new Error(`YouTube feed validation failed: received ${items.length} usable videos.`);
}

const previous = JSON.parse(await readFile(new URL('../data/youtube.json', import.meta.url), 'utf8')).items;
const archive = new Map(previous.map(item => [item.id, {...item, series:tag(item.title,item.id)}]));
items.forEach(item => archive.set(item.id, {...archive.get(item.id), ...item}));
// The official RSS feed contains only 15 uploads. Preserve history and discover
// older full-length videos from the channel's public Videos page.
try {
  const html = await fetchText(`${CHANNEL_URL}/videos`);
  const initial = JSON.parse(html.match(/var ytInitialData = (.*?);<\/script>/s)?.[1] || '{}');
  const discovered = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    const video = value.lockupViewModel;
    if (video?.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') {
      const id = video.contentId;
      const title = video.metadata?.lockupMetadataViewModel?.title?.content;
      const duration = video.contentImage?.thumbnailViewModel?.overlays?.[0]?.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text;
      if (id && title) discovered.push({id,title,duration});
    } else Object.values(value).forEach(visit);
  }
  visit(initial.contents);
  for (const video of discovered) {
    if (archive.has(video.id)) { archive.set(video.id,{...archive.get(video.id), duration:video.duration}); continue; }
    const watch = await fetchText(`https://www.youtube.com/watch?v=${video.id}`);
    const publishedAt = watch.match(/"publishDate":"([^"]+)"/)?.[1] || watch.match(/itemprop="datePublished" content="([^"]+)"/)?.[1];
    // Do not fabricate a precise publication date from 'months ago'.
    if (!publishedAt) continue;
    archive.set(video.id,{...video,series:tag(video.title,video.id),publishedAt,updatedAt:publishedAt,url:`https://www.youtube.com/watch?v=${video.id}`,thumbnail:`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`});
  }
} catch (error) { console.warn(`Channel archive discovery unavailable; preserving saved videos: ${error.message}`); }
const archivedItems = [...archive.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
await writeSnapshot('data/youtube.json', {
  generatedAt: isoNow(),
  source: { label: 'Commissioner David Suarez on YouTube', url: CHANNEL_URL, feedUrl: FEED_URL },
  channelId: CHANNEL_ID,
  items: archivedItems
});

console.log(`Synced ${items.length} recent uploads; ${archivedItems.length} videos preserved in the archive.`);
