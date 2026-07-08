import { describe, it, expect } from 'vitest';
import { validateBotDocument } from '../src/lib/validateBot.js';

const validBot = () => ({
  id: 'googlebot',
  name: 'Googlebot',
  operator: { name: 'Google', url: 'https://www.google.com' },
  description: "Google's primary web crawler for Search indexing.",
  docs: ['https://developers.google.com/search/docs/crawling-indexing/verifying-googlebot'],
  category: 'search-engine',
  user_agents: {
    patterns: ['Googlebot/\\d'],
    instances: ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  },
  behavior: { respects_robots_txt: true, robots_token: 'Googlebot' },
  verification: [
    { type: 'cidr_feed', url: 'https://developers.google.com/static/search/apis/ipranges/googlebot.json', format: 'prefixes' },
    { type: 'rdns', masks: ['*.googlebot.com'] },
  ],
});

describe('validateBotDocument', () => {
  it('accepts a valid bot', () => {
    expect(validateBotDocument(validBot())).toEqual([]);
  });
  it('rejects schema violations', () => {
    const bot: any = validBot();
    bot.category = 'crypto-miner';
    expect(validateBotDocument(bot).length).toBeGreaterThan(0);
    const bot2: any = validBot();
    bot2.verification[0].url = 'http://insecure.example/feed.json';
    expect(validateBotDocument(bot2).length).toBeGreaterThan(0);
  });
  it('rejects a pattern that matches no instance', () => {
    const bot: any = validBot();
    bot.user_agents.patterns = ['Bingbot/\\d'];
    expect(validateBotDocument(bot).join(' ')).toMatch(/matches no instance/);
  });
  it('rejects a pattern that matches a mainstream browser', () => {
    const bot: any = validBot();
    bot.user_agents.patterns = ['Mozilla/5\\.0'];
    expect(validateBotDocument(bot).join(' ')).toMatch(/matches a browser/);
  });
  it('rejects invalid regex and bad static_cidrs', () => {
    const bot: any = validBot();
    bot.user_agents.patterns = ['Googlebot/('];
    expect(validateBotDocument(bot).join(' ')).toMatch(/invalid regex/);
    const bot2: any = validBot();
    bot2.verification.push({ type: 'static_cidrs', cidrs: ['10.0.0.0/8'] });
    expect(validateBotDocument(bot2).join(' ')).toMatch(/static_cidrs/);
  });
});
