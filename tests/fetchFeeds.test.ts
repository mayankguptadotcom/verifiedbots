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
    const oldRanges = Array.from({ length: 50 }, (_, i) => `8.${i}.0.0/16`);
    writeFileSync(join(lkg, 'googlebot--0.json'), JSON.stringify({ url: 'x', fetched_at: 'y', ranges: oldRanges }));
    const newRanges = Array.from({ length: 50 }, (_, i) => `9.${i}.0.0/16`);
    const fetcher: Fetcher = async () => ({ status: 200, body: prefixBody(newRanges) });
    const out = await fetchAllFeeds([bot('googlebot', 'https://feeds.example/g.json')], lkg, fetcher);
    expect(out[0].status).toBe('held');
    expect(out[0].ranges).toEqual(oldRanges); // LKG returned exactly as stored
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
});
