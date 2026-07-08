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
