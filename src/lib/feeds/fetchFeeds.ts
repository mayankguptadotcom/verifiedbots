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
  /**
   * Set on every non-ok outcome. 'hard' means the recipe itself is wrong and a human has to
   * fix or drop it — the URL is gone, not https, or no longer serves the declared shape.
   * 'soft' means the origin had a bad minute or the diff guard held this run; published data
   * falls back to last-known-good and the next run will very likely be clean. Callers use
   * this to decide whether to fail a build (see src/cli/fetch-feeds.ts).
   */
  severity?: 'hard' | 'soft';
}

export interface FetchOptions {
  /**
   * Feed keys — `<botId>` or `<botId>--<index>` — whose suspicious diff a maintainer has
   * reviewed and accepted. The diff guard is bypassed for those feeds and last-known-good is
   * written, which is the only way a held feed ever unsticks: a held feed never writes LKG,
   * so the same diff recurs on every subsequent run forever.
   */
  acceptHeld?: ReadonlySet<string>;
}

const MAX_BODY_BYTES = 5_000_000;

/**
 * HTTP statuses that mean the feed URL itself is wrong, per the judgment rule in CLAUDE.md
 * ("only remove or fix a recipe when the URL itself is genuinely wrong — 404/DNS failure/
 * moved"). Everything else — 403, 429, 5xx — is an origin or an egress path having a bad
 * minute, and has repeatedly been exactly that: api.github.com/meta 403s from some sandboxes
 * and resolves fine in CI.
 */
const HARD_HTTP_STATUSES = new Set([400, 404, 405, 410, 414, 451]);

/** True for a DNS NXDOMAIN, i.e. the host no longer exists. EAI_AGAIN (temporary resolver
 *  failure) deliberately does not count. */
function isDnsFailure(e: unknown): boolean {
  for (let cur: unknown = e, depth = 0; cur instanceof Error && depth < 5; cur = cur.cause, depth++) {
    if ((cur as NodeJS.ErrnoException).code === 'ENOTFOUND') return true;
  }
  return false;
}

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

export async function fetchAllFeeds(
  bots: Bot[],
  lkgDir: string,
  fetcher: Fetcher = defaultFetcher,
  opts: FetchOptions = {},
): Promise<FeedOutcome[]> {
  mkdirSync(lkgDir, { recursive: true });
  const outcomes: FeedOutcome[] = [];
  for (const bot of bots) {
    const feeds = bot.verification.filter((v) => v.type === 'cidr_feed');
    for (let i = 0; i < feeds.length; i++) {
      const feed = feeds[i] as Extract<Bot['verification'][number], { type: 'cidr_feed' }>;
      const lkgPath = join(lkgDir, `${bot.id}--${i}.json`);
      const lkgRanges = readLkg(lkgPath);
      const fail = (detail: string, severity: 'hard' | 'soft'): FeedOutcome =>
        ({ botId: bot.id, url: feed.url, status: 'error', ranges: lkgRanges, detail, severity });
      if (!feed.url.startsWith('https://')) {
        outcomes.push(fail('non-https feed URL', 'hard'));
        continue;
      }
      let body: string;
      try {
        const res = await fetcher(feed.url);
        if (res.status !== 200) {
          outcomes.push(fail(`HTTP ${res.status}`, HARD_HTTP_STATUSES.has(res.status) ? 'hard' : 'soft'));
          continue;
        }
        body = res.body;
      } catch (e) {
        outcomes.push(fail(`fetch failed: ${errMessage(e)}`, isDnsFailure(e) ? 'hard' : 'soft'));
        continue;
      }
      let ranges: string[];
      try {
        ranges = sanitizeCidrs(parseFeed(feed.format, body, feed.selector));
      } catch (e) {
        // The URL answered 200 but the body is not the declared shape (or carries poisoned
        // ranges). That is the recipe being wrong, not the origin being slow.
        outcomes.push(fail(errMessage(e), 'hard'));
        continue;
      }
      const diff = diffRanges(lkgRanges, ranges);
      const accepted = opts.acceptHeld?.has(bot.id) || opts.acceptHeld?.has(`${bot.id}--${i}`);
      if (diff.suspicious && !accepted) {
        outcomes.push({
          botId: bot.id,
          url: feed.url,
          status: 'held',
          ranges: lkgRanges,
          detail: `suspicious diff: +${diff.added}/-${diff.removed} (ratio ${diff.changeRatio.toFixed(2)})`,
          severity: 'soft',
        });
        continue;
      }
      // Atomic write: write to a temp file in the same directory, then rename, so a crash
      // mid-write can never leave a corrupt/truncated LKG trust anchor on disk.
      const tmpPath = `${lkgPath}.tmp`;
      writeFileSync(tmpPath, JSON.stringify({ url: feed.url, fetched_at: new Date().toISOString(), ranges }, null, 2));
      renameSync(tmpPath, lkgPath);
      outcomes.push({
        botId: bot.id,
        url: feed.url,
        status: 'ok',
        ranges,
        ...(diff.suspicious
          ? { detail: `accepted diff: +${diff.added}/-${diff.removed} (ratio ${diff.changeRatio.toFixed(2)})` }
          : {}),
      });
    }
  }
  return outcomes;
}
