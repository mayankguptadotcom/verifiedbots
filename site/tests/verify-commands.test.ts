import { describe, it, expect } from 'vitest';
import { verifyCommands } from '../src/lib/verify-commands';
import type { BotArtifact } from '../src/lib/data';

const bot = (verification: BotArtifact['verification']): BotArtifact => ({
  id: 'b',
  name: 'B',
  operator: { name: 'O', url: 'https://o.example' },
  description: 'x',
  docs: [],
  category: 'search-engine',
  user_agents: { patterns: [], instances: [] },
  behavior: { respects_robots_txt: true },
  verification,
  tier: 1,
  tier_label: 'Fully verifiable',
  resolved_cidrs: [],
});

describe('verifyCommands', () => {
  it('builds a curl for cidr_feed', () => {
    const c = verifyCommands(bot([{ type: 'cidr_feed', url: 'https://x.example/f.json', format: 'prefixes' }]));
    expect(c).toEqual([{ title: 'Fetch the official IP range feed', command: 'curl -s https://x.example/f.json' }]);
  });
  it('builds a dig for rdns with the first mask in a comment', () => {
    const c = verifyCommands(bot([{ type: 'rdns', masks: ['*.googlebot.com', '*.geo.googlebot.com'] }]));
    expect(c[0].command).toBe('dig -x <client-ip> +short   # expect a hostname matching *.googlebot.com');
  });
  it('builds a whois for asn', () => {
    const c = verifyCommands(bot([{ type: 'asn', numbers: [32934] }]));
    expect(c[0].command).toBe("whois -h whois.radb.net -- '-i origin AS32934' | grep route");
  });
  it('builds a curl for web_bot_auth and skips static_cidrs', () => {
    const c = verifyCommands(bot([
      { type: 'static_cidrs', cidrs: ['5.255.96.0/20'] },
      { type: 'web_bot_auth', signature_agent_url: 'https://x.example/.well-known/http-message-signatures-directory' },
    ]));
    expect(c).toHaveLength(1);
    expect(c[0].command).toBe('curl -s https://x.example/.well-known/http-message-signatures-directory');
  });
});
