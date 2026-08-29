import { loadBots } from '../lib/loadBots.js';
import { fetchAllFeeds } from '../lib/feeds/fetchFeeds.js';

// `--accept-held a,b` / `--accept-held=a,b`: feed keys (`<botId>` or `<botId>--<index>`) whose
// suspicious diff a maintainer has reviewed and accepted, so the guard is bypassed and
// last-known-good is rewritten. Needed because a held feed never writes LKG, so without this
// the identical diff recurs on every run and the feed stays held forever.
function parseAcceptHeld(argv: string[]): Set<string> {
  const keys: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--accept-held=')) keys.push(arg.slice('--accept-held='.length));
    else if (arg === '--accept-held') keys.push(argv[++i] ?? '');
  }
  return new Set(keys.flatMap((k) => k.split(',')).map((k) => k.trim()).filter(Boolean));
}

const acceptHeld = parseAcceptHeld(process.argv.slice(2));
const bots = loadBots(new URL('../../bots', import.meta.url).pathname);
const outcomes = await fetchAllFeeds(bots, new URL('../../data/last-known-good', import.meta.url).pathname, undefined, {
  acceptHeld,
});

for (const o of outcomes) {
  console.log(`${o.status.toUpperCase().padEnd(5)} ${o.botId} ${o.url} (${o.ranges.length} ranges)${o.detail ? ` — ${o.detail}` : ''}`);
}

const unmatched = [...acceptHeld].filter(
  (k) => !outcomes.some((o) => o.botId === k || k.startsWith(`${o.botId}--`)),
);
if (unmatched.length > 0) {
  console.error(`--accept-held named no known feed: ${unmatched.join(', ')}`);
  process.exit(1);
}

// Exit 1 only when a recipe itself is broken and needs a human — the URL is gone, not https,
// or no longer serves the declared shape. A held diff or a flaky origin exits 2: published data
// falls back to last-known-good, which is working as designed, so it must not fail the build.
const hard = outcomes.filter((o) => o.severity === 'hard');
const soft = outcomes.filter((o) => o.severity === 'soft');
if (hard.length > 0) {
  console.error(`${hard.length} feed(s) have a broken recipe — fix or drop the URL:`);
  for (const o of hard) console.error(`  ${o.botId} ${o.url} — ${o.detail}`);
  process.exit(1);
}
if (soft.length > 0) {
  console.error(`${soft.length} feed(s) held or transiently failed — published data falls back to last-known-good`);
  process.exit(2);
}
