import { loadBots } from '../lib/loadBots.js';
import { fetchAllFeeds } from '../lib/feeds/fetchFeeds.js';

const bots = loadBots(new URL('../../bots', import.meta.url).pathname);
const outcomes = await fetchAllFeeds(bots, new URL('../../data/last-known-good', import.meta.url).pathname);
let bad = 0;
for (const o of outcomes) {
  console.log(`${o.status.toUpperCase().padEnd(5)} ${o.botId} ${o.url} (${o.ranges.length} ranges)${o.detail ? ` — ${o.detail}` : ''}`);
  if (o.status !== 'ok') bad++;
}
if (bad > 0) {
  console.error(`${bad} feed(s) held or errored — published data falls back to last-known-good`);
  process.exit(1);
}
