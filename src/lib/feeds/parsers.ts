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
