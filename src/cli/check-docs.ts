// Link-rot check for the STATIC fields the daily feed build never touches.
//
// The daily build (src/cli/build.ts) re-fetches every cidr_feed and republishes
// dist/, but a Tier 2/3 bot's `docs:` URLs are only ever checked by a human. A
// docs page that starts 404ing, redirecting to a parked domain, or going dark is
// exactly the failure mode behind most of the deferred/rejected ledger rows, and
// nothing catches it for entries already listed. This CLI fetches each docs URL
// and reports the dead ones. Report-only by design: transient anti-bot blocks
// (403/429) and known cross-host redirects are surfaced as warnings, not failures,
// so a temporarily grumpy operator site never breaks CI.

import { loadBots } from '../lib/loadBots.js';

const TIMEOUT_MS = 15_000;
const CONCURRENCY = 8;

// Only strong "this page is gone" signals fail (404/410, DNS/connection failure).
// 5xx and timeouts are transient; 400/401/403/405/429 are anti-bot soft-blocks
// (Meta answers a bare fetch with 400) — both warn instead, so CI noise stays low.
type Verdict = 'ok' | 'dead' | 'flaky' | 'blocked' | 'redirected';
interface Result {
  botId: string;
  url: string;
  verdict: Verdict;
  detail: string;
}

function host(u: string): string {
  try {
    // Drop a leading www. so a bare www→apex redirect isn't flagged as cross-host.
    return new URL(u).host.replace(/^www\./, '');
  } catch {
    return u;
  }
}

async function checkUrl(botId: string, url: string): Promise<Result> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ac.signal,
      headers: {
        // A real browser UA — many operator docs sit behind bot filters that 403 a bare fetch.
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    const finalHost = host(res.url || url);
    if (res.status >= 200 && res.status < 300) {
      if (finalHost !== host(url)) {
        return { botId, url, verdict: 'redirected', detail: `200 but redirected to ${finalHost}` };
      }
      return { botId, url, verdict: 'ok', detail: `HTTP ${res.status}` };
    }
    // 404/410 are the only HTTP statuses that reliably mean "gone".
    if (res.status === 404 || res.status === 410) {
      return { botId, url, verdict: 'dead', detail: `HTTP ${res.status}` };
    }
    // 5xx is a server hiccup, not proof of rot — re-checked next run.
    if (res.status >= 500) {
      return { botId, url, verdict: 'flaky', detail: `HTTP ${res.status} (server error, re-check)` };
    }
    // Anti-bot / auth walls (incl. Meta's 400 soft-block) — warn, don't fail.
    return { botId, url, verdict: 'blocked', detail: `HTTP ${res.status} (likely anti-bot, verify by hand)` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // A timeout is transient; a DNS/connection failure means the domain is really gone.
    if (ac.signal.aborted) {
      return { botId, url, verdict: 'flaky', detail: `timeout after ${TIMEOUT_MS}ms (re-check)` };
    }
    return { botId, url, verdict: 'dead', detail: `unreachable: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const bots = loadBots(new URL('../../bots', import.meta.url).pathname);
const targets: { botId: string; url: string }[] = [];
for (const bot of bots) {
  for (const url of bot.docs) targets.push({ botId: bot.id, url });
}

const results = await mapPool(targets, CONCURRENCY, (t) => checkUrl(t.botId, t.url));

const dead = results.filter((r) => r.verdict === 'dead');
const flaky = results.filter((r) => r.verdict === 'flaky');
const blocked = results.filter((r) => r.verdict === 'blocked');
const redirected = results.filter((r) => r.verdict === 'redirected');

// Dead first (actionable), then the warnings.
const order: Verdict[] = ['dead', 'flaky', 'redirected', 'blocked'];
for (const v of order) {
  for (const r of results) {
    if (r.verdict === v) console.log(`${r.verdict.toUpperCase().padEnd(10)} ${r.botId} ${r.url} — ${r.detail}`);
  }
}

console.log(
  `\nchecked ${targets.length} docs URLs across ${bots.length} bots: ` +
    `${dead.length} dead, ${flaky.length} flaky (5xx/timeout), ` +
    `${blocked.length} blocked/anti-bot, ${redirected.length} cross-host redirects.`,
);

if (dead.length > 0) {
  console.error(`\n${dead.length} docs URL(s) appear dead — the entries above need a human to re-source or drop them.`);
  process.exit(2);
}
