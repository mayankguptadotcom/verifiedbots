import type { Bot } from './validateBot.js';

export type Fetcher = (url: string) => Promise<{ status: number; body: string }>;

export function validateKeyDirectoryBody(body: string): string[] {
  let doc: any;
  try {
    doc = JSON.parse(body);
  } catch {
    return ['key directory is not valid JSON'];
  }
  if (doc === null || typeof doc !== 'object' || !Array.isArray(doc.keys)) {
    return ['key directory has no "keys" array (expected an RFC 7517 JWK Set)'];
  }
  const issues: string[] = [];
  const ed = doc.keys.filter((k: any) => k && k.kty === 'OKP' && k.crv === 'Ed25519');
  if (ed.length === 0) issues.push('no Ed25519 (OKP) keys found — Web Bot Auth requires Ed25519');
  for (const k of ed) {
    if (typeof k.x !== 'string' || k.x.length === 0) issues.push('Ed25519 key missing base64url "x" coordinate');
  }
  return issues;
}

const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30_000), headers: { 'user-agent': 'verifiedbots-pipeline/1.0' } });
  return { status: res.status, body: await res.text() };
};

export async function checkWba(bots: Bot[], fetcher: Fetcher = defaultFetcher): Promise<Array<{ botId: string; url: string; issues: string[] }>> {
  const rows: Array<{ botId: string; url: string; issues: string[] }> = [];
  for (const bot of bots) {
    for (const v of bot.verification) {
      if (v.type !== 'web_bot_auth') continue;
      const url = v.signature_agent_url;
      if (!url.startsWith('https://')) {
        rows.push({ botId: bot.id, url, issues: ['signature_agent_url must be https'] });
        continue;
      }
      try {
        const res = await fetcher(url);
        rows.push({ botId: bot.id, url, issues: res.status === 200 ? validateKeyDirectoryBody(res.body) : [`HTTP ${res.status}`] });
      } catch (e) {
        rows.push({ botId: bot.id, url, issues: [`fetch failed: ${e instanceof Error ? e.message : String(e)}`] });
      }
    }
  }
  return rows;
}
