export type FeedFormat = 'prefixes' | 'stripe_webhooks' | 'github_meta' | 'text_lines';

function fail(detail: string): never {
  throw new Error(`unparseable feed: ${detail}`);
}

function asJson(body: string): any {
  try {
    const parsed = JSON.parse(body);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      fail('feed body is not a JSON object');
    }
    return parsed;
  } catch (e) {
    if (e instanceof Error && e.message.includes('unparseable feed')) {
      throw e;
    }
    fail('invalid JSON');
  }
}

export function parseFeed(format: FeedFormat, body: string, selector?: string): string[] {
  switch (format) {
    case 'prefixes': {
      const doc = asJson(body);
      if (!Array.isArray(doc.prefixes)) fail('missing "prefixes" array');
      const result: string[] = [];
      for (const p of doc.prefixes) {
        const prefix = p.ipv4Prefix ?? p.ipv6Prefix;
        if (typeof prefix !== 'string') {
          fail('prefix entry missing ipv4Prefix/ipv6Prefix string');
        }
        result.push(prefix);
      }
      return result;
    }
    case 'stripe_webhooks': {
      const doc = asJson(body);
      if (!Array.isArray(doc.WEBHOOKS)) fail('missing "WEBHOOKS" array');
      for (const entry of doc.WEBHOOKS) {
        if (typeof entry !== 'string') {
          fail('non-string entry in feed array');
        }
      }
      return doc.WEBHOOKS;
    }
    case 'github_meta': {
      const doc = asJson(body);
      if (!selector) fail('github_meta requires a selector');
      if (!Array.isArray(doc[selector])) fail(`missing "${selector}" array`);
      for (const entry of doc[selector]) {
        if (typeof entry !== 'string') {
          fail('non-string entry in feed array');
        }
      }
      return doc[selector];
    }
    case 'text_lines':
      return body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#'));
  }
}
