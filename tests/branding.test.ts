import { describe, it, expect } from 'vitest';
import { BRANDING } from '../src/branding.js';

describe('branding', () => {
  it('exposes a single branding constant with required fields', () => {
    expect(BRANDING.projectName.length).toBeGreaterThan(0);
    expect(BRANDING.byline).toContain('Cerberus');
    expect(BRANDING.nonAffiliation.toLowerCase()).toContain('cloudflare');
    expect(BRANDING.domain).toBeNull(); // undecided — set at launch
  });
});
