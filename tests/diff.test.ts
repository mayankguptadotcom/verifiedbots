import { describe, it, expect } from 'vitest';
import { diffRanges } from '../src/lib/feeds/diff.js';

const range = (n: number, offset = 0) => Array.from({ length: n }, (_, i) => `93.184.${i + offset}.0/24`);

describe('diffRanges', () => {
  it('computes added/removed counts', () => {
    const r = diffRanges(range(10), [...range(10), '198.51.100.0/24']);
    expect(r).toMatchObject({ added: 1, removed: 0, suspicious: false });
  });
  it('is never suspicious on first fetch (empty previous)', () => {
    expect(diffRanges([], range(500)).suspicious).toBe(false);
  });
  it('flags a large-ratio, large-absolute change', () => {
    const r = diffRanges(range(50), range(50, 100)); // all 50 replaced: 100 changes, ratio 2.0
    expect(r.suspicious).toBe(true);
  });
  it('tolerates big ratio with small absolute change', () => {
    expect(diffRanges(range(5), range(5, 100)).suspicious).toBe(false); // 10 changes < 20
  });
  it('tolerates big absolute with small ratio', () => {
    const r = diffRanges(range(200), [...range(200).slice(25), ...range(25, 210)]); // 50 changes, ratio 0.25
    expect(r.suspicious).toBe(false);
  });
});
