import { loadBots } from '../lib/loadBots.js';

try {
  const bots = loadBots(new URL('../../bots', import.meta.url).pathname);
  console.log(`OK: ${bots.length} bots valid`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
