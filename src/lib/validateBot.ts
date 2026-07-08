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
