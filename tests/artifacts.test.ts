import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildArtifacts } from '../src/lib/build/artifacts.js';
import type { Bot } from '../src/lib/validateBot.js';
import type { FeedOutcome } from '../src/lib/feeds/fetchFeeds.js';

const googlebot: Bot = {
  id: 'googlebot',
  name: 'Googlebot',
  operator: { name: 'Google', url: 'https://www.google.com' },
  description: "Google's primary web crawler for Search indexing.",
  docs: ['https://developers.google.com/search/docs/crawling-indexing/verifying-googlebot'],
  category: 'search-engine',
  user_agents: { patterns: ['Googlebot/\\d'], instances: ['Googlebot/2.1 (+http://www.google.com/bot.html)'] },
  behavior: { respects_robots_txt: true, robots_token: 'Googlebot' },
  verification: [
    { type: 'cidr_feed', url: 'https://developers.google.com/static/search/apis/ipranges/googlebot.json', format: 'prefixes' },
    { type: 'static_cidrs', cidrs: ['66.249.90.0/28'] },
  ],
};
const claudebot: Bot = {
  ...googlebot,
  id: 'claudebot',
  name: 'ClaudeBot',
  category: 'ai-crawler',
  user_agents: { patterns: ['ClaudeBot/\\d'], instances: ['ClaudeBot/1.0'] },
  verification: [],
};
const outcomes: FeedOutcome[] = [
  { botId: 'googlebot', url: 'https://developers.google.com/static/search/apis/ipranges/googlebot.json', status: 'ok', ranges: ['66.249.64.0/27'] },
];

describe('buildArtifacts', () => {
  const out = mkdtempSync(join(tmpdir(), 'dist-'));
  buildArtifacts([googlebot, claudebot], outcomes, out, '2026-07-07T00:00:00Z');
  const all = JSON.parse(readFileSync(join(out, 'all.json'), 'utf8'));

  it('writes all.json with tiers and resolved cidrs', () => {
    expect(all.count).toBe(2);
    expect(all.generated_at).toBe('2026-07-07T00:00:00Z');
    const g = all.bots.find((b: any) => b.id === 'googlebot');
    expect(g.tier).toBe(1);
    expect(g.resolved_cidrs).toEqual(['66.249.64.0/27', '66.249.90.0/28']);
    const c = all.bots.find((b: any) => b.id === 'claudebot');
    expect(c).toMatchObject({ tier: 3, tier_label: 'Listed only', resolved_cidrs: [] });
  });
  it('writes per-category and per-bot files', () => {
    const cat = JSON.parse(readFileSync(join(out, 'by-category/search-engine.json'), 'utf8'));
    expect(cat.bots.map((b: any) => b.id)).toEqual(['googlebot']);
    expect(JSON.parse(readFileSync(join(out, 'bots/claudebot.json'), 'utf8')).id).toBe('claudebot');
  });
  it('writes .ips files only for bots with ranges', () => {
    expect(readFileSync(join(out, 'ips/googlebot.ips'), 'utf8')).toBe('66.249.64.0/27\n66.249.90.0/28\n');
    expect(existsSync(join(out, 'ips/claudebot.ips'))).toBe(false);
    expect(readFileSync(join(out, 'ips/all.ips'), 'utf8')).toBe('66.249.64.0/27\n66.249.90.0/28\n');
  });
  it('writes ua-patterns.json', () => {
    const ua = JSON.parse(readFileSync(join(out, 'ua-patterns.json'), 'utf8'));
    expect(ua).toEqual([
      { id: 'claudebot', category: 'ai-crawler', patterns: ['ClaudeBot/\\d'] },
      { id: 'googlebot', category: 'search-engine', patterns: ['Googlebot/\\d'] },
    ]);
  });
});

describe('buildArtifacts dist retraction', () => {
  it('removes stale files from outDir that no longer correspond to a built bot', () => {
    const out = mkdtempSync(join(tmpdir(), 'dist-stale-'));
    mkdirSync(join(out, 'bots'), { recursive: true });
    writeFileSync(join(out, 'bots', 'removed-bot.json'), '{"id":"removed-bot"}');
    buildArtifacts([claudebot], [], out, '2026-07-07T00:00:00Z');
    expect(existsSync(join(out, 'bots', 'removed-bot.json'))).toBe(false);
    expect(existsSync(join(out, 'bots', 'claudebot.json'))).toBe(true);
  });
});
