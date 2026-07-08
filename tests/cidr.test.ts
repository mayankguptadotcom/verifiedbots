import { describe, it, expect } from 'vitest';
import { normalizeCidr, sanitizeCidrs, CidrError } from '../src/lib/cidr.js';

describe('normalizeCidr', () => {
  it('passes through valid CIDRs and normalizes bare IPs', () => {
    expect(normalizeCidr('66.249.64.0/27')).toBe('66.249.64.0/27');
    expect(normalizeCidr('3.18.12.63')).toBe('3.18.12.63/32');
    expect(normalizeCidr('2001:4860:4801::/48')).toBe('2001:4860:4801::/48');
    expect(normalizeCidr(' 8.8.8.8 ')).toBe('8.8.8.8/32');
  });
  it('throws CidrError on garbage', () => {
    expect(() => normalizeCidr('not-an-ip')).toThrow(CidrError);
    expect(() => normalizeCidr('300.1.1.1/24')).toThrow(CidrError);
  });
});

describe('sanitizeCidrs', () => {
  it('rejects private, loopback and reserved ranges', () => {
    for (const bad of ['10.0.0.0/16', '192.168.1.0/24', '127.0.0.1', '169.254.0.0/16', '100.64.0.0/10']) {
      expect(() => sanitizeCidrs([bad])).toThrow(CidrError);
    }
  });
  it('rejects prefixes broader than the floor', () => {
    expect(() => sanitizeCidrs(['0.0.0.0/0'])).toThrow(CidrError);
    expect(() => sanitizeCidrs(['12.0.0.0/8'])).toThrow(CidrError);
    expect(() => sanitizeCidrs(['2600::/16'])).toThrow(CidrError);
    expect(sanitizeCidrs(['12.128.0.0/9'])).toEqual(['12.128.0.0/9']);
  });
  it('dedupes and sorts', () => {
    expect(sanitizeCidrs(['66.249.64.0/27', '4.4.4.4', '66.249.64.0/27'])).toEqual([
      '4.4.4.4/32',
      '66.249.64.0/27',
    ]);
  });
  it('enforces the range-count cap', () => {
    const many = Array.from({ length: 2001 }, (_, i) => `93.${Math.floor(i / 250)}.${i % 250}.0/24`);
    expect(() => sanitizeCidrs(many)).toThrow(CidrError);
    expect(() => sanitizeCidrs(many.slice(0, 100))).not.toThrow();
  });
});
