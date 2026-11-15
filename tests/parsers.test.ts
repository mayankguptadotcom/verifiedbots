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
  it('resolves dot-path selectors into nested objects (Datadog/Grafana shapes)', () => {
    const datadog = '{"version":1,"synthetics":{"prefixes_ipv4":["1.2.3.0/24","5.6.7.0/24"],"prefixes_ipv6":["2001:db8::/32"]}}';
    expect(parseFeed('github_meta', datadog, 'synthetics.prefixes_ipv4')).toEqual(['1.2.3.0/24', '5.6.7.0/24']);
    expect(parseFeed('github_meta', datadog, 'synthetics.prefixes_ipv6')).toEqual(['2001:db8::/32']);
  });
  it('throws when a dot-path segment is missing or not an object', () => {
    expect(() => parseFeed('github_meta', '{"synthetics":{"a":[]}}', 'synthetics.b')).toThrow(/unparseable feed/);
    expect(() => parseFeed('github_meta', '{"synthetics":"nope"}', 'synthetics.a')).toThrow(/unparseable feed/);
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

  // SAIL (draft-kelley-webbotauth-sail-00). Fixture is the live body of
  // https://claude.com/.well-known/sail, which publishes nine addresses in one prefix set
  // bound to the Claude-Agent service.
  it('parses a SAIL document, selecting a named service', () => {
    expect(parseFeed('sail', fx('anthropic_sail.toml'), 'Claude-Agent')).toEqual([
      '136.71.21.147',
      '34.31.25.14',
      '34.67.187.248',
      '34.71.122.171',
      '34.70.177.231',
      '34.66.255.143',
      '34.68.65.207',
      '34.171.207.92',
      '34.60.73.195',
    ]);
  });
  it('returns every prefix set when no SAIL service is selected', () => {
    expect(parseFeed('sail', fx('anthropic_sail.toml'))).toHaveLength(9);
  });
  it('unions ipv4 and ipv6 prefixes across the sets a service binds', () => {
    const doc = [
      'schema = "draft-kelley-webbotauth-sail-00"',
      '[[prefix_sets]]',
      'name = "a"',
      'ipv4_prefixes = ["1.2.3.0/24"]',
      'ipv6_prefixes = ["2001:db8::/32"]',
      '[[prefix_sets]]',
      'name = "b"',
      'ipv4_prefixes = [',
      '  "5.6.7.0/24", # a comment inside the array',
      ']',
      '[[services]]',
      'name = "Svc"',
      'prefix_sets = ["a", "b"]',
    ].join('\n');
    expect(parseFeed('sail', doc, 'Svc')).toEqual(['1.2.3.0/24', '2001:db8::/32', '5.6.7.0/24']);
  });
  it('throws rather than under-reporting when a SAIL service or prefix set is missing', () => {
    const doc = '[[prefix_sets]]\nname = "a"\nipv4_prefixes = ["1.2.3.0/24"]\n[[services]]\nname = "Svc"\nprefix_sets = ["ghost"]\n';
    expect(() => parseFeed('sail', doc, 'Svc')).toThrow(/unknown prefix set "ghost"/);
    expect(() => parseFeed('sail', doc, 'Other')).toThrow(/no \[\[services\]\] entry named "Other"/);
    expect(() => parseFeed('sail', 'schema = "x"\n')).toThrow(/declares no prefix_sets/);
    expect(() => parseFeed('sail', '[[prefix_sets]]\nname = "a"\nipv4_prefixes = ["1.2.3.0/24"\n')).toThrow(
      /unterminated array/,
    );
  });
  it('does not treat a # inside a quoted SAIL string as a comment', () => {
    const doc = '[[prefix_sets]]\nname = "has # hash"\nipv4_prefixes = ["1.2.3.0/24"]\n[[services]]\nname = "S"\nprefix_sets = ["has # hash"]\n';
    expect(parseFeed('sail', doc, 'S')).toEqual(['1.2.3.0/24']);
  });
});
