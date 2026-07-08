import { loadBots } from '../lib/loadBots.js';
import { checkWba } from '../lib/wba.js';

const bots = loadBots(new URL('../../bots', import.meta.url).pathname);
const rows = await checkWba(bots);
if (rows.length === 0) {
  console.log('no web_bot_auth recipes to check');
  process.exit(0);
}
let bad = 0;
for (const r of rows) {
  const ok = r.issues.length === 0;
  console.log(`${ok ? 'OK   ' : 'ERROR'} ${r.botId} ${r.url}${ok ? '' : ` — ${r.issues.join('; ')}`}`);
  if (!ok) bad++;
}
if (bad > 0) process.exit(1);
