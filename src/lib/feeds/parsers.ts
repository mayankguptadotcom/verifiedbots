export type FeedFormat = 'prefixes' | 'stripe_webhooks' | 'github_meta' | 'text_lines' | 'json_array';

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
    case 'json_array': {
      let doc: unknown;
      try {
        doc = JSON.parse(body);
      } catch {
        fail('invalid JSON');
      }
      if (!Array.isArray(doc) || !doc.every((e) => typeof e === 'string')) fail('expected a JSON array of strings');
      return doc as string[];
    }
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
      // Selector is a dot-path: "hooks" (GitHub) or "synthetics.prefixes_ipv4" (Datadog-style nesting).
      let node: any = doc;
      for (const key of selector.split('.')) {
        if (node === null || typeof node !== 'object' || Array.isArray(node)) {
          fail(`selector "${selector}" does not resolve to an array`);
        }
        node = node[key];
      }
      if (!Array.isArray(node)) fail(`missing "${selector}" array`);
      for (const entry of node) {
        if (typeof entry !== 'string') {
          fail('non-string entry in feed array');
        }
      }
      return node;
    }
    case 'text_lines':
      return body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#'));
  }
}
