import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchAllFeeds, type Fetcher } from '../src/lib/feeds/fetchFeeds.js';
import type { Bot } from '../src/lib/validateBot.js';

const bot = (id: string, url: string): Bot => ({
  id,
  name: id,
  operator: { name: 'Op', url: 'https://example.com' },
  description: 'A test bot used only inside unit tests here.',
  docs: ['https://example.com'],
  category: 'monitoring',
  user_agents: { patterns: [`${id}/\\d`], instances: [`${id}/1.0`] },
  behavior: { respects_robots_txt: true },
  verification: [{ type: 'cidr_feed', url, format: 'prefixes' }],
});

const prefixBody = (cidrs: string[]) =>
  JSON.stringify({ prefixes: cidrs.map((c) => ({ ipv4Prefix: c })) });

let lkg: string;
beforeEach(() => {
  lkg = mkdtempSync(join(tmpdir(), 'lkg-'));
});

describe('fetchAllFeeds', () => {
  it('fetches, sanitizes, and writes last-known-good on ok', async () => {
    const fetcher: Fetcher = async () => ({ status: 200, body: prefixBody(['66.249.64.0/27']) });
    const out = await fetchAllFeeds([bot('googlebot', 'https://feeds.example/g.json')], lkg, fetcher);
    expect(out[0]).toMatchObject({ status: 'ok', ranges: ['66.249.64.0/27'] });
    const saved = JSON.parse(readFileSync(join(lkg, 'googlebot--0.json'), 'utf8'));
    expect(saved.ranges).toEqual(['66.249.64.0/27']);
  });
  it('falls back to LKG on HTTP error', async () => {
    writeFileSync(join(lkg, 'googlebot--0.json'), JSON.stringify({ url: 'x', fetched_at: 'y', ranges: ['66.249.64.0/27'] }));
    const fetcher: Fetcher = async () => ({ status: 503, body: '' });
    const out = await fetchAllFeeds([bot('googlebot', 'https://feeds.example/g.json')], lkg, fetcher);
    expect(out[0]).toMatchObject({ status: 'error', ranges: ['66.249.64.0/27'] });
  });
  it('errors on poisoned feed (private range) without updating LKG', async () => {
    writeFileSync(join(lkg, 'googlebot--0.json'), JSON.stringify({ url: 'x', fetched_at: 'y', ranges: ['66.249.64.0/27'] }));
    const fetcher: Fetcher = async () => ({ status: 200, body: prefixBody(['10.0.0.0/16']) });
    const out = await fetchAllFeeds([bot('googlebot', 'https://feeds.example/g.json')], lkg, fetcher);
    expect(out[0].status).toBe('error');
    expect(out[0].ranges).toEqual(['66.249.64.0/27']);
    expect(JSON.parse(readFileSync(join(lkg, 'googlebot--0.json'), 'utf8')).ranges).toEqual(['66.249.64.0/27']);
  });
  it('holds a suspicious diff and keeps LKG', async () => {
    // Sorted lexicographically, since readLkg runs stored ranges through sanitizeCidrs (which sorts).
    const oldRanges = Array.from({ length: 50 }, (_, i) => `8.${i}.0.0/16`).sort();
    writeFileSync(join(lkg, 'googlebot--0.json'), JSON.stringify({ url: 'x', fetched_at: 'y', ranges: oldRanges }));
    const newRanges = Array.from({ length: 50 }, (_, i) => `9.${i}.0.0/16`);
    const fetcher: Fetcher = async () => ({ status: 200, body: prefixBody(newRanges) });
    const out = await fetchAllFeeds([bot('googlebot', 'https://feeds.example/g.json')], lkg, fetcher);
    expect(out[0].status).toBe('held');
    expect(out[0].ranges).toEqual(oldRanges); // LKG returned exactly as stored (post-sanitize sort order)
  });
  it('rejects non-https URLs defensively', async () => {
    const b = bot('badbot', 'https://ok.example/f.json');
    (b.verification[0] as any).url = 'http://evil.example/f.json';
    const fetcher: Fetcher = async () => ({ status: 200, body: prefixBody(['93.184.0.0/24']) });
    const out = await fetchAllFeeds([b], lkg, fetcher);
    expect(out[0]).toMatchObject({ status: 'error', ranges: [] });
  });
  it('skips bots with no cidr_feed', async () => {
    const b = bot('nofeed', 'https://x/y.json');
    b.verification = [];
    const fetcher: Fetcher = async () => ({ status: 200, body: '' });
    expect(await fetchAllFeeds([b], lkg, fetcher)).toEqual([]);
    expect(existsSync(join(lkg, 'nofeed--0.json'))).toBe(false);
  });
  it('reports error with LKG fallback when the fetcher rejects', async () => {
    writeFileSync(join(lkg, 'googlebot--0.json'), JSON.stringify({ url: 'x', fetched_at: 'y', ranges: ['66.249.64.0/27'] }));
    const fetcher: Fetcher = async () => { throw 'socket hang up'; }; // non-Error throw on purpose
    const out = await fetchAllFeeds([bot('googlebot', 'https://feeds.example/g.json')], lkg, fetcher);
    expect(out[0]).toMatchObject({ status: 'error', ranges: ['66.249.64.0/27'] });
    expect(out[0].detail).toContain('socket hang up');
  });
  it('treats a corrupt LKG file as absent instead of crashing the run', async () => {
    writeFileSync(join(lkg, 'googlebot--0.json'), '{truncated');
    const fetcher: Fetcher = async () => ({ status: 200, body: prefixBody(['66.249.64.0/27']) });
    const out = await fetchAllFeeds([bot('googlebot', 'https://feeds.example/g.json')], lkg, fetcher);
    expect(out[0]).toMatchObject({ status: 'ok', ranges: ['66.249.64.0/27'] });
    expect(JSON.parse(readFileSync(join(lkg, 'googlebot--0.json'), 'utf8')).ranges).toEqual(['66.249.64.0/27']);
  });
  it('treats a poisoned committed LKG file (private/bogon range) as absent, not served', async () => {
    writeFileSync(join(lkg, 'googlebot--0.json'), JSON.stringify({ url: 'x', fetched_at: 'y', ranges: ['10.0.0.0/16'] }));
    const fetcher: Fetcher = async () => ({ status: 503, body: '' });
    const out = await fetchAllFeeds([bot('googlebot', 'https://feeds.example/g.json')], lkg, fetcher);
    expect(out[0]).toMatchObject({ status: 'error', ranges: [] });
  });
});

