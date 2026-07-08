import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../dist/${p}`, import.meta.url));
const branding = readFileSync(fileURLToPath(new URL('../../src/branding.ts', import.meta.url)), 'utf8');
const projectName = branding.match(/projectName:\s*'([^']+)'/)?.[1];
if (!projectName) { console.error('smoke: could not extract projectName from src/branding.ts'); process.exit(1); }

const checks = [
  ['index.html', [projectName, 'id="bot-filter"', 'data-bot']],
  ['bots/googlebot/index.html', ['How to verify', 'common-crawlers.json']],
  ['bots/claudebot/index.html', ['cannot currently be verified']],
  ['practices/index.html', ['Good Bot', 'robots.txt']],
  ['data-docs/index.html', ['/data/all.json']],
];
let failed = false;
for (const [file, markers] of checks) {
  if (!existsSync(root(file))) { console.error(`smoke: missing page ${file}`); failed = true; continue; }
  const html = readFileSync(root(file), 'utf8');
  for (const m of markers) if (!html.includes(m)) { console.error(`smoke: "${m}" missing from ${file}`); failed = true; }
}
if (!existsSync(root('data/all.json'))) { console.error('smoke: /data/all.json not in build output'); failed = true; }
if (failed) process.exit(1);
console.log('smoke: OK');
