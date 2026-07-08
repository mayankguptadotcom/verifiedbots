import type { BotArtifact } from './data';

export interface PracticeCheck {
  key: string;
  label: string;
  status: 'pass' | 'gap' | 'na' | 'info';
  detail: string;
}

const SERVICE_CATEGORIES = new Set(['webhook', 'monitoring']);

export function scorecard(bot: BotArtifact): PracticeCheck[] {
  const identifies = bot.user_agents.patterns.length > 0 && bot.user_agents.instances.length > 0;
  const verifiable = bot.tier < 3;
  const service = SERVICE_CATEGORIES.has(bot.category);
  return [
    {
      key: 'identify',
      label: 'Identifies honestly',
      status: identifies ? 'pass' : 'gap',
      detail: identifies
        ? `Stable UA token documented (${bot.user_agents.patterns.length} pattern${bot.user_agents.patterns.length === 1 ? '' : 's'})`
        : 'No documented user-agent token',
    },
    {
      key: 'verifiable',
      label: 'Verifiable',
      status: verifiable ? 'pass' : 'gap',
      detail: verifiable ? bot.tier_label : 'Operator publishes no verification path',
    },
    {
      key: 'robots',
      label: 'Respects robots.txt',
      status: service ? 'na' : bot.behavior.respects_robots_txt ? 'pass' : 'gap',
      detail: service
        ? 'Service traffic you configured — robots.txt does not apply'
        : bot.behavior.respects_robots_txt
          ? `Honors robots.txt${bot.behavior.robots_token ? ` (token: ${bot.behavior.robots_token})` : ''}`
          : 'Does not honor robots.txt',
    },
    {
      key: 'behave',
      label: 'Behaves',
      status: 'info',
      detail: 'Crawl-rate behavior is operator-declared; not machine-verifiable from this dataset',
    },
    {
      key: 'reachable',
      label: 'Reachable operator',
      status: bot.operator.url && bot.docs.length > 0 ? 'pass' : 'gap',
      detail: bot.docs.length > 0 ? 'Operator and documentation published' : 'No public documentation',
    },
  ];
}
