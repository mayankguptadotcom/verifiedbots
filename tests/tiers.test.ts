import { describe, it, expect } from 'vitest';
import { computeTier, TIER_LABELS } from '../src/lib/tiers.js';

describe('computeTier', () => {
  it('tier 1 for cidr_feed or web_bot_auth', () => {
    expect(computeTier({ verification: [{ type: 'cidr_feed', url: 'https://x/y.json', format: 'prefixes' }] })).toBe(1);
    expect(computeTier({ verification: [{ type: 'web_bot_auth', signature_agent_url: 'https://x/.well-known/http-message-signatures-directory' }] })).toBe(1);
    expect(
      computeTier({ verification: [{ type: 'rdns', masks: ['*.example.com'] }, { type: 'cidr_feed', url: 'https://x/y.json', format: 'prefixes' }] }),
    ).toBe(1);
  });
  it('tier 2 for rdns/asn/static_cidrs only', () => {
    expect(computeTier({ verification: [{ type: 'rdns', masks: ['*.googlebot.com'] }] })).toBe(2);
    expect(computeTier({ verification: [{ type: 'asn', numbers: [32934] }] })).toBe(2);
    expect(computeTier({ verification: [{ type: 'static_cidrs', cidrs: ['5.255.96.0/20'] }] })).toBe(2);
  });
  it('tier 3 for no verification', () => {
    expect(computeTier({ verification: [] })).toBe(3);
  });
  it('has labels for all tiers', () => {
    expect(TIER_LABELS[1]).toBe('Fully verifiable');
    expect(TIER_LABELS[2]).toBe('Verifiable');
    expect(TIER_LABELS[3]).toBe('Listed only');
  });
});