describe('failure severity', () => {
  const run = (fetcher: Fetcher, url = 'https://feeds.example/g.json') =>
    fetchAllFeeds([bot('googlebot', url)], lkg, fetcher);

  it('marks a gone URL hard so CI fails on it', async () => {
    for (const status of [400, 404, 405, 410, 414, 451]) {
      const out = await run(async () => ({ status, body: '' }));
      expect(out[0], `HTTP ${status}`).toMatchObject({ status: 'error', severity: 'hard' });
    }
  });

  it('marks a throttled or broken origin soft so last-known-good covers it', async () => {
    for (const status of [403, 429, 500, 502, 503]) {
      const out = await run(async () => ({ status, body: '' }));
      expect(out[0], `HTTP ${status}`).toMatchObject({ status: 'error', severity: 'soft' });
    }
  });

  it('marks a transport failure soft but DNS NXDOMAIN hard', async () => {
    const flaky = await run(async () => { throw new Error('fetch failed'); });
    expect(flaky[0]).toMatchObject({ severity: 'soft' });

    const gone = await run(async () => {
      const cause = Object.assign(new Error('getaddrinfo ENOTFOUND feeds.example'), { code: 'ENOTFOUND' });
      throw new Error('fetch failed', { cause });
    });
    expect(gone[0]).toMatchObject({ severity: 'hard' });
  });

  it('marks a non-https URL and an unparseable body hard', async () => {
    const b = bot('badbot', 'https://ok.example/f.json');
    (b.verification[0] as any).url = 'http://evil.example/f.json';
    const insecure = await fetchAllFeeds([b], lkg, async () => ({ status: 200, body: '{}' }));
    expect(insecure[0]).toMatchObject({ severity: 'hard' });

    const wrongShape = await run(async () => ({ status: 200, body: '<html>Just a moment…</html>' }));
    expect(wrongShape[0]).toMatchObject({ status: 'error', severity: 'hard' });
  });

  it('marks a held diff soft and leaves ok outcomes with no severity', async () => {
    const oldRanges = Array.from({ length: 50 }, (_, i) => `8.${i}.0.0/16`).sort();
    writeFileSync(join(lkg, 'googlebot--0.json'), JSON.stringify({ url: 'x', fetched_at: 'y', ranges: oldRanges }));
    const newRanges = Array.from({ length: 50 }, (_, i) => `9.${i}.0.0/16`);
    const held = await run(async () => ({ status: 200, body: prefixBody(newRanges) }));
    expect(held[0]).toMatchObject({ status: 'held', severity: 'soft' });

    const fine = await fetchAllFeeds([bot('other', 'https://feeds.example/o.json')], lkg, async () => ({
      status: 200,
      body: prefixBody(['66.249.64.0/27']),
    }));
    expect(fine[0].severity).toBeUndefined();
  });
});

