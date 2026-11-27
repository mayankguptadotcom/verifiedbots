export type FeedFormat = 'prefixes' | 'stripe_webhooks' | 'github_meta' | 'text_lines' | 'json_array' | 'ip_objects' | 'keyed_arrays' | 'sail';

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


/**
 * Minimal reader for the SAIL profile of TOML (`application/sail+toml`, schema
 * `draft-kelley-webbotauth-sail-00`), which publishes a bot operator's egress addresses as
 * `[[prefix_sets]]` tables of `ipv4_prefixes`/`ipv6_prefixes` plus `[[services]]` tables that
 * bind a named service to one or more of those sets.
 *
 * This is deliberately NOT a general TOML parser. It accepts exactly the constructs the SAIL
 * profile uses and throws on anything else, so an unexpected document fails loudly as a 'hard'
 * feed outcome rather than silently yielding a short address list. Every string it returns is
 * still validated by sanitizeCidrs downstream, and a short list would additionally trip the
 * last-known-good diff guard, so a mis-read cannot quietly narrow a published range set.
 */
interface SailDoc {
  prefixSets: Map<string, string[]>;
  services: Map<string, string[]>;
}

/** Strips a trailing `# comment`, respecting double-quoted strings. */
function stripComment(line: string): string {
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i - 1] !== '\\') inStr = !inStr;
    else if (c === '#' && !inStr) return line.slice(0, i);
  }
  return line;
}

function parseStringArray(raw: string, key: string): string[] {
  const inner = raw.trim().slice(1, -1);
  const out: string[] = [];
  for (const part of inner.split(',')) {
    const t = part.trim();
    if (t.length === 0) continue; // trailing comma / empty array
    const m = /^"([^"]*)"$/.exec(t);
    if (!m) fail(`sail: ${key} contains a non-string entry (${t})`);
    out.push(m[1]);
  }
  return out;
}

function parseSailDoc(body: string): SailDoc {
  const prefixSets = new Map<string, string[]>();
  const services = new Map<string, string[]>();
  // Current table: null at document root, otherwise the table-array name and its collected keys.
  let table: 'prefix_sets' | 'services' | 'other' | null = null;
  let cur: Record<string, string[] | string> = {};
  const flush = () => {
    if (table === 'prefix_sets') {
      const name = cur.name;
      if (typeof name !== 'string') fail('sail: a [[prefix_sets]] table has no name');
      const v4 = cur.ipv4_prefixes ?? [];
      const v6 = cur.ipv6_prefixes ?? [];
      if (!Array.isArray(v4) || !Array.isArray(v6)) fail(`sail: prefix set "${name}" has a non-array prefix list`);
      // A repeated name would otherwise overwrite the earlier set and silently shorten the
      // published list, which is the one failure mode this parser exists to avoid.
      if (prefixSets.has(name)) fail(`sail: duplicate prefix set name "${name}"`);
      prefixSets.set(name as string, [...v4, ...v6]);
    } else if (table === 'services') {
      const name = cur.name;
      if (typeof name !== 'string') fail('sail: a [[services]] table has no name');
      const sets = cur.prefix_sets;
      if (!Array.isArray(sets)) fail(`sail: service "${name}" lists no prefix_sets`);
      if (services.has(name)) fail(`sail: duplicate service name "${name}"`);
      services.set(name as string, sets);
    }
    cur = {};
  };

  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = stripComment(lines[i]).trim();
    if (line.length === 0) continue;
    const header = /^\[\[?([A-Za-z0-9_.-]+)\]\]?$/.exec(line);
    if (header) {
      flush();
      const name = header[1];
      table = name === 'prefix_sets' ? 'prefix_sets' : name === 'services' ? 'services' : 'other';
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) fail(`sail: unparseable line ${i + 1} (${line.slice(0, 40)})`);
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.startsWith('[') && !value.endsWith(']')) {
      // Multi-line array: accumulate until the closing bracket.
      let j = i;
      while (!value.endsWith(']')) {
        j++;
        if (j >= lines.length) fail(`sail: unterminated array for "${key}"`);
        value += ' ' + stripComment(lines[j]).trim();
        value = value.trim();
      }
      i = j;
    }
    if (table === 'prefix_sets' || table === 'services') {
      if (value.startsWith('[')) cur[key] = parseStringArray(value, key);
      else {
        const m = /^"([^"]*)"$/.exec(value);
        // Non-string scalars in a known table (exclusive/exhaustive booleans) are not needed
        // for address extraction, so they are read and ignored rather than rejected.
        if (m) cur[key] = m[1];
      }
    }
  }
  flush();
  return { prefixSets, services };
}

/**
 * Resolves a SAIL document to a flat address list. With a `selector`, it is the name of a
 * `[[services]]` entry and only that service's bound prefix sets are returned — which is what
 * attributes traffic to one named bot. Without a selector, every published prefix set is
 * returned.
 */
