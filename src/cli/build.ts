import { loadBots } from '../lib/loadBots.js';
import { fetchAllFeeds } from '../lib/feeds/fetchFeeds.js';
import { buildArtifacts } from '../lib/build/artifacts.js';

const root = (p: string) => new URL(`../../${p}`, import.meta.url).pathname;
const bots = loadBots(root('bots'));
const outcomes = await fetchAllFeeds(bots, root('data/last-known-good'));
buildArtifacts(bots, outcomes, root('dist'), new Date().toISOString());
const held = outcomes.filter((o) => o.status !== 'ok');
console.log(`built dist/ for ${bots.length} bots; ${outcomes.length} feeds (${held.length} held/errored)`);
if (held.length > 0) {
  for (const o of held) console.error(`  ${o.status}: ${o.botId} ${o.url} — ${o.detail}`);
  process.exit(2); // build succeeded on LKG data, but flag for the workflow to open an issue
}