describe('acceptHeld', () => {
  const oldRanges = Array.from({ length: 50 }, (_, i) => `8.${i}.0.0/16`).sort();
  const newRanges = Array.from({ length: 50 }, (_, i) => `9.${i}.0.0/16`).sort();
  const fetcher: Fetcher = async () => ({ status: 200, body: prefixBody(newRanges) });
  const seed = () =>
    writeFileSync(join(lkg, 'googlebot--0.json'), JSON.stringify({ url: 'x', fetched_at: 'y', ranges: oldRanges }));

  it('writes LKG for an accepted diff, unsticking a permanently held feed', async () => {
    seed();
    const out = await fetchAllFeeds([bot('googlebot', 'https://feeds.example/g.json')], lkg, fetcher, {
      acceptHeld: new Set(['googlebot']),
    });
    expect(out[0]).toMatchObject({ status: 'ok', ranges: newRanges });
    expect(out[0].detail).toContain('accepted diff');
    expect(JSON.parse(readFileSync(join(lkg, 'googlebot--0.json'), 'utf8')).ranges).toEqual(newRanges);
  });

  it('accepts a single feed by index without affecting the bot other feeds', async () => {
    seed();
    const byIndex = await fetchAllFeeds([bot('googlebot', 'https://feeds.example/g.json')], lkg, fetcher, {
      acceptHeld: new Set(['googlebot--0']),
    });
    expect(byIndex[0].status).toBe('ok');

    seed();
    const wrongIndex = await fetchAllFeeds([bot('googlebot', 'https://feeds.example/g.json')], lkg, fetcher, {
      acceptHeld: new Set(['googlebot--1']),
    });
    expect(wrongIndex[0].status).toBe('held');
  });

  it('never bypasses the poisoned-range check, only the diff guard', async () => {
    seed();
    const out = await fetchAllFeeds([bot('googlebot', 'https://feeds.example/g.json')], lkg, async () => ({
      status: 200,
      body: prefixBody(['10.0.0.0/16']),
    }), { acceptHeld: new Set(['googlebot']) });
    expect(out[0]).toMatchObject({ status: 'error', severity: 'hard' });
    expect(JSON.parse(readFileSync(join(lkg, 'googlebot--0.json'), 'utf8')).ranges).toEqual(oldRanges);
  });
});
