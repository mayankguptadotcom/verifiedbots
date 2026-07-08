# VerifiedBots Data Platform Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core data platform of the good-bots directory: bot YAML schema, shared validation library, feed-fetch pipeline with poisoned-feed guardrails, dist artifact builders, CI workflows, and a 6-bot seed dataset covering every verification type.

**Architecture:** One private repo (`mayankguptadotcom/verifiedbots`, local clone `/Users/mayank/Documents/projects/verifiedbots`). Hand-curated `bots/<id>.yaml` files are the source of truth; a TypeScript library validates them (JSON Schema + semantic checks) and is shared by PR CI and a daily pipeline that fetches first-party IP feeds, applies sanity/diff guardrails with last-known-good fallback, and emits `dist/` JSON + `.ips` artifacts. The Astro site (Plan 2) and full 100–150-bot curation (Plan 3) come later.

**Tech Stack:** Node ≥22, TypeScript (ESM), vitest, ajv (JSON Schema 2020-12), `yaml`, `ipaddr.js`, `tsx` for CLIs, GitHub Actions.

## Global Constraints

- Spec: `/Users/mayank/Documents/projects/cerberus/docs/specs/2026-07-07-verifiedbots-directory-spec.md`. Repo stays **private** until launch; never flip visibility.
- Domain/name undecided: all branding (project name, domain, tagline) lives ONLY in `src/branding.ts`. No other file may hardcode "verifiedbots.dev" or a project display name.
- Strict TDD: every behavior gets a failing test first. Test command: `npx vitest run <file>`.
- ESM everywhere (`"type": "module"`); Node ≥22 (built-in `fetch`).
- Feed URLs must be `https://` — reject anything else.
- CIDR sanity constants (from spec): reject non-public ranges (bogons/private/reserved); IPv4 prefix must be ≥ /9 (rejects `/0`–`/8`); IPv6 prefix ≥ /20; max 2000 ranges per feed.
- Diff alarm (from spec): a feed change is suspicious when `(added+removed) > 20` AND `(added+removed)/previous_count > 0.30` → publish last-known-good instead, flag for manual review.
- Categories (closed enum): `search-engine`, `ai-crawler`, `ai-assistant`, `social-preview`, `monitoring`, `seo`, `feed-fetcher`, `archiver`, `security`, `webhook`.
- Verification types (closed enum): `cidr_feed`, `static_cidrs`, `asn`, `rdns`, `web_bot_auth`.
- Tiers: 1 = has `cidr_feed` or `web_bot_auth`; 2 = has `static_cidrs`/`asn`/`rdns` (and no tier-1 recipe); 3 = no verification recipes.
- Licensing: MIT for code (`LICENSE`), CC-BY-4.0 for `bots/` + `dist/` data (`LICENSE-DATA.md`).
- Commit after every green test cycle. Work on branch `data-platform`, PR to `main` at the end.

---

