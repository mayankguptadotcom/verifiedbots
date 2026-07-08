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
  if (problems.length > 0) throw new Error(`bot validation failed:\n${problems.join('\n')}`);
  return bots;
}
