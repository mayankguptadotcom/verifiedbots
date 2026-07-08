import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { BRANDING } from '../../branding.js';
import { computeTier, TIER_LABELS, type Tier } from '../tiers.js';
import type { Bot } from '../validateBot.js';
import type { FeedOutcome } from '../feeds/fetchFeeds.js';

export type BotArtifact = Bot & { tier: Tier; tier_label: string; first_seen: string; resolved_cidrs: string[] };

function resolveCidrs(bot: Bot, outcomes: FeedOutcome[]): string[] {
  const ranges = new Set<string>();
  for (const o of outcomes) if (o.botId === bot.id) o.ranges.forEach((r) => ranges.add(r));
  for (const v of bot.verification) if (v.type === 'static_cidrs') v.cidrs.forEach((c) => ranges.add(c));
  return [...ranges].sort();
}

export function buildArtifacts(
  bots: Bot[],
  outcomes: FeedOutcome[],
  outDir: string,
  generatedAt: string,
  firstSeen: Record<string, string> = {},
): void {
  // Retract prior output first: a bot removed from the source data must not leave stale
  // artifacts (e.g. dist/bots/<removed-id>.json) behind in outDir.
  rmSync(outDir, { recursive: true, force: true });

  const artifacts: BotArtifact[] = bots
    .map((bot) => {
      const tier = computeTier(bot);
      return {
        ...bot,
        tier,
        tier_label: TIER_LABELS[tier],
        first_seen: firstSeen[bot.id] ?? generatedAt,
        resolved_cidrs: resolveCidrs(bot, outcomes),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const envelope = (list: BotArtifact[]) => ({
    project: BRANDING.projectName,
    generated_at: generatedAt,
    count: list.length,
    bots: list,
  });

  mkdirSync(join(outDir, 'by-category'), { recursive: true });
  mkdirSync(join(outDir, 'by-tier'), { recursive: true });
  mkdirSync(join(outDir, 'bots'), { recursive: true });
  mkdirSync(join(outDir, 'ips'), { recursive: true });

  writeFileSync(join(outDir, 'all.json'), JSON.stringify(envelope(artifacts), null, 2));
  for (const category of new Set(artifacts.map((b) => b.category))) {
    writeFileSync(
      join(outDir, 'by-category', `${category}.json`),
      JSON.stringify(envelope(artifacts.filter((b) => b.category === category)), null, 2),
    );
  }
  // All three tier files always exist (stable URLs for consumers), even when empty.
  for (const tier of [1, 2, 3] as const) {
    writeFileSync(
      join(outDir, 'by-tier', `tier-${tier}.json`),
      JSON.stringify(envelope(artifacts.filter((b) => b.tier === tier)), null, 2),
    );
  }
  mkdirSync(join(outDir, 'ips', 'by-category'), { recursive: true });
  mkdirSync(join(outDir, 'ips', 'by-tier'), { recursive: true });
  const allIps = new Set<string>();
  const categoryIps = new Map<string, Set<string>>();
  const tierIps = new Map<Tier, Set<string>>();
  for (const bot of artifacts) {
    writeFileSync(join(outDir, 'bots', `${bot.id}.json`), JSON.stringify(bot, null, 2));
    if (bot.resolved_cidrs.length > 0) {
      writeFileSync(join(outDir, 'ips', `${bot.id}.ips`), bot.resolved_cidrs.join('\n') + '\n');
      bot.resolved_cidrs.forEach((r) => allIps.add(r));
      const catSet = categoryIps.get(bot.category) ?? new Set<string>();
      bot.resolved_cidrs.forEach((r) => catSet.add(r));
      categoryIps.set(bot.category, catSet);
      const tierSet = tierIps.get(bot.tier) ?? new Set<string>();
      bot.resolved_cidrs.forEach((r) => tierSet.add(r));
      tierIps.set(bot.tier, tierSet);
    }
  }
  for (const [category, ranges] of categoryIps) {
    writeFileSync(join(outDir, 'ips', 'by-category', `${category}.ips`), [...ranges].sort().join('\n') + '\n');
  }
  for (const [tier, ranges] of tierIps) {
    writeFileSync(join(outDir, 'ips', 'by-tier', `tier-${tier}.ips`), [...ranges].sort().join('\n') + '\n');
  }
  writeFileSync(join(outDir, 'ips', 'all.ips'), [...allIps].sort().join('\n') + '\n');
  writeFileSync(
    join(outDir, 'ua-patterns.json'),
    JSON.stringify(artifacts.map((b) => ({ id: b.id, category: b.category, patterns: b.user_agents.patterns })), null, 2),
  );
}
