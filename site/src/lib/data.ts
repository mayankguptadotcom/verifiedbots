import all from '../../../dist/all.json';

export interface BotArtifact {
  id: string;
  name: string;
  operator: { name: string; url: string };
  description: string;
  docs: string[];
  category: string;
  user_agents: { patterns: string[]; instances: string[] };
  behavior: { respects_robots_txt: boolean; robots_token?: string };
  verification: Array<Record<string, unknown> & { type: string }>;
  tier: 1 | 2 | 3;
  tier_label: string;
  first_seen: string;
  resolved_cidrs: string[];
}

export const dataset = all as {
  project: string;
  generated_at: string;
  count: number;
  bots: BotArtifact[];
};

export const CATEGORY_LABELS: Record<string, string> = {
  'search-engine': 'Search engines',
  'ai-crawler': 'AI crawlers',
  'ai-assistant': 'AI assistants',
  'social-preview': 'Social previews',
  monitoring: 'Monitoring',
  seo: 'SEO tools',
  'feed-fetcher': 'Feed fetchers',
  archiver: 'Archivers',
  security: 'Security scanners',
  webhook: 'Webhooks',
};

export function botsByCategory(): Map<string, BotArtifact[]> {
  const out = new Map<string, BotArtifact[]>();
  for (const key of Object.keys(CATEGORY_LABELS)) {
    const list = dataset.bots.filter((b) => b.category === key);
    if (list.length > 0) out.set(key, list);
  }
  return out;
}

export function stats() {
  return {
    bots: dataset.bots.length,
    verifiable: dataset.bots.filter((b) => b.tier < 3).length,
    categories: botsByCategory().size,
    ranges: dataset.bots.reduce((n, b) => n + b.resolved_cidrs.length, 0),
  };
}
