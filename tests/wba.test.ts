import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateKeyDirectoryBody, checkWba } from '../src/lib/wba.js';
import type { Bot } from '../src/lib/validateBot.js';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const wbaBot = (url: string): Bot => ({
  id: 'wbabot', name: 'WbaBot',
  operator: { name: 'Op', url: 'https://op.example' },
  description: 'A test bot used only in unit tests here.',
  docs: ['https://op.example/docs'], category: 'search-engine',
  user_agents: { patterns: ['WbaBot/\\d'], instances: ['WbaBot/1.0'] },
  behavior: { respects_robots_txt: true },
  verification: [{ type: 'web_bot_auth', signature_agent_url: url }],
});

describe('validateKeyDirectoryBody', () => {
  it('accepts a JWK set with an Ed25519 key', () => {
    expect(validateKeyDirectoryBody(fx('wba_valid.json'))).toEqual([]);
  });
  it('rejects invalid JSON, missing keys array, and non-Ed25519-only sets', () => {
    expect(validateKeyDirectoryBody('nope').length).toBeGreaterThan(0);
    expect(validateKeyDirectoryBody('{}').join(' ')).toMatch(/keys/);
    expect(validateKeyDirectoryBody(fx('wba_bad.json')).join(' ')).toMatch(/Ed25519/);
  });
  it('rejects an Ed25519 key missing the x coordinate', () => {
    expect(validateKeyDirectoryBody('{"keys":[{"kty":"OKP","crv":"Ed25519"}]}').join(' ')).toMatch(/x/);
  });
});

describe('checkWba', () => {
  it('fetches each web_bot_auth recipe and reports issues', async () => {
    const fetcher = async (url: string) => url.includes('good')
      ? { status: 200, body: fx('wba_valid.json') }
      : { status: 200, body: fx('wba_bad.json') };
    const rows = await checkWba([wbaBot('https://good.example/.well-known/http-message-signatures-directory'), wbaBot('https://bad.example/x')], fetcher);
    expect(rows).toHaveLength(2);
    expect(rows[0].issues).toEqual([]);
    expect(rows[1].issues.length).toBeGreaterThan(0);
  });
  it('reports HTTP failures and non-https URLs as issues', async () => {
    const fetcher = async () => ({ status: 404, body: '' });
    const rows = await checkWba([wbaBot('https://gone.example/x')], fetcher);
    expect(rows[0].issues.join(' ')).toMatch(/HTTP 404/);
    const rows2 = await checkWba([wbaBot('http://insecure.example/x')], fetcher);
    expect(rows2[0].issues.join(' ')).toMatch(/https/);
  });
  it('returns no rows when no bot claims web_bot_auth', async () => {
    const b = wbaBot('https://x.example'); b.verification = [];
    expect(await checkWba([b], async () => ({ status: 200, body: '' }))).toEqual([]);
  });
});
