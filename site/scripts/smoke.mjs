import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../dist/${p}`, import.meta.url));
const branding = readFileSync(fileURLToPath(new URL('../../src/branding.ts', import.meta.url)), 'utf8');
const projectName = branding.match(/projectName:\s*'([^']+)'/)?.[1];
if (!projectName) { console.error('smoke: could not extract projectName from src/branding.ts'); process.exit(1); }

const checks = [
  ['index.html', [projectName, 'id="bot-filter"', 'data-bot', 'rel="canonical"', 'verifiedbots.dev', 'category-chips', 'mayankgupta.com']],
  ['bots/googlebot/index.html', ['How to verify', 'common-crawlers.json']],
  ['bots/bytespider/index.html', ['cannot currently be verified']],
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
if (!existsSync(root('sitemap-index.xml'))) { console.error('smoke: /sitemap-index.xml not in build output'); failed = true; }

const indexHtml = existsSync(root('index.html')) ? readFileSync(root('index.html'), 'utf8') : '';
if (/cerberus/i.test(indexHtml)) { console.error('smoke: index.html still mentions Cerberus'); failed = true; }

if (failed) process.exit(1);
console.log('smoke: OK');