### Task 1: Repo scaffolding + branding constant

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/branding.ts`, `tests/branding.test.ts`

**Interfaces:**
- Produces: `BRANDING` const `{ projectName: string; domain: string | null; byline: string; nonAffiliation: string }` imported by later tasks (artifacts embed it; site consumes it in Plan 2).

- [ ] **Step 1: Create branch and scaffold config files**

```bash
cd /Users/mayank/Documents/projects/verifiedbots && git checkout -b data-platform
```

`package.json`:
```json
{
  "name": "verifiedbots-data",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "vitest run",
    "validate": "tsx src/cli/validate.ts",
    "fetch-feeds": "tsx src/cli/fetch-feeds.ts",
    "build:artifacts": "tsx src/cli/build.ts"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "ajv": "^8.17.0",
    "ajv-formats": "^3.0.1",
    "ipaddr.js": "^2.2.0",
    "yaml": "^2.6.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
```

`.gitignore`:
```
node_modules/
dist/
```

- [ ] **Step 2: Write the failing test**

`tests/branding.test.ts`:
```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm install && npx vitest run tests/branding.test.ts`
Expected: FAIL — `Cannot find module '../src/branding.js'`

- [ ] **Step 4: Write minimal implementation**

`src/branding.ts`:
```ts
/** The ONLY place project naming/branding lives. Domain is null until registered. */
export const BRANDING = {
  projectName: 'Verified Bots Directory',
  domain: null as string | null,
  byline: 'by Cerberus',
  nonAffiliation:
    'An independent open project. Not affiliated with Cloudflare or its Verified Bots program.',
} as const;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/branding.test.ts`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold TypeScript project with branding constant"
```

---

### Task 2: CIDR sanity validator

**Files:**
- Create: `src/lib/cidr.ts`, `tests/cidr.test.ts`

**Interfaces:**
- Produces:
  - `class CidrError extends Error { constructor(entry: string, reason: string) }` (message: `` `${entry}: ${reason}` ``)
  - `normalizeCidr(entry: string): string` — trims; bare IPv4 → `/32`, bare IPv6 → `/128`; throws `CidrError` on unparseable input.
  - `sanitizeCidrs(entries: string[], opts?: { maxRanges?: number }): string[]` — normalizes each, enforces public-unicast + prefix floors (v4 ≥ 9, v6 ≥ 20), dedupes, sorts; throws `CidrError` on any violation or when count > maxRanges (default 2000).

- [ ] **Step 1: Write the failing test**

`tests/cidr.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cidr.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/cidr.js'`

- [ ] **Step 3: Write minimal implementation**

`src/lib/cidr.ts`:
```ts
import ipaddr from 'ipaddr.js';

export const MIN_PREFIX_V4 = 9;
export const MIN_PREFIX_V6 = 20;
export const MAX_RANGES = 2000;

export class CidrError extends Error {
  constructor(entry: string, reason: string) {
    super(`${entry}: ${reason}`);
    this.name = 'CidrError';
  }
}

export function normalizeCidr(entry: string): string {
  const raw = entry.trim();
  if (raw.includes('/')) {
    try {
      const [addr, prefix] = ipaddr.parseCIDR(raw);
      return `${addr.toString()}/${prefix}`;
    } catch {
      throw new CidrError(raw, 'invalid CIDR');
    }
  }
  if (!ipaddr.isValid(raw)) throw new CidrError(raw, 'invalid IP address');
  const addr = ipaddr.parse(raw);
  return `${addr.toString()}/${addr.kind() === 'ipv4' ? 32 : 128}`;
}

function assertPublic(cidr: string): void {
  const [addr, prefix] = ipaddr.parseCIDR(cidr);
  const floor = addr.kind() === 'ipv4' ? MIN_PREFIX_V4 : MIN_PREFIX_V6;
  if (prefix < floor) throw new CidrError(cidr, `prefix /${prefix} broader than floor /${floor}`);
  if (addr.range() !== 'unicast') throw new CidrError(cidr, `non-public range (${addr.range()})`);
}

export function sanitizeCidrs(entries: string[], opts: { maxRanges?: number } = {}): string[] {
  const max = opts.maxRanges ?? MAX_RANGES;
  if (entries.length > max) {
    throw new CidrError(`<feed>`, `${entries.length} ranges exceeds cap of ${max}`);
  }
  const out = new Set<string>();
  for (const entry of entries) {
    const cidr = normalizeCidr(entry);
    assertPublic(cidr);
    out.add(cidr);
  }
  return [...out].sort();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cidr.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/cidr.ts tests/cidr.test.ts && git commit -m "feat: CIDR sanity validator (bogons, prefix floor, range cap)"
```

---

### Task 3: Feed format parsers

**Files:**
- Create: `src/lib/feeds/parsers.ts`, `tests/parsers.test.ts`
- Create fixtures: `tests/fixtures/google_prefixes.json`, `tests/fixtures/stripe_webhooks.json`, `tests/fixtures/github_meta.json`, `tests/fixtures/uptimerobot.txt`

**Interfaces:**
- Consumes: nothing (raw string in, raw entries out; sanitization happens in Task 7's fetcher via `sanitizeCidrs`).
- Produces:
  - `type FeedFormat = 'prefixes' | 'stripe_webhooks' | 'github_meta' | 'text_lines'`
  - `parseFeed(format: FeedFormat, body: string, selector?: string): string[]` — throws `Error('unparseable feed: <detail>')` on malformed input. `selector` is required for `github_meta` (the JSON key, e.g. `"hooks"`).

- [ ] **Step 1: Create fixtures**

`tests/fixtures/google_prefixes.json` (Google/OpenAI/Perplexity/Apple all use this shape):
```json
{
  "creationTime": "2026-07-01T00:00:00.000000",
  "prefixes": [
    { "ipv4Prefix": "66.249.64.0/27" },
    { "ipv4Prefix": "66.249.64.32/27" },
    { "ipv6Prefix": "2001:4860:4801:10::/64" }
  ]
}
```

`tests/fixtures/stripe_webhooks.json`:
```json
{ "WEBHOOKS": ["3.18.12.63", "3.130.192.231", "13.235.14.237"] }
```

`tests/fixtures/github_meta.json`:
```json
{ "verifiable_password_authentication": false, "hooks": ["192.30.252.0/22", "185.199.108.0/22"], "web": ["192.30.252.0/22"] }
```

`tests/fixtures/uptimerobot.txt`:
```
69.162.124.226
69.162.124.227
2607:ff68:107::3
```

- [ ] **Step 2: Write the failing test**

`tests/parsers.test.ts`:
```ts
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
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/parsers.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/feeds/parsers.js'`

- [ ] **Step 4: Write minimal implementation**

`src/lib/feeds/parsers.ts`:
```ts
export type FeedFormat = 'prefixes' | 'stripe_webhooks' | 'github_meta' | 'text_lines';

function fail(detail: string): never {
  throw new Error(`unparseable feed: ${detail}`);
}

function asJson(body: string): any {
  try {
    return JSON.parse(body);
  } catch {
    fail('invalid JSON');
  }
}

export function parseFeed(format: FeedFormat, body: string, selector?: string): string[] {
  switch (format) {
    case 'prefixes': {
      const doc = asJson(body);
      if (!Array.isArray(doc.prefixes)) fail('missing "prefixes" array');
      return doc.prefixes
        .map((p: any) => p.ipv4Prefix ?? p.ipv6Prefix)
        .filter((v: unknown): v is string => typeof v === 'string');
    }
    case 'stripe_webhooks': {
      const doc = asJson(body);
      if (!Array.isArray(doc.WEBHOOKS)) fail('missing "WEBHOOKS" array');
      return doc.WEBHOOKS;
    }
    case 'github_meta': {
      const doc = asJson(body);
      if (!selector) fail('github_meta requires a selector');
      if (!Array.isArray(doc[selector])) fail(`missing "${selector}" array`);
      return doc[selector];
    }
    case 'text_lines':
      return body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#'));
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/parsers.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/feeds/parsers.ts tests/parsers.test.ts tests/fixtures/ && git commit -m "feat: feed parsers for prefixes/stripe/github-meta/text formats"
```

---

### Task 4: Bot JSON Schema + semantic validator

**Files:**
- Create: `src/schema/bot.schema.json`, `src/lib/validateBot.ts`, `tests/validateBot.test.ts`

**Interfaces:**
- Consumes: `sanitizeCidrs` from Task 2 (for `static_cidrs` semantic check).
- Produces:
  - `interface Bot` (TypeScript mirror of the schema — exact shape below; later tasks import it)
  - `validateBotDocument(doc: unknown): string[]` — returns `[]` when valid, else human-readable issue strings. Runs ajv schema validation, then semantic checks: each UA pattern compiles, matches ≥1 instance, matches no browser sample; `static_cidrs` pass `sanitizeCidrs`; `cidr_feed.url` and `web_bot_auth.signature_agent_url` are https.
  - `const BROWSER_UA_SAMPLES: string[]` (4 mainstream browser UAs)

```ts
export interface Bot {
  id: string;
  name: string;
  operator: { name: string; url: string };
  description: string;
  docs: string[];
  category: 'search-engine' | 'ai-crawler' | 'ai-assistant' | 'social-preview' | 'monitoring' | 'seo' | 'feed-fetcher' | 'archiver' | 'security' | 'webhook';
  user_agents: { patterns: string[]; instances: string[] };
  behavior: { respects_robots_txt: boolean; robots_token?: string };
  verification: Verification[];
}
export type Verification =
  | { type: 'cidr_feed'; url: string; format: 'prefixes' | 'stripe_webhooks' | 'github_meta' | 'text_lines'; selector?: string }
  | { type: 'static_cidrs'; cidrs: string[] }
  | { type: 'asn'; numbers: number[] }
  | { type: 'rdns'; masks: string[] }
  | { type: 'web_bot_auth'; signature_agent_url: string };
```

- [ ] **Step 1: Write the JSON Schema**

`src/schema/bot.schema.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "bot.schema.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "name", "operator", "description", "docs", "category", "user_agents", "behavior", "verification"],
  "properties": {
    "id": { "type": "string", "pattern": "^[a-z0-9][a-z0-9-]*$" },
    "name": { "type": "string", "minLength": 1 },
    "operator": {
      "type": "object",
      "additionalProperties": false,
      "required": ["name", "url"],
      "properties": {
        "name": { "type": "string", "minLength": 1 },
        "url": { "type": "string", "format": "uri", "pattern": "^https://" }
      }
    },
    "description": { "type": "string", "minLength": 20 },
    "docs": { "type": "array", "minItems": 1, "items": { "type": "string", "format": "uri", "pattern": "^https://" } },
    "category": {
      "enum": ["search-engine", "ai-crawler", "ai-assistant", "social-preview", "monitoring", "seo", "feed-fetcher", "archiver", "security", "webhook"]
    },
    "user_agents": {
      "type": "object",
      "additionalProperties": false,
      "required": ["patterns", "instances"],
      "properties": {
        "patterns": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 3 } },
        "instances": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 3 } }
      }
    },
    "behavior": {
      "type": "object",
      "additionalProperties": false,
      "required": ["respects_robots_txt"],
      "properties": {
        "respects_robots_txt": { "type": "boolean" },
        "robots_token": { "type": "string" }
      }
    },
    "verification": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object", "additionalProperties": false,
            "required": ["type", "url", "format"],
            "properties": {
              "type": { "const": "cidr_feed" },
              "url": { "type": "string", "pattern": "^https://" },
              "format": { "enum": ["prefixes", "stripe_webhooks", "github_meta", "text_lines"] },
              "selector": { "type": "string" }
            }
          },
          {
            "type": "object", "additionalProperties": false,
            "required": ["type", "cidrs"],
            "properties": {
              "type": { "const": "static_cidrs" },
              "cidrs": { "type": "array", "minItems": 1, "items": { "type": "string" } }
            }
          },
          {
            "type": "object", "additionalProperties": false,
            "required": ["type", "numbers"],
            "properties": {
              "type": { "const": "asn" },
              "numbers": { "type": "array", "minItems": 1, "items": { "type": "integer", "minimum": 1 } }
            }
          },
          {
            "type": "object", "additionalProperties": false,
            "required": ["type", "masks"],
            "properties": {
              "type": { "const": "rdns" },
              "masks": { "type": "array", "minItems": 1, "items": { "type": "string", "pattern": "^\\*\\." } }
            }
          },
          {
            "type": "object", "additionalProperties": false,
            "required": ["type", "signature_agent_url"],
            "properties": {
              "type": { "const": "web_bot_auth" },
              "signature_agent_url": { "type": "string", "pattern": "^https://" }
            }
          }
        ]
      }
    }
  }
}
```

- [ ] **Step 2: Write the failing test**

`tests/validateBot.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateBotDocument } from '../src/lib/validateBot.js';

const validBot = () => ({
  id: 'googlebot',
  name: 'Googlebot',
  operator: { name: 'Google', url: 'https://www.google.com' },
  description: "Google's primary web crawler for Search indexing.",
  docs: ['https://developers.google.com/search/docs/crawling-indexing/verifying-googlebot'],
  category: 'search-engine',
  user_agents: {
    patterns: ['Googlebot/\\d'],
    instances: ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  },
  behavior: { respects_robots_txt: true, robots_token: 'Googlebot' },
  verification: [
    { type: 'cidr_feed', url: 'https://developers.google.com/static/search/apis/ipranges/googlebot.json', format: 'prefixes' },
    { type: 'rdns', masks: ['*.googlebot.com'] },
  ],
});

describe('validateBotDocument', () => {
  it('accepts a valid bot', () => {
    expect(validateBotDocument(validBot())).toEqual([]);
  });
  it('rejects schema violations', () => {
    const bot: any = validBot();
    bot.category = 'crypto-miner';
    expect(validateBotDocument(bot).length).toBeGreaterThan(0);
    const bot2: any = validBot();
    bot2.verification[0].url = 'http://insecure.example/feed.json';
    expect(validateBotDocument(bot2).length).toBeGreaterThan(0);
  });
  it('rejects a pattern that matches no instance', () => {
    const bot: any = validBot();
    bot.user_agents.patterns = ['Bingbot/\\d'];
    expect(validateBotDocument(bot).join(' ')).toMatch(/matches no instance/);
  });
  it('rejects a pattern that matches a mainstream browser', () => {
    const bot: any = validBot();
    bot.user_agents.patterns = ['Mozilla/5\\.0'];
    expect(validateBotDocument(bot).join(' ')).toMatch(/matches a browser/);
  });
  it('rejects invalid regex and bad static_cidrs', () => {
    const bot: any = validBot();
    bot.user_agents.patterns = ['Googlebot/('];
    expect(validateBotDocument(bot).join(' ')).toMatch(/invalid regex/);
    const bot2: any = validBot();
    bot2.verification.push({ type: 'static_cidrs', cidrs: ['10.0.0.0/8'] });
    expect(validateBotDocument(bot2).join(' ')).toMatch(/static_cidrs/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/validateBot.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/validateBot.js'`

- [ ] **Step 4: Write minimal implementation**

`src/lib/validateBot.ts`:
```ts
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { sanitizeCidrs, CidrError } from './cidr.js';

export interface Bot {
  id: string;
  name: string;
  operator: { name: string; url: string };
  description: string;
  docs: string[];
  category: 'search-engine' | 'ai-crawler' | 'ai-assistant' | 'social-preview' | 'monitoring' | 'seo' | 'feed-fetcher' | 'archiver' | 'security' | 'webhook';
  user_agents: { patterns: string[]; instances: string[] };
  behavior: { respects_robots_txt: boolean; robots_token?: string };
  verification: Verification[];
}
export type Verification =
  | { type: 'cidr_feed'; url: string; format: 'prefixes' | 'stripe_webhooks' | 'github_meta' | 'text_lines'; selector?: string }
  | { type: 'static_cidrs'; cidrs: string[] }
  | { type: 'asn'; numbers: number[] }
  | { type: 'rdns'; masks: string[] }
  | { type: 'web_bot_auth'; signature_agent_url: string };

export const BROWSER_UA_SAMPLES = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
];

const schema = JSON.parse(readFileSync(new URL('../schema/bot.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const schemaValidate = ajv.compile(schema);

export function validateBotDocument(doc: unknown): string[] {
  const issues: string[] = [];
  if (!schemaValidate(doc)) {
    for (const err of schemaValidate.errors ?? []) {
      issues.push(`schema: ${err.instancePath || '/'} ${err.message}`);
    }
    return issues; // semantic checks assume schema shape
  }
  const bot = doc as Bot;
  for (const pattern of bot.user_agents.patterns) {
    let re: RegExp;
    try {
      re = new RegExp(pattern);
    } catch {
      issues.push(`user_agents: invalid regex "${pattern}"`);
      continue;
    }
    if (!bot.user_agents.instances.some((ua) => re.test(ua))) {
      issues.push(`user_agents: pattern "${pattern}" matches no instance`);
    }
    const browser = BROWSER_UA_SAMPLES.find((ua) => re.test(ua));
    if (browser) issues.push(`user_agents: pattern "${pattern}" matches a browser UA`);
  }
  for (const v of bot.verification) {
    if (v.type === 'static_cidrs') {
      try {
        sanitizeCidrs(v.cidrs);
      } catch (e) {
        if (e instanceof CidrError) issues.push(`static_cidrs: ${e.message}`);
        else throw e;
      }
    }
  }
  return issues;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/validateBot.test.ts`
Expected: PASS (5 tests). If ajv's 2020 import path errors, the fallback import is `import Ajv2020 from 'ajv/dist/2020.js'` (default export) — use whichever compiles.

- [ ] **Step 6: Commit**

```bash
git add src/schema/bot.schema.json src/lib/validateBot.ts tests/validateBot.test.ts && git commit -m "feat: bot JSON Schema and semantic validator"
```

---

### Task 5: Tier computation

**Files:**
- Create: `src/lib/tiers.ts`, `tests/tiers.test.ts`

**Interfaces:**
- Consumes: `Bot` from Task 4.
- Produces: `type Tier = 1 | 2 | 3`; `computeTier(bot: Pick<Bot, 'verification'>): Tier`; `TIER_LABELS: Record<Tier, string>` (`1: 'Fully verifiable'`, `2: 'Verifiable'`, `3: 'Listed only'`).

- [ ] **Step 1: Write the failing test**

`tests/tiers.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tiers.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/tiers.js'`

- [ ] **Step 3: Write minimal implementation**

`src/lib/tiers.ts`:
```ts
import type { Bot } from './validateBot.js';

export type Tier = 1 | 2 | 3;

export const TIER_LABELS: Record<Tier, string> = {
  1: 'Fully verifiable',
  2: 'Verifiable',
  3: 'Listed only',
};

export function computeTier(bot: Pick<Bot, 'verification'>): Tier {
  const types = new Set(bot.verification.map((v) => v.type));
  if (types.has('cidr_feed') || types.has('web_bot_auth')) return 1;
  if (types.has('static_cidrs') || types.has('asn') || types.has('rdns')) return 2;
  return 3;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tiers.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tiers.ts tests/tiers.test.ts && git commit -m "feat: verification tier computation"
```

---

### Task 6: Bot loader, validate CLI, and 6-bot seed dataset

**Files:**
- Create: `src/lib/loadBots.ts`, `src/cli/validate.ts`, `tests/loadBots.test.ts`
- Create: `bots/googlebot.yaml`, `bots/gptbot.yaml`, `bots/claudebot.yaml`, `bots/meta-externalagent.yaml`, `bots/stripe-webhooks.yaml`, `bots/uptimerobot.yaml`

**Interfaces:**
- Consumes: `validateBotDocument`, `Bot` (Task 4).
- Produces: `loadBots(dir: string): Bot[]` — reads every `*.yaml` in `dir`, YAML-parses, requires `id === basename`, runs `validateBotDocument`; throws `Error` listing ALL issues across files if any. CLI: `npm run validate` exits 0/1 printing issues.

- [ ] **Step 1: Write the failing test**

`tests/loadBots.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/loadBots.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/loadBots.js'`

- [ ] **Step 3: Write the loader + CLI**

`src/lib/loadBots.ts`:
```ts
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parse } from 'yaml';
import { validateBotDocument, type Bot } from './validateBot.js';

export function loadBots(dir: string): Bot[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort();
  const bots: Bot[] = [];
  const problems: string[] = [];
  for (const file of files) {
    let doc: any;
    try {
      doc = parse(readFileSync(join(dir, file), 'utf8'));
    } catch (e) {
      problems.push(`${file}: YAML parse error: ${(e as Error).message}`);
      continue;
    }
    const issues = validateBotDocument(doc);
    if (issues.length > 0) {
      problems.push(`${file}:\n  ${issues.join('\n  ')}`);
      continue;
    }
    const expected = basename(file, '.yaml');
    if (doc.id !== expected) {
      problems.push(`${file}: id "${doc.id}" does not match filename`);
      continue;
    }
    bots.push(doc as Bot);
  }
  if (problems.length > 0) throw new Error(`bot validation failed:\n${problems.join('\n')}`);
  return bots;
}
```

`src/cli/validate.ts`:
```ts
import { loadBots } from '../lib/loadBots.js';

try {
  const bots = loadBots(new URL('../../bots', import.meta.url).pathname);
  console.log(`OK: ${bots.length} bots valid`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
```

- [ ] **Step 4: Write the seed dataset (real, verified data)**

`bots/googlebot.yaml`:
```yaml
id: googlebot
name: Googlebot
operator: { name: Google, url: "https://www.google.com" }
description: >-
  Google's primary web crawler, fetching pages for Google Search indexing.
docs:
  - "https://developers.google.com/search/docs/crawling-indexing/verifying-googlebot"
category: search-engine
user_agents:
  patterns:
    - 'Googlebot/\d'
  instances:
    - 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/125.0.6422.26 Safari/537.36'
    - 'Googlebot/2.1 (+http://www.google.com/bot.html)'
behavior: { respects_robots_txt: true, robots_token: Googlebot }
verification:
  - type: cidr_feed
    url: "https://developers.google.com/static/search/apis/ipranges/googlebot.json"
    format: prefixes
  - type: rdns
    masks: ["*.googlebot.com", "*.geo.googlebot.com"]
```

`bots/gptbot.yaml`:
```yaml
id: gptbot
name: GPTBot
operator: { name: OpenAI, url: "https://openai.com" }
description: >-
  OpenAI's web crawler that gathers publicly available data used to train
  OpenAI's models.
docs:
  - "https://developers.openai.com/api/docs/bots"
category: ai-crawler
user_agents:
  patterns:
    - 'GPTBot/\d'
  instances:
    - 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot'
behavior: { respects_robots_txt: true, robots_token: GPTBot }
verification:
  - type: cidr_feed
    url: "https://openai.com/gptbot.json"
    format: prefixes
```

`bots/claudebot.yaml` (deliberately tier 3 — Anthropic publishes no IPs/rDNS):
```yaml
id: claudebot
name: ClaudeBot
operator: { name: Anthropic, url: "https://www.anthropic.com" }
description: >-
  Anthropic's web crawler collecting publicly available web data for training
  Claude models. Anthropic does not publish crawler IP ranges or rDNS.
docs:
  - "https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler"
category: ai-crawler
user_agents:
  patterns:
    - 'ClaudeBot/\d'
  instances:
    - 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'
behavior: { respects_robots_txt: true, robots_token: ClaudeBot }
verification: []
```

`bots/meta-externalagent.yaml`:
```yaml
id: meta-externalagent
name: Meta External Agent
operator: { name: Meta, url: "https://www.meta.com" }
description: >-
  Meta's crawler for AI training data and content indexing across Meta
  products. Verified by ASN lookup (AS32934); Meta publishes no IP feed.
docs:
  - "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/"
category: ai-crawler
user_agents:
  patterns:
    - 'meta-externalagent/\d'
  instances:
    - 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)'
behavior: { respects_robots_txt: true, robots_token: meta-externalagent }
verification:
  - type: asn
    numbers: [32934]
```

`bots/stripe-webhooks.yaml`:
```yaml
id: stripe-webhooks
name: Stripe Webhooks
operator: { name: Stripe, url: "https://stripe.com" }
description: >-
  Stripe's webhook delivery service. Not a crawler; sends event notifications
  (payments, subscriptions) to merchant endpoints from published IPs.
docs:
  - "https://docs.stripe.com/ips"
category: webhook
user_agents:
  patterns:
    - 'Stripe/1\.0'
  instances:
    - 'Stripe/1.0 (+https://stripe.com/docs/webhooks)'
behavior: { respects_robots_txt: false }
verification:
  - type: cidr_feed
    url: "https://stripe.com/files/ips/ips_webhooks.json"
    format: stripe_webhooks
```

`bots/uptimerobot.yaml`:
```yaml
id: uptimerobot
name: UptimeRobot
operator: { name: UptimeRobot, url: "https://uptimerobot.com" }
description: >-
  Uptime monitoring service that probes customer sites on a schedule from a
  published list of monitoring IPs.
docs:
  - "https://uptimerobot.com/help/locations/"
category: monitoring
user_agents:
  patterns:
    - 'UptimeRobot/\d'
  instances:
    - 'Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)'
behavior: { respects_robots_txt: false }
verification:
  - type: cidr_feed
    url: "https://uptimerobot.com/inc/files/ips/IPv4andIPv6.txt"
    format: text_lines
```

- [ ] **Step 5: Run tests and CLI to verify everything passes**

Run: `npx vitest run tests/loadBots.test.ts && npm run validate`
Expected: PASS (4 tests), then `OK: 6 bots valid`

- [ ] **Step 6: Commit**

```bash
git add src/lib/loadBots.ts src/cli/validate.ts tests/loadBots.test.ts bots/ && git commit -m "feat: bot loader, validate CLI, and 6-bot seed dataset"
```

---

### Task 7: Diff alarm

**Files:**
- Create: `src/lib/feeds/diff.ts`, `tests/diff.test.ts`

**Interfaces:**
- Produces: `diffRanges(previous: string[], next: string[]): { added: number; removed: number; changeRatio: number; suspicious: boolean }`. `changeRatio = (added+removed)/previous.length` (0 when previous empty). `suspicious` = previous non-empty AND `added+removed > 20` AND `changeRatio > 0.30`. Constants exported: `DIFF_MIN_ABSOLUTE = 20`, `DIFF_MAX_RATIO = 0.30`.

- [ ] **Step 1: Write the failing test**

`tests/diff.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/diff.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/feeds/diff.js'`

- [ ] **Step 3: Write minimal implementation**

`src/lib/feeds/diff.ts`:
```ts
export const DIFF_MIN_ABSOLUTE = 20;
export const DIFF_MAX_RATIO = 0.3;

export interface DiffResult {
  added: number;
  removed: number;
  changeRatio: number;
  suspicious: boolean;
}

export function diffRanges(previous: string[], next: string[]): DiffResult {
  const prev = new Set(previous);
  const nxt = new Set(next);
  let added = 0;
  let removed = 0;
  for (const r of nxt) if (!prev.has(r)) added++;
  for (const r of prev) if (!nxt.has(r)) removed++;
  const changes = added + removed;
  const changeRatio = previous.length === 0 ? 0 : changes / previous.length;
  const suspicious = previous.length > 0 && changes > DIFF_MIN_ABSOLUTE && changeRatio > DIFF_MAX_RATIO;
  return { added, removed, changeRatio, suspicious };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/diff.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/feeds/diff.ts tests/diff.test.ts && git commit -m "feat: feed diff alarm (ratio + absolute thresholds)"
```

---

### Task 8: Feed fetcher with guardrails + last-known-good

**Files:**
- Create: `src/lib/feeds/fetchFeeds.ts`, `src/cli/fetch-feeds.ts`, `tests/fetchFeeds.test.ts`

**Interfaces:**
- Consumes: `parseFeed` (Task 3), `sanitizeCidrs`/`CidrError` (Task 2), `diffRanges` (Task 7), `Bot` (Task 4).
- Produces:
  - `type Fetcher = (url: string) => Promise<{ status: number; body: string }>`
  - `interface FeedOutcome { botId: string; url: string; status: 'ok' | 'held' | 'error'; ranges: string[]; detail?: string }`
  - `fetchAllFeeds(bots: Bot[], lkgDir: string, fetcher?: Fetcher): Promise<FeedOutcome[]>` — for each `cidr_feed` recipe: fetch → parse → sanitize → diff vs LKG. `ok` → write LKG file. HTTP failure / parse failure / sanitize failure → `error`, ranges = LKG (or `[]`). Suspicious diff → `held`, ranges = LKG. LKG file: `<lkgDir>/<botId>--<index>.json` shaped `{ url, fetched_at, ranges }`.
  - CLI `npm run fetch-feeds` — runs against `bots/` + `data/last-known-good/`, prints one line per feed, exits 1 if any outcome is `held` or `error` (so CI/workflow can react), but STILL writes ok feeds' LKG first.

- [ ] **Step 1: Write the failing test**

`tests/fetchFeeds.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchAllFeeds, type Fetcher } from '../src/lib/feeds/fetchFeeds.js';
import type { Bot } from '../src/lib/validateBot.js';

const bot = (id: string, url: string): Bot => ({
  id,
  name: id,
  operator: { name: 'Op', url: 'https://example.com' },
  description: 'A test bot used only inside unit tests here.',
  docs: ['https://example.com'],
  category: 'monitoring',
  user_agents: { patterns: [`${id}/\\d`], instances: [`${id}/1.0`] },
  behavior: { respects_robots_txt: true },
  verification: [{ type: 'cidr_feed', url, format: 'prefixes' }],
});

const prefixBody = (cidrs: string[]) =>
  JSON.stringify({ prefixes: cidrs.map((c) => ({ ipv4Prefix: c })) });

let lkg: string;
beforeEach(() => {
  lkg = mkdtempSync(join(tmpdir(), 'lkg-'));
});

describe('fetchAllFeeds', () => {
  it('fetches, sanitizes, and writes last-known-good on ok', async () => {
    const fetcher: Fetcher = async () => ({ status: 200, body: prefixBody(['66.249.64.0/27']) });
    const out = await fetchAllFeeds([bot('googlebot', 'https://feeds.example/g.json')], lkg, fetcher);
    expect(out[0]).toMatchObject({ status: 'ok', ranges: ['66.249.64.0/27'] });
    const saved = JSON.parse(readFileSync(join(lkg, 'googlebot--0.json'), 'utf8'));
    expect(saved.ranges).toEqual(['66.249.64.0/27']);
  });
  it('falls back to LKG on HTTP error', async () => {
    writeFileSync(join(lkg, 'googlebot--0.json'), JSON.stringify({ url: 'x', fetched_at: 'y', ranges: ['66.249.64.0/27'] }));
    const fetcher: Fetcher = async () => ({ status: 503, body: '' });
    const out = await fetchAllFeeds([bot('googlebot', 'https://feeds.example/g.json')], lkg, fetcher);
    expect(out[0]).toMatchObject({ status: 'error', ranges: ['66.249.64.0/27'] });
  });
  it('errors on poisoned feed (private range) without updating LKG', async () => {
    writeFileSync(join(lkg, 'googlebot--0.json'), JSON.stringify({ url: 'x', fetched_at: 'y', ranges: ['66.249.64.0/27'] }));
    const fetcher: Fetcher = async () => ({ status: 200, body: prefixBody(['10.0.0.0/16']) });
    const out = await fetchAllFeeds([bot('googlebot', 'https://feeds.example/g.json')], lkg, fetcher);
    expect(out[0].status).toBe('error');
    expect(out[0].ranges).toEqual(['66.249.64.0/27']);
    expect(JSON.parse(readFileSync(join(lkg, 'googlebot--0.json'), 'utf8')).ranges).toEqual(['66.249.64.0/27']);
  });
  it('holds a suspicious diff and keeps LKG', async () => {
    const oldRanges = Array.from({ length: 50 }, (_, i) => `93.184.${i}.0/24`);
    writeFileSync(join(lkg, 'googlebot--0.json'), JSON.stringify({ url: 'x', fetched_at: 'y', ranges: oldRanges }));
    const newRanges = Array.from({ length: 50 }, (_, i) => `203.0.${i + 100}.0/24`);
    const fetcher: Fetcher = async () => ({ status: 200, body: prefixBody(newRanges) });
    const out = await fetchAllFeeds([bot('googlebot', 'https://feeds.example/g.json')], lkg, fetcher);
    expect(out[0].status).toBe('held');
    expect(out[0].ranges).toEqual(oldRanges); // LKG returned exactly as stored
  });
  it('rejects non-https URLs defensively', async () => {
    const b = bot('badbot', 'https://ok.example/f.json');
    (b.verification[0] as any).url = 'http://evil.example/f.json';
    const fetcher: Fetcher = async () => ({ status: 200, body: prefixBody(['93.184.0.0/24']) });
    const out = await fetchAllFeeds([b], lkg, fetcher);
    expect(out[0]).toMatchObject({ status: 'error', ranges: [] });
  });
  it('skips bots with no cidr_feed', async () => {
    const b = bot('nofeed', 'https://x/y.json');
    b.verification = [];
    const fetcher: Fetcher = async () => ({ status: 200, body: '' });
    expect(await fetchAllFeeds([b], lkg, fetcher)).toEqual([]);
    expect(existsSync(join(lkg, 'nofeed--0.json'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fetchFeeds.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/feeds/fetchFeeds.js'`

- [ ] **Step 3: Write minimal implementation**

`src/lib/feeds/fetchFeeds.ts`:
```ts
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFeed } from './parsers.js';
import { diffRanges } from './diff.js';
import { sanitizeCidrs } from '../cidr.js';
import type { Bot } from '../validateBot.js';

export type Fetcher = (url: string) => Promise<{ status: number; body: string }>;

export interface FeedOutcome {
  botId: string;
  url: string;
  status: 'ok' | 'held' | 'error';
  ranges: string[];
  detail?: string;
}

const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'verifiedbots-pipeline/1.0' } });
  return { status: res.status, body: await res.text() };
};

function readLkg(path: string): string[] {
  if (!existsSync(path)) return [];
  return (JSON.parse(readFileSync(path, 'utf8')).ranges as string[]) ?? [];
}

export async function fetchAllFeeds(bots: Bot[], lkgDir: string, fetcher: Fetcher = defaultFetcher): Promise<FeedOutcome[]> {
  mkdirSync(lkgDir, { recursive: true });
  const outcomes: FeedOutcome[] = [];
  for (const bot of bots) {
    const feeds = bot.verification.filter((v) => v.type === 'cidr_feed');
    for (let i = 0; i < feeds.length; i++) {
      const feed = feeds[i] as Extract<Bot['verification'][number], { type: 'cidr_feed' }>;
      const lkgPath = join(lkgDir, `${bot.id}--${i}.json`);
      const lkgRanges = readLkg(lkgPath);
      const fail = (detail: string): FeedOutcome => ({ botId: bot.id, url: feed.url, status: 'error', ranges: lkgRanges, detail });
      if (!feed.url.startsWith('https://')) {
        outcomes.push(fail('non-https feed URL'));
        continue;
      }
      let body: string;
      try {
        const res = await fetcher(feed.url);
        if (res.status !== 200) {
          outcomes.push(fail(`HTTP ${res.status}`));
          continue;
        }
        body = res.body;
      } catch (e) {
        outcomes.push(fail(`fetch failed: ${(e as Error).message}`));
        continue;
      }
      let ranges: string[];
      try {
        ranges = sanitizeCidrs(parseFeed(feed.format, body, feed.selector));
      } catch (e) {
        outcomes.push(fail((e as Error).message));
        continue;
      }
      const diff = diffRanges(lkgRanges, ranges);
      if (diff.suspicious) {
        outcomes.push({
          botId: bot.id,
          url: feed.url,
          status: 'held',
          ranges: lkgRanges,
          detail: `suspicious diff: +${diff.added}/-${diff.removed} (ratio ${diff.changeRatio.toFixed(2)})`,
        });
        continue;
      }
      writeFileSync(lkgPath, JSON.stringify({ url: feed.url, fetched_at: new Date().toISOString(), ranges }, null, 2));
      outcomes.push({ botId: bot.id, url: feed.url, status: 'ok', ranges });
    }
  }
  return outcomes;
}
```

`src/cli/fetch-feeds.ts`:
```ts
import { loadBots } from '../lib/loadBots.js';
import { fetchAllFeeds } from '../lib/feeds/fetchFeeds.js';

const bots = loadBots(new URL('../../bots', import.meta.url).pathname);
const outcomes = await fetchAllFeeds(bots, new URL('../../data/last-known-good', import.meta.url).pathname);
let bad = 0;
for (const o of outcomes) {
  console.log(`${o.status.toUpperCase().padEnd(5)} ${o.botId} ${o.url} (${o.ranges.length} ranges)${o.detail ? ` — ${o.detail}` : ''}`);
  if (o.status !== 'ok') bad++;
}
if (bad > 0) {
  console.error(`${bad} feed(s) held or errored — published data falls back to last-known-good`);
  process.exit(1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/fetchFeeds.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Live smoke test (network)**

Run: `npm run fetch-feeds`
Expected: 5 lines (googlebot, gptbot, stripe-webhooks, uptimerobot have feeds; claudebot/meta-externalagent skipped), all `OK`, exit 0. `data/last-known-good/` now has 4 JSON files. If a live URL is temporarily down, `ERROR` + exit 1 is acceptable — note it and continue.

- [ ] **Step 6: Commit**

```bash
git add src/lib/feeds/fetchFeeds.ts src/cli/fetch-feeds.ts tests/fetchFeeds.test.ts data/last-known-good/ && git commit -m "feat: feed fetcher with poisoned-feed guardrails and last-known-good fallback"
```

---

### Task 9: Artifact builders + build CLI

**Files:**
- Create: `src/lib/build/artifacts.ts`, `src/cli/build.ts`, `tests/artifacts.test.ts`

**Interfaces:**
- Consumes: `Bot` (Task 4), `computeTier`/`TIER_LABELS` (Task 5), `FeedOutcome` (Task 8), `BRANDING` (Task 1).
- Produces: `buildArtifacts(bots: Bot[], outcomes: FeedOutcome[], outDir: string, generatedAt: string): void` writing:
  - `dist/all.json` — `{ project, generated_at, count, bots: BotArtifact[] }` where `BotArtifact = Bot & { tier: 1|2|3; tier_label: string; resolved_cidrs: string[] }` (resolved = union of all that bot's feed outcome ranges + any `static_cidrs`, sorted/deduped)
  - `dist/by-category/<category>.json` — same shape filtered
  - `dist/bots/<id>.json` — single `BotArtifact`
  - `dist/ips/<id>.ips` (one CIDR per line, only bots with non-empty `resolved_cidrs`) and `dist/ips/all.ips` (union)
  - `dist/ua-patterns.json` — `[{ id, category, patterns }]`

- [ ] **Step 1: Write the failing test**

`tests/artifacts.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildArtifacts } from '../src/lib/build/artifacts.js';
import type { Bot } from '../src/lib/validateBot.js';
import type { FeedOutcome } from '../src/lib/feeds/fetchFeeds.js';

const googlebot: Bot = {
  id: 'googlebot',
  name: 'Googlebot',
  operator: { name: 'Google', url: 'https://www.google.com' },
  description: "Google's primary web crawler for Search indexing.",
  docs: ['https://developers.google.com/search/docs/crawling-indexing/verifying-googlebot'],
  category: 'search-engine',
  user_agents: { patterns: ['Googlebot/\\d'], instances: ['Googlebot/2.1 (+http://www.google.com/bot.html)'] },
  behavior: { respects_robots_txt: true, robots_token: 'Googlebot' },
  verification: [
    { type: 'cidr_feed', url: 'https://developers.google.com/static/search/apis/ipranges/googlebot.json', format: 'prefixes' },
    { type: 'static_cidrs', cidrs: ['66.249.90.0/28'] },
  ],
};
const claudebot: Bot = {
  ...googlebot,
  id: 'claudebot',
  name: 'ClaudeBot',
  category: 'ai-crawler',
  user_agents: { patterns: ['ClaudeBot/\\d'], instances: ['ClaudeBot/1.0'] },
  verification: [],
};
const outcomes: FeedOutcome[] = [
  { botId: 'googlebot', url: 'https://developers.google.com/static/search/apis/ipranges/googlebot.json', status: 'ok', ranges: ['66.249.64.0/27'] },
];

describe('buildArtifacts', () => {
  const out = mkdtempSync(join(tmpdir(), 'dist-'));
  buildArtifacts([googlebot, claudebot], outcomes, out, '2026-07-07T00:00:00Z');
  const all = JSON.parse(readFileSync(join(out, 'all.json'), 'utf8'));

  it('writes all.json with tiers and resolved cidrs', () => {
    expect(all.count).toBe(2);
    expect(all.generated_at).toBe('2026-07-07T00:00:00Z');
    const g = all.bots.find((b: any) => b.id === 'googlebot');
    expect(g.tier).toBe(1);
    expect(g.resolved_cidrs).toEqual(['66.249.64.0/27', '66.249.90.0/28']);
    const c = all.bots.find((b: any) => b.id === 'claudebot');
    expect(c).toMatchObject({ tier: 3, tier_label: 'Listed only', resolved_cidrs: [] });
  });
  it('writes per-category and per-bot files', () => {
    const cat = JSON.parse(readFileSync(join(out, 'by-category/search-engine.json'), 'utf8'));
    expect(cat.bots.map((b: any) => b.id)).toEqual(['googlebot']);
    expect(JSON.parse(readFileSync(join(out, 'bots/claudebot.json'), 'utf8')).id).toBe('claudebot');
  });
  it('writes .ips files only for bots with ranges', () => {
    expect(readFileSync(join(out, 'ips/googlebot.ips'), 'utf8')).toBe('66.249.64.0/27\n66.249.90.0/28\n');
    expect(existsSync(join(out, 'ips/claudebot.ips'))).toBe(false);
    expect(readFileSync(join(out, 'ips/all.ips'), 'utf8')).toBe('66.249.64.0/27\n66.249.90.0/28\n');
  });
  it('writes ua-patterns.json', () => {
    const ua = JSON.parse(readFileSync(join(out, 'ua-patterns.json'), 'utf8'));
    expect(ua).toEqual([
      { id: 'claudebot', category: 'ai-crawler', patterns: ['ClaudeBot/\\d'] },
      { id: 'googlebot', category: 'search-engine', patterns: ['Googlebot/\\d'] },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/artifacts.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/build/artifacts.js'`

- [ ] **Step 3: Write minimal implementation**

`src/lib/build/artifacts.ts`:
```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRANDING } from '../../branding.js';
import { computeTier, TIER_LABELS, type Tier } from '../tiers.js';
import type { Bot } from '../validateBot.js';
import type { FeedOutcome } from '../feeds/fetchFeeds.js';

export type BotArtifact = Bot & { tier: Tier; tier_label: string; resolved_cidrs: string[] };

function resolveCidrs(bot: Bot, outcomes: FeedOutcome[]): string[] {
  const ranges = new Set<string>();
  for (const o of outcomes) if (o.botId === bot.id) o.ranges.forEach((r) => ranges.add(r));
  for (const v of bot.verification) if (v.type === 'static_cidrs') v.cidrs.forEach((c) => ranges.add(c));
  return [...ranges].sort();
}

export function buildArtifacts(bots: Bot[], outcomes: FeedOutcome[], outDir: string, generatedAt: string): void {
  const artifacts: BotArtifact[] = bots
    .map((bot) => {
      const tier = computeTier(bot);
      return { ...bot, tier, tier_label: TIER_LABELS[tier], resolved_cidrs: resolveCidrs(bot, outcomes) };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const envelope = (list: BotArtifact[]) => ({
    project: BRANDING.projectName,
    generated_at: generatedAt,
    count: list.length,
    bots: list,
  });

  mkdirSync(join(outDir, 'by-category'), { recursive: true });
  mkdirSync(join(outDir, 'bots'), { recursive: true });
  mkdirSync(join(outDir, 'ips'), { recursive: true });

  writeFileSync(join(outDir, 'all.json'), JSON.stringify(envelope(artifacts), null, 2));
  for (const category of new Set(artifacts.map((b) => b.category))) {
    writeFileSync(
      join(outDir, 'by-category', `${category}.json`),
      JSON.stringify(envelope(artifacts.filter((b) => b.category === category)), null, 2),
    );
  }
  const allIps = new Set<string>();
  for (const bot of artifacts) {
    writeFileSync(join(outDir, 'bots', `${bot.id}.json`), JSON.stringify(bot, null, 2));
    if (bot.resolved_cidrs.length > 0) {
      writeFileSync(join(outDir, 'ips', `${bot.id}.ips`), bot.resolved_cidrs.join('\n') + '\n');
      bot.resolved_cidrs.forEach((r) => allIps.add(r));
    }
  }
  writeFileSync(join(outDir, 'ips', 'all.ips'), [...allIps].sort().join('\n') + '\n');
  writeFileSync(
    join(outDir, 'ua-patterns.json'),
    JSON.stringify(artifacts.map((b) => ({ id: b.id, category: b.category, patterns: b.user_agents.patterns })), null, 2),
  );
}
```

`src/cli/build.ts`:
```ts
import { loadBots } from '../lib/loadBots.js';
import { fetchAllFeeds } from '../lib/feeds/fetchFeeds.js';
import { buildArtifacts } from '../lib/build/artifacts.js';

const root = (p: string) => new URL(`../../${p}`, import.meta.url).pathname;
const bots = loadBots(root('bots'));
const outcomes = await fetchAllFeeds(bots, root('data/last-known-good'));
buildArtifacts(bots, outcomes, root('dist'), new Date().toISOString());
const held = outcomes.filter((o) => o.status !== 'ok');
console.log(`built dist/ for ${bots.length} bots; ${outcomes.length} feeds (${held.length} held/errored)`);
if (held.length > 0) {
  for (const o of held) console.error(`  ${o.status}: ${o.botId} ${o.url} — ${o.detail}`);
  process.exit(2); // build succeeded on LKG data, but flag for the workflow to open an issue
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/artifacts.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Full-suite run + live build smoke test**

Run: `npm test && npm run build:artifacts && ls dist dist/ips`
Expected: all suites PASS; build prints `built dist/ for 6 bots; 4 feeds (0 held/errored)`; `dist/` contains `all.json`, `by-category/`, `bots/`, `ips/` (with `googlebot.ips`, `gptbot.ips`, `stripe-webhooks.ips`, `uptimerobot.ips`, `all.ips`), `ua-patterns.json`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/build/artifacts.ts src/cli/build.ts tests/artifacts.test.ts && git commit -m "feat: dist artifact builders (all.json, per-category, .ips, ua-patterns)"
```

---

### Task 10: GitHub Actions workflows

**Files:**
- Create: `.github/workflows/verify.yml`, `.github/workflows/build.yml`

**Interfaces:**
- Consumes: `npm test`, `npm run validate`, `npm run fetch-feeds`, `npm run build:artifacts` (Tasks 6/8/9). Note `build:artifacts` exits 2 when feeds were held/errored but LKG data was used — the workflow treats exit 2 as "publish, but open an alert issue".

- [ ] **Step 1: Write the PR verify workflow**

`.github/workflows/verify.yml`:
```yaml
name: verify
on:
  pull_request:
  push:
    branches: [main]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run validate
      - name: Live feed verification
        run: npm run fetch-feeds
```

- [ ] **Step 2: Write the daily build workflow**

`.github/workflows/build.yml`:
```yaml
name: build
on:
  schedule:
    - cron: '17 4 * * *'
  workflow_dispatch:
  push:
    branches: [main]
permissions:
  contents: write
  issues: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
      - name: Build artifacts (exit 2 = published on last-known-good)
        id: build
        run: |
          set +e
          npm run build:artifacts 2> feed-alerts.txt
          code=$?
          set -e
          if [ "$code" -eq 2 ]; then echo "alert=true" >> "$GITHUB_OUTPUT"; elif [ "$code" -ne 0 ]; then exit "$code"; fi
      - name: Commit refreshed data
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email 'github-actions[bot]@users.noreply.github.com'
          git add -f dist/ data/last-known-good/
          git diff --cached --quiet || git commit -m 'chore: refresh feeds and dist artifacts'
          git push
      - name: Open alert issue for held/errored feeds
        if: steps.build.outputs.alert == 'true'
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh issue create \
            --title "Feed alert: $(date -u +%F) — held or errored feeds" \
            --body "$(printf 'The daily build published last-known-good data for some feeds. Review before trusting new ranges:\n\n```\n%s\n```\n' "$(cat feed-alerts.txt)")" \
            --label feed-alert || gh issue create --title "Feed alert: $(date -u +%F)" --body "$(cat feed-alerts.txt)"
```

Note: `dist/` is gitignored for local work; the workflow force-adds it (`git add -f`) so published artifacts live in-repo on `main` (simplest jsDelivr/Pages origin; revisit in Plan 2 if noisy).

- [ ] **Step 3: Create the feed-alert label and verify workflows are syntactically valid**

```bash
gh label create feed-alert --repo mayankguptadotcom/verifiedbots --color D93F0B --description "Daily build held or errored a feed" || true
npx --yes @action-validator/cli .github/workflows/verify.yml && npx --yes @action-validator/cli .github/workflows/build.yml || echo "validator unavailable — visual check: correct YAML, actions@v4, node 22"
```
Expected: label created (or already exists); validator passes or falls back to visual check.

- [ ] **Step 4: Commit**

```bash
git add .github/ && git commit -m "ci: PR verify + daily feed build workflows"
```

---

### Task 11: Governance docs + PR, then verify CI end-to-end

**Files:**
- Create: `PRACTICES.md`, `README.md`, `CONTRIBUTING.md`, `CODEOWNERS`, `LICENSE`, `LICENSE-DATA.md`, `.github/ISSUE_TEMPLATE/submit-bot.yml`

**Interfaces:**
- Consumes: schema field names from Task 4 (practices map 1:1 to them); BRANDING placeholder rule (no hardcoded domain).

- [ ] **Step 1: Write PRACTICES.md**

```markdown
# Good Bot Practices

The standard this directory measures every bot against. Each practice maps to
a field in the bot schema, so every directory entry doubles as a conformance
scorecard.

## 1. Identify honestly (`user_agents`)
Send a stable User-Agent token: product name, version, and an info URL.
Example: `ExampleBot/2.1 (+https://example.com/bot)`.

## 2. Be verifiable (`verification`) — at least one of:
- **Machine-readable IP ranges** at a stable HTTPS URL (JSON preferred; the
  Google/OpenAI `{"prefixes":[{"ipv4Prefix":...}]}` shape is the de-facto
  standard) → `cidr_feed`
- **Forward/reverse DNS** on a domain you control → `rdns`
- **Web Bot Auth** (IETF HTTP Message Signatures): sign requests and host a
  key directory at `/.well-known/http-message-signatures-directory` →
  `web_bot_auth`. Implement with Cloudflare's Apache-2.0 libraries
  (github.com/cloudflare/web-bot-auth); self-test at Fingerprint's free
  endpoint (fingerprint.com/web-bot-auth/test/) before submitting.

## 3. Respect robots.txt (`behavior.respects_robots_txt`)
Honor robots.txt and document your token (`behavior.robots_token`).
Service traffic that isn't a crawler (webhooks, monitors you configured)
is exempt by nature — declared as `respects_robots_txt: false` with a
category that explains why.

## 4. Behave (`behavior`)
Sane request rates. Back off on 429/503. Honor cache headers.

## 5. Be reachable (`operator`, `docs`)
Publish operator identity, documentation, and a contact channel for site
owners.
```

- [ ] **Step 2: Write README.md**

```markdown
# Verified Bots Directory

The open, categorized directory of good bots — identities, user agents,
IP ranges, and machine-actionable verification recipes.

> Status: pre-launch, private. Data + pipeline are being built; site follows.
> An independent open project. Not affiliated with Cloudflare or its
> Verified Bots program.

## What's here
- `bots/*.yaml` — one curated file per bot (schema: `src/schema/bot.schema.json`)
- `dist/` — built artifacts: `all.json`, `by-category/*.json`, `bots/*.json`,
  `ips/*.ips` (GoodBots-compatible), `ua-patterns.json`
- `PRACTICES.md` — the Good Bot Practices standard
- Verification tiers: 1 = fully verifiable (IP feed / Web Bot Auth),
  2 = verifiable (rDNS / ASN / static ranges), 3 = listed only

## Commands
- `npm test` — unit tests
- `npm run validate` — validate all bot files
- `npm run fetch-feeds` — refresh IP ranges from first-party feeds (guarded:
  poisoned or wildly-changed feeds fall back to last-known-good)
- `npm run build:artifacts` — build `dist/`

## Licensing
Code: MIT (`LICENSE`). Data (`bots/`, `dist/`): CC-BY-4.0 (`LICENSE-DATA.md`).
```

- [ ] **Step 3: Write CONTRIBUTING.md, CODEOWNERS, licenses, issue form**

`CONTRIBUTING.md`:
```markdown
# Contributing

## Adding a bot
1. Copy an existing file in `bots/` as a template; name it `<id>.yaml`
   (lowercase, hyphens; must equal the `id` field).
2. Fill every field. At least one `verification` recipe is strongly
   preferred — bots without one are listed as Tier 3.
3. `npm run validate` must pass locally.
4. Open a PR. CI re-validates and live-fetches any claimed feed URLs, then
   posts results. A maintainer reviews for legitimacy (CI proves the data is
   valid, not that you operate the bot) and merges.

Non-technical submissions: open a "Submit a bot" issue instead.
```

`CODEOWNERS`:
```
* @mayankguptadotcom
```

`LICENSE`: the standard MIT license text, `Copyright (c) 2026 Mayank Gupta`.

`LICENSE-DATA.md`:
```markdown
# Data License

The dataset in `bots/` and the built artifacts in `dist/` are licensed under
Creative Commons Attribution 4.0 International (CC BY 4.0):
https://creativecommons.org/licenses/by/4.0/

Attribution: link to this project. Code is separately MIT-licensed (LICENSE).
```

`.github/ISSUE_TEMPLATE/submit-bot.yml`:
```yaml
name: Submit a bot
description: Propose a bot for the directory (non-technical route — maintainers convert to a PR)
labels: [bot-submission]
body:
  - type: input
    id: name
    attributes: { label: Bot name }
    validations: { required: true }
  - type: input
    id: operator
    attributes: { label: Operator name and URL }
    validations: { required: true }
  - type: textarea
    id: uas
    attributes: { label: User-Agent strings (one per line, as sent on the wire) }
    validations: { required: true }
  - type: textarea
    id: verification
    attributes:
      label: Verification
      description: IP range feed URL, rDNS suffixes, ASN, or Web Bot Auth key directory URL
  - type: input
    id: docs
    attributes: { label: Official documentation URL }
    validations: { required: true }
```

- [ ] **Step 4: Full local verification**

Run: `npm test && npm run validate && npm run build:artifacts`
Expected: all PASS; `OK: 6 bots valid`; build succeeds with 0 held/errored.

- [ ] **Step 5: Commit, push, open PR, verify CI**

```bash
git add -A && git commit -m "docs: practices, contributing, licenses, submission form"
git push -u origin data-platform
gh pr create --repo mayankguptadotcom/verifiedbots --title "Data platform: schema, validation, guarded feed pipeline, artifacts, CI" --body "Implements Plan 1 (docs/plans/2026-07-07-data-platform.md): bot schema + validator, CIDR guardrails, feed fetcher with last-known-good fallback, dist builders, verify/build workflows, 6-bot seed."
gh pr checks --repo mayankguptadotcom/verifiedbots --watch
```
Expected: `verify` workflow green on the PR. Merge is the maintainer's (user's) call.

---

## Follow-up plans (not in this document)

- **Plan 2 — Astro directory site:** app-like feel, View Transitions, big typography; consumes `dist/all.json`; branding exclusively from `src/branding.ts` (domain filled in once registered).
- **Plan 3 — Full curation to ~100–150 bots:** batch-by-category using arcjet/well-known-bots (MIT) verification entries + the first-party feed inventory in the spec; add `github-hooks`, Bing, DuckDuckGo, Applebot, Perplexity, Amazonbot, Ahrefs, Semrush, Pingdom, Telegram, etc. Also adds the `web_bot_auth` CI check from the spec (fetch key directory, validate JWK set / Ed25519) alongside the first WBA-verified bot entries — deferred from Plan 1 because no seed bot claims WBA.
- **Deferred with the spec:** active Web Bot Auth challenge endpoint, lookup API, Cerberus consumption of `all.json`.
