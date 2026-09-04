import { cleanText, fetchText, isoNow, writeSnapshot } from './lib.mjs';

const CHANNEL_ID = 'UCFSRLFAu-wZdguhiP021UUA';
const CHANNEL_URL = 'https://www.youtube.com/@CommissionerDavidSuarez';
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

function tag(title) {
  const value = title.toLowerCase();
  if (value.includes('suarez sound off')) return 'Suarez Sound Off';
  if (value.includes('civics 101') || value.includes('government works')) return 'Miami Beach Civics';
  if (value.includes('ride along')) return 'Ride Along';
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
    series: tag(title),
    publishedAt: pick(entry, /<published>([^<]+)<\/published>/),
    updatedAt: pick(entry, /<updated>([^<]+)<\/updated>/),
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  };
});

if (items.length < 5 || items.some(item => !item.id || !item.title)) {
  throw new Error(`YouTube feed validation failed: received ${items.length} usable videos.`);
}

await writeSnapshot('data/youtube.json', {
  generatedAt: isoNow(),
  source: { label: 'Commissioner David Suarez on YouTube', url: CHANNEL_URL, feedUrl: FEED_URL },
  channelId: CHANNEL_ID,
  items
});

console.log(`Synced ${items.length} YouTube videos.`);
