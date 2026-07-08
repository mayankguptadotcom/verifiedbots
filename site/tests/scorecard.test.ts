import { describe, it, expect } from 'vitest';
import { scorecard } from '../src/lib/scorecard';
import type { BotArtifact } from '../src/lib/data';

const base: BotArtifact = {
  id: 'testbot',
  name: 'TestBot',
  operator: { name: 'Test', url: 'https://example.com' },
  description: 'x',
  docs: ['https://example.com/docs'],
  category: 'search-engine',
  user_agents: { patterns: ['TestBot/\\d'], instances: ['TestBot/1.0'] },
  behavior: { respects_robots_txt: true, robots_token: 'TestBot' },
  verification: [{ type: 'rdns', masks: ['*.example.com'] }],
  tier: 2,
  tier_label: 'Verifiable',
  resolved_cidrs: [],
};

describe('scorecard', () => {
  it('returns the five practices in order for a conformant bot', () => {
    const s = scorecard(base);
    expect(s.map((c) => c.key)).toEqual(['identify', 'verifiable', 'robots', 'behave', 'reachable']);
    expect(s.map((c) => c.status)).toEqual(['pass', 'pass', 'pass', 'info', 'pass']);
  });
  it('marks verifiable as gap for tier 3', () => {
    const s = scorecard({ ...base, verification: [], tier: 3, tier_label: 'Listed only' });
    expect(s.find((c) => c.key === 'verifiable')).toMatchObject({ status: 'gap' });
  });
  it('marks robots as na for service categories (webhook, monitoring)', () => {
    for (const category of ['webhook', 'monitoring']) {
      const s = scorecard({ ...base, category, behavior: { respects_robots_txt: false } });
      expect(s.find((c) => c.key === 'robots')).toMatchObject({ status: 'na' });
    }
  });
  it('marks robots as gap for a crawler that ignores robots.txt', () => {
    const s = scorecard({ ...base, behavior: { respects_robots_txt: false } });
    expect(s.find((c) => c.key === 'robots')).toMatchObject({ status: 'gap' });
  });
});
