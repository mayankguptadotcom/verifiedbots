import { describe, it, expect } from 'vitest';
import { updateFirstSeen } from '../src/lib/build/firstSeen.js';

describe('updateFirstSeen', () => {
  it('adds new ids at generatedAt and preserves existing dates', () => {
    const next = updateFirstSeen(['googlebot', 'bingbot'], { googlebot: '2026-07-01T00:00:00Z' }, '2026-07-07T00:00:00Z');
    expect(next).toEqual({ googlebot: '2026-07-01T00:00:00Z', bingbot: '2026-07-07T00:00:00Z' });
  });
  it('keeps entries for ids no longer present so re-added bots retain their original date', () => {
    const next = updateFirstSeen(['bingbot'], { googlebot: '2026-07-01T00:00:00Z' }, '2026-07-07T00:00:00Z');
    expect(next.googlebot).toBe('2026-07-01T00:00:00Z');
  });
});
