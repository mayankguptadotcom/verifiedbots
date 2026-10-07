import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parse } from 'yaml';
import { validateBotDocument, type Bot } from './validateBot.js';

export function loadBots(dir: string): Bot[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort();
  const bots: Bot[] = [];
  const problems: string[] = [];
  for (const file of files) {
    let doc: any;
    try {
      doc = parse(readFileSync(join(dir, file), 'utf8'));
    } catch (e) {
      problems.push(`${file}: YAML parse error: ${(e as Error).message}`);
      continue;
    }
    const issues = validateBotDocument(doc);
    if (issues.length > 0) {
      problems.push(`${file}:\n  ${issues.join('\n  ')}`);
      continue;
    }
    const expected = basename(file, '.yaml');
    if (doc.id !== expected) {
      problems.push(`${file}: id "${doc.id}" does not match filename`);
      continue;
    }
    bots.push(doc as Bot);
  }
  // Two files describing the same bot: identical name AND an overlapping user
  // agent pattern. This caught icc-crawler/nict-crawler and seokicks/seokicks-crawler,
  // which were each listed twice under different ids. Distinct siblings that
  // share one documented UA instance (e.g. telegrambot vs telegram-webhooks)
  // have different names and are not flagged.
  const byName = new Map<string, Bot[]>();
  for (const bot of bots) {
    const key = bot.name.trim().toLowerCase();
    const group = byName.get(key);
    if (group) group.push(bot);
    else byName.set(key, [bot]);
  }
  for (const [name, group] of byName) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const shared = a.user_agents.patterns.filter((p) => b.user_agents.patterns.includes(p));
        if (shared.length > 0) {
          problems.push(
            `${a.id}.yaml and ${b.id}.yaml: duplicate bot — both named "${name}" ` +
              `and both match pattern ${JSON.stringify(shared[0])}. ` +
              `Merge them into one entry instead of listing the bot twice.`,
          );
        }
      }
    }
  }
  if (problems.length > 0) throw new Error(`bot validation failed:\n${problems.join('\n')}`);
  return bots;
}