export function parseSail(body: string, selector?: string): string[] {
  const { prefixSets, services } = parseSailDoc(body);
  if (prefixSets.size === 0) fail('sail: document declares no prefix_sets');
  if (!selector) return [...prefixSets.values()].flat();
  const bound = services.get(selector);
  if (!bound) {
    fail(`sail: no [[services]] entry named "${selector}" (found: ${[...services.keys()].join(', ') || 'none'})`);
  }
  const out: string[] = [];
  for (const setName of bound) {
    const prefixes = prefixSets.get(setName);
    if (!prefixes) fail(`sail: service "${selector}" references unknown prefix set "${setName}"`);
    out.push(...prefixes);
  }
  if (out.length === 0) fail(`sail: service "${selector}" resolves to no addresses`);
  return out;
}

/**
 * Resolves a dot-path selector ("hooks", "synthetics.prefixes_ipv4") to an array node, or
 * fails loudly. Shared by `github_meta` and `ip_objects`.
 */
function selectArray(doc: any, selector: string): unknown[] {
  let node: any = doc;
  for (const key of selector.split('.')) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) {
      fail(`selector "${selector}" does not resolve to an array`);
    }
    node = node[key];
  }
  if (!Array.isArray(node)) fail(`missing "${selector}" array`);
  return node;
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
      const node = selectArray(doc, selector);
      for (const entry of node) {
        if (typeof entry !== 'string') {
          fail('non-string entry in feed array');
        }
      }
      return node as string[];
    }
    /**
     * An array of single-address OBJECTS rather than strings, which `github_meta` rejects:
     *   { "publicIPs": [ { "ipv4": "3.217.168.199" }, … ] }   (Integral Ad Science)
     *   { "cidrs":     [ { "ipv4": "18.139.53.199/32" }, … ] } (Smartology)
     * `selector` is the dot-path to that array. Each entry must carry exactly one `ipv4` or
     * `ipv6` string; anything else fails loudly, so an unexpected document becomes a 'hard'
     * feed outcome rather than a silently short address list. Bare addresses are normalised
     * to /32 or /128 downstream by sanitizeCidrs, as they are for any other format.
     */
    case 'ip_objects': {
      const doc = asJson(body);
      if (!selector) fail('ip_objects requires a selector');
      const node = selectArray(doc, selector);
      const result: string[] = [];
      for (const entry of node) {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
          fail('ip_objects entry is not an object');
        }
        const e = entry as Record<string, unknown>;
        const addr = e.ipv4 ?? e.ipv6;
        if (typeof addr !== 'string') fail('ip_objects entry missing ipv4/ipv6 string');
        result.push(addr);
      }
      return result;
    }
    /**
     * An object whose VALUES each hold an array of addresses, keyed by something that is not
     * itself data worth selecting — a monitoring location or a cloud region:
     *   { "Washington, DC, USA": [ "44.202.178.0/24", … ], "Dublin, IE": [ … ] }   (New Relic)
     *   { "data": { "us-east-1": { "name": …, "ips": [ … ] }, … } }                (Ghost Inspector)
     * Neither shape has a single dot-path to an array, so `github_meta` cannot address them and
     * one recipe per key would silently miss every location the operator adds later.
     *
     * `selector` is therefore a dot-path containing exactly one `*` segment, standing for
     * "every key at this level": `*` for New Relic, `data.*.ips` for Ghost Inspector. The
     * segments before `*` must resolve to a plain object, and the segments after it must resolve
     * to an array of strings under every one of its keys. Anything else — no wildcard, two
     * wildcards, a missing or non-array branch, a non-string entry, or an object with no keys
     * at all — fails loudly, so an unexpected document becomes a 'hard' feed outcome rather
     * than a silently short address list. Keys are read in document order.
     */
    case 'keyed_arrays': {
      const doc = asJson(body);
      if (!selector) fail('keyed_arrays requires a selector');
      const parts = selector.split('.');
      const star = parts.indexOf('*');
      if (star === -1) fail(`keyed_arrays selector "${selector}" has no "*" segment`);
      if (parts.indexOf('*', star + 1) !== -1) fail(`keyed_arrays selector "${selector}" has more than one "*" segment`);
      const before = parts.slice(0, star).filter((p) => p.length > 0);
      const after = parts.slice(star + 1).filter((p) => p.length > 0);

      let parent: any = doc;
      for (const key of before) {
        if (parent === null || typeof parent !== 'object' || Array.isArray(parent)) {
          fail(`keyed_arrays selector "${selector}" does not resolve to an object`);
        }
        parent = parent[key];
      }
      if (parent === null || typeof parent !== 'object' || Array.isArray(parent)) {
        fail(`keyed_arrays selector "${selector}" does not resolve to an object`);
      }

      const keys = Object.keys(parent);
      if (keys.length === 0) fail(`keyed_arrays selector "${selector}" resolves to an object with no keys`);

      const result: string[] = [];
      for (const key of keys) {
        let node: any = parent[key];
        for (const step of after) {
          if (node === null || typeof node !== 'object' || Array.isArray(node)) {
            fail(`keyed_arrays: "${key}" does not resolve to an array via "${after.join('.')}"`);
          }
          node = node[step];
        }
        if (!Array.isArray(node)) fail(`keyed_arrays: "${key}" does not hold an array`);
        for (const entry of node) {
          if (typeof entry !== 'string') fail(`keyed_arrays: non-string entry under "${key}"`);
          result.push(entry);
        }
      }
      return result;
    }
    case 'sail':
      return parseSail(body, selector);
    case 'text_lines':
      return body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#'));
  }
}
