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
