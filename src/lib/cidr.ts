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
