import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadBots } from '../src/lib/loadBots.js';

const MINIMAL = `id: testbot
name: TestBot
operator: { name: Test, url: "https://example.com" }
description: A test bot used only inside unit tests here.
docs: ["https://example.com/docs"]
category: monitoring
user_agents:
  patterns: ['TestBot/\\d']
  instances: ['TestBot/1.0 (+https://example.com)']
behavior: { respects_robots_txt: true }
verification: []
`;

describe('loadBots', () => {
  it('loads valid bot files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bots-'));
    writeFileSync(join(dir, 'testbot.yaml'), MINIMAL);
    const bots = loadBots(dir);
    expect(bots).toHaveLength(1);
    expect(bots[0].id).toBe('testbot');
  });
  it('rejects id/filename mismatch', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bots-'));
    writeFileSync(join(dir, 'otherbot.yaml'), MINIMAL);
    expect(() => loadBots(dir)).toThrow(/id "testbot" does not match filename/);
  });
  it('aggregates issues across files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bots-'));
    writeFileSync(join(dir, 'a.yaml'), 'id: a\nname: A\n');
    writeFileSync(join(dir, 'b.yaml'), 'id: b\nname: B\n');
    expect(() => loadBots(dir)).toThrow(/a\.yaml[\s\S]*b\.yaml/);
  });
  it('loads the real seed dataset', () => {
    const bots = loadBots(new URL('../bots', import.meta.url).pathname);
    expect(bots.length).toBeGreaterThanOrEqual(6);
  });
});
