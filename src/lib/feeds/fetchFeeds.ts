import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFeed } from './parsers.js';
import { diffRanges } from './diff.js';
import { sanitizeCidrs } from '../cidr.js';
import type { Bot } from '../validateBot.js';

export type Fetcher = (url: string) => Promise<{ status: number; body: string }>;

export interface FeedOutcome {
  botId: string;
  url: string;
  status: 'ok' | 'held' | 'error';
  ranges: string[];
  detail?: string;
}

const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'verifiedbots-pipeline/1.0' } });
  return { status: res.status, body: await res.text() };
};

function readLkg(path: string): string[] {
  if (!existsSync(path)) return [];
  return (JSON.parse(readFileSync(path, 'utf8')).ranges as string[]) ?? [];
}

export async function fetchAllFeeds(bots: Bot[], lkgDir: string, fetcher: Fetcher = defaultFetcher): Promise<FeedOutcome[]> {
  mkdirSync(lkgDir, { recursive: true });
  const outcomes: FeedOutcome[] = [];
  for (const bot of bots) {
    const feeds = bot.verification.filter((v) => v.type === 'cidr_feed');
    for (let i = 0; i < feeds.length; i++) {
      const feed = feeds[i] as Extract<Bot['verification'][number], { type: 'cidr_feed' }>;
      const lkgPath = join(lkgDir, `${bot.id}--${i}.json`);
      const lkgRanges = readLkg(lkgPath);
      const fail = (detail: string): FeedOutcome => ({ botId: bot.id, url: feed.url, status: 'error', ranges: lkgRanges, detail });
      if (!feed.url.startsWith('https://')) {
        outcomes.push(fail('non-https feed URL'));
        continue;
      }
      let body: string;
      try {
        const res = await fetcher(feed.url);
        if (res.status !== 200) {
          outcomes.push(fail(`HTTP ${res.status}`));
          continue;
        }
        body = res.body;
      } catch (e) {
        outcomes.push(fail(`fetch failed: ${(e as Error).message}`));
        continue;
      }
      let ranges: string[];
      try {
        ranges = sanitizeCidrs(parseFeed(feed.format, body, feed.selector));
      } catch (e) {
        outcomes.push(fail((e as Error).message));
        continue;
      }
      const diff = diffRanges(lkgRanges, ranges);
      if (diff.suspicious) {
        outcomes.push({
          botId: bot.id,
          url: feed.url,
          status: 'held',
          ranges: lkgRanges,
          detail: `suspicious diff: +${diff.added}/-${diff.removed} (ratio ${diff.changeRatio.toFixed(2)})`,
        });
        continue;
      }
      writeFileSync(lkgPath, JSON.stringify({ url: feed.url, fetched_at: new Date().toISOString(), ranges }, null, 2));
      outcomes.push({ botId: bot.id, url: feed.url, status: 'ok', ranges });
    }
  }
  return outcomes;
}
