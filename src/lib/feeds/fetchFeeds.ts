import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
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

const MAX_BODY_BYTES = 5_000_000;

const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'verifiedbots-pipeline/1.0' },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.text();
  if (body.length > MAX_BODY_BYTES) throw new Error('feed body exceeds 5MB cap');
  return { status: res.status, body };
};

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function readLkg(path: string): string[] {
  if (!existsSync(path)) return [];
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (Array.isArray(data.ranges) && data.ranges.every((r: unknown) => typeof r === 'string')) {
      return sanitizeCidrs(data.ranges);
    }
  } catch {
    // Corrupt or poisoned (private/bogon/malformed range) LKG file: treat as absent
  }
  return [];
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
        outcomes.push(fail(`fetch failed: ${errMessage(e)}`));
        continue;
      }
      let ranges: string[];
      try {
        ranges = sanitizeCidrs(parseFeed(feed.format, body, feed.selector));
      } catch (e) {
        outcomes.push(fail(errMessage(e)));
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
      // Atomic write: write to a temp file in the same directory, then rename, so a crash
      // mid-write can never leave a corrupt/truncated LKG trust anchor on disk.
      const tmpPath = `${lkgPath}.tmp`;
      writeFileSync(tmpPath, JSON.stringify({ url: feed.url, fetched_at: new Date().toISOString(), ranges }, null, 2));
      renameSync(tmpPath, lkgPath);
      outcomes.push({ botId: bot.id, url: feed.url, status: 'ok', ranges });
    }
  }
  return outcomes;
}
