import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseFeed } from '../src/lib/feeds/parsers.js';

const fx = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('parseFeed', () => {
  it('parses Google-style prefixes JSON (ipv4 + ipv6)', () => {
    expect(parseFeed('prefixes', fx('google_prefixes.json'))).toEqual([
      '66.249.64.0/27',
      '66.249.64.32/27',
      '2001:4860:4801:10::/64',
    ]);
  });
  it('parses Stripe WEBHOOKS JSON', () => {
    expect(parseFeed('stripe_webhooks', fx('stripe_webhooks.json'))).toEqual([
      '3.18.12.63',
      '3.130.192.231',
      '13.235.14.237',
    ]);
  });
  it('parses GitHub meta with a selector', () => {
    expect(parseFeed('github_meta', fx('github_meta.json'), 'hooks')).toEqual([
      '192.30.252.0/22',
      '185.199.108.0/22',
    ]);
  });
  it('parses plain text lines, skipping blanks', () => {
    expect(parseFeed('text_lines', fx('uptimerobot.txt'))).toEqual([
      '69.162.124.226',
      '69.162.124.227',
      '2607:ff68:107::3',
    ]);
  });
  it('throws on malformed input', () => {
    expect(() => parseFeed('prefixes', 'not json')).toThrow(/unparseable feed/);
    expect(() => parseFeed('prefixes', '{"nope": []}')).toThrow(/unparseable feed/);
    expect(() => parseFeed('github_meta', fx('github_meta.json'), 'missing_key')).toThrow(/unparseable feed/);
  });
  it('throws on non-object JSON bodies', () => {
    expect(() => parseFeed('prefixes', 'null')).toThrow(/unparseable feed/);
    expect(() => parseFeed('stripe_webhooks', '42')).toThrow(/unparseable feed/);
    expect(() => parseFeed('github_meta', '[]', 'hooks')).toThrow(/unparseable feed/);
  });
  it('throws on non-string elements instead of passing garbage through', () => {
    expect(() => parseFeed('stripe_webhooks', '{"WEBHOOKS":[1,null,"3.3.3.3"]}')).toThrow(/unparseable feed/);
    expect(() => parseFeed('github_meta', '{"hooks":["1.2.3.0/24",{}]}', 'hooks')).toThrow(/unparseable feed/);
    expect(() => parseFeed('prefixes', '{"prefixes":[{"ipv4Prefix":"1.2.3.0/24"},{"other":1}]}')).toThrow(/unparseable feed/);
  });
  it('parses a bare JSON array of strings', () => {
    expect(parseFeed('json_array', '["1.2.3.0/24", "5.6.7.8"]')).toEqual(['1.2.3.0/24', '5.6.7.8']);
  });
  it('rejects json_array bodies that are not arrays of strings', () => {
    expect(() => parseFeed('json_array', '{"a":1}')).toThrow(/unparseable feed/);
    expect(() => parseFeed('json_array', '[1,2]')).toThrow(/unparseable feed/);
    expect(() => parseFeed('json_array', 'nope')).toThrow(/unparseable feed/);
  });
});
