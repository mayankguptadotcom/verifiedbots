# Directory Site (Astro) Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public directory website — an app-like, typography-led Astro static site rendering the bot dataset, deployed on Cloudflare Pages, also serving the `dist/` JSON artifacts under `/data/`.

**Architecture:** `site/` is a self-contained Astro 5 project inside the repo. At build time it imports `../dist/all.json` (produced by the root `build:artifacts` pipeline) and `../src/branding.ts`, and copies `../dist` into `site/public/data` so the JSON artifacts ship on the same domain. All pages are static; the only client JS is a theme toggle, an instant filter on the home page, and copy buttons. Astro's ClientRouter (View Transitions) gives app-like page morphs.

**Tech Stack:** Astro ^5, @fontsource-variable/inter, @fontsource-variable/jetbrains-mono, vitest (helpers), vanilla JS islands (no framework), Cloudflare Pages (git integration).

## Global Constraints

- Branch: `site` created FROM `data-platform` (PR #2 is not merged yet; do not touch main).
- Branding (project name, byline, non-affiliation, domain) comes ONLY from the root `src/branding.ts` (`BRANDING.projectName === 'Verified Bots Directory'`, `BRANDING.domain === null`). No page or component may hardcode a project name or domain. The footer must show `BRANDING.byline` and `BRANDING.nonAffiliation`.
- Dataset comes ONLY from `dist/all.json` (shape: `{ project, generated_at, count, bots: BotArtifact[] }`, `BotArtifact = Bot & { tier: 1|2|3, tier_label, resolved_cidrs: string[] }`). Site never fetches at runtime; everything is build-time static.
- `dist/` is produced by the ROOT pipeline: `npm run build:artifacts` (exit 2 = published on last-known-good, acceptable for a site build: `npm run build:artifacts || [ $? -eq 2 ]`).
- Design requirements (user-mandated): app-like feel — Astro View Transitions on every page, zero perceived reloads; typography-led — big confident display type (fingerprint.com level or better); Inter Variable for UI/display, JetBrains Mono Variable for code/UA/CIDR; generous whitespace; dark + light themes (system default + toggle, no FOUC); instant client-side filter on home.
- Categories (closed enum, human labels): search-engine "Search engines", ai-crawler "AI crawlers", ai-assistant "AI assistants", social-preview "Social previews", monitoring "Monitoring", seo "SEO tools", feed-fetcher "Feed fetchers", archiver "Archivers", security "Security scanners", webhook "Webhooks".
- Tier labels (already in data): 1 "Fully verifiable", 2 "Verifiable", 3 "Listed only". Tier 3 pages must show the "operator: here's how to fix that" practices call-to-action.
- Node ≥22, ESM. Tests: `npx vitest run` inside `site/`. Commit after each green cycle.

---

### Task 1: Astro scaffold + data module + copy-data script

**Files:**
- Create: `site/package.json`, `site/astro.config.mjs`, `site/tsconfig.json`, `site/src/lib/data.ts`, `site/scripts/copy-data.mjs`, `site/src/pages/index.astro` (placeholder, replaced in Task 5), `site/.gitignore`
- Modify: root `package.json` (add `build:site` script)

**Interfaces:**
- Produces: `site/src/lib/data.ts` exporting:
  - `dataset: { project: string; generated_at: string; count: number; bots: BotArtifact[] }`
  - `interface BotArtifact` (mirror of pipeline artifact: all `Bot` fields + `tier: 1|2|3`, `tier_label: string`, `resolved_cidrs: string[]`)
  - `CATEGORY_LABELS: Record<string, string>` (the 10 labels from Global Constraints)
  - `botsByCategory(): Map<string, BotArtifact[]>` (insertion order = CATEGORY_LABELS order, only non-empty categories)
  - `stats(): { bots: number; verifiable: number; categories: number; ranges: number }` (verifiable = tier < 3; ranges = sum of resolved_cidrs lengths)
- Produces: `npm run build` inside `site/` = `node scripts/copy-data.mjs && astro build`; root `npm run build:site` = `npm --prefix site run build`.

- [ ] **Step 1: Create branch and ensure dist exists**

```bash
cd /Users/mayank/Documents/projects/verifiedbots && git checkout data-platform && git checkout -b site
npm run build:artifacts || [ $? -eq 2 ]   # populates dist/ (network); expect "built dist/ for 6 bots"
```

- [ ] **Step 2: Scaffold the Astro project**

`site/package.json`:
```json
{
  "name": "verifiedbots-site",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "astro dev",
    "build": "node scripts/copy-data.mjs && astro build",
    "preview": "astro preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@fontsource-variable/inter": "^5.1.0",
    "@fontsource-variable/jetbrains-mono": "^5.1.0",
    "astro": "^5.0.0"
  },
  "devDependencies": { "vitest": "^2.1.0" }
}
```

`site/astro.config.mjs`:
```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  // data.ts imports ../dist/all.json and ../src/branding.ts from the repo root
  vite: { server: { fs: { allow: ['..'] } } },
});
```

`site/tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": { "resolveJsonModule": true }
}
```

`site/.gitignore`:
```
dist/
node_modules/
public/data/
```

`site/scripts/copy-data.mjs`:
```js
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../../dist', import.meta.url));
const dest = fileURLToPath(new URL('../public/data', import.meta.url));
if (!existsSync(`${src}/all.json`)) {
  console.error('copy-data: ../dist/all.json missing — run `npm run build:artifacts` at the repo root first');
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log('copy-data: dist/ -> public/data/');
```

`site/src/lib/data.ts`:
```ts
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
```

`site/src/pages/index.astro` (placeholder so the scaffold builds; Task 5 replaces it):
```astro
---
import { dataset, stats } from '../lib/data';
import { BRANDING } from '../../../src/branding';
const s = stats();
---
<html lang="en"><head><meta charset="utf-8" /><title>{BRANDING.projectName}</title></head>
<body><h1>{BRANDING.projectName}</h1><p>{s.bots} bots · generated {dataset.generated_at}</p></body></html>
```

Root `package.json` — add to `"scripts"`:
```json
"build:site": "npm --prefix site run build"
```

- [ ] **Step 3: Install and build to verify the scaffold**

Run: `cd site && npm install && npm run build`
Expected: `copy-data: dist/ -> public/data/`, then Astro builds 1 page with no errors; `site/dist/index.html` contains "Verified Bots Directory"; `site/dist/data/all.json` exists.

- [ ] **Step 4: Commit**

```bash
cd /Users/mayank/Documents/projects/verifiedbots
git add site/package.json site/package-lock.json site/astro.config.mjs site/tsconfig.json site/.gitignore site/scripts/copy-data.mjs site/src/lib/data.ts site/src/pages/index.astro package.json
git commit -m "feat(site): Astro scaffold, data module, artifact copy into /data"
```

---

### Task 2: Design system — tokens, fonts, theme, Layout

**Files:**
- Create: `site/src/styles/global.css`, `site/src/layouts/Layout.astro`

**Interfaces:**
- Produces: `Layout.astro` with props `{ title: string; description?: string }`, a `<slot />`, ClientRouter enabled, header (wordmark link home, nav: Directory `/`, Practices `/practices`, Data `/data-docs`, Submit `/submit`, theme toggle button `#theme-toggle`), footer (byline, non-affiliation, `generated_at`, GitHub link `https://github.com/mayankguptadotcom/verifiedbots`). All later pages wrap in this layout.
- CSS custom properties every later task uses: `--bg --surface --text --muted --border --accent --accent-soft --tier1 --tier2 --tier3 --radius --font-ui --font-mono --text-display --text-h1 --text-h2 --text-body --text-small --container --space-*`.

- [ ] **Step 1: Write the design tokens and base styles**

`site/src/styles/global.css`:
```css
@import '@fontsource-variable/inter';
@import '@fontsource-variable/jetbrains-mono';

:root {
  --font-ui: 'Inter Variable', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono Variable', ui-monospace, monospace;

  /* typography-led scale: big, confident display type */
  --text-display: clamp(2.75rem, 7vw, 5.25rem);
  --text-h1: clamp(2rem, 4.5vw, 3.25rem);
  --text-h2: clamp(1.4rem, 2.5vw, 2rem);
  --text-body: 1.0625rem;
  --text-small: 0.875rem;

  --container: 72rem;
  --radius: 14px;
  --space-1: 0.5rem; --space-2: 1rem; --space-3: 1.75rem; --space-4: 3rem; --space-5: 5.5rem;

  --bg: #fafaf9;
  --surface: #ffffff;
  --text: #131312;
  --muted: #6e6d68;
  --border: #e6e4e0;
  --accent: #4f46e5;
  --accent-soft: #eef2ff;
  --tier1: #0d9488;
  --tier2: #d97706;
  --tier3: #8f8e89;
}

[data-theme='dark'] {
  --bg: #0d0d0e;
  --surface: #17171a;
  --text: #f1f1ee;
  --muted: #93928c;
  --border: #29292e;
  --accent: #818cf8;
  --accent-soft: #1e1b4b;
  --tier1: #2dd4bf;
  --tier2: #fbbf24;
  --tier3: #6f6e69;
}

* { box-sizing: border-box; }
html { color-scheme: light; }
[data-theme='dark'] { color-scheme: dark; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: var(--text-body);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}

.container { max-width: var(--container); margin-inline: auto; padding-inline: var(--space-3); }

h1, h2, h3 { line-height: 1.08; letter-spacing: -0.025em; margin: 0 0 var(--space-2); font-weight: 640; }
h1 { font-size: var(--text-h1); }
h2 { font-size: var(--text-h2); }
.display { font-size: var(--text-display); letter-spacing: -0.035em; line-height: 1.01; font-weight: 660; }

a { color: inherit; text-decoration: none; }
p a, li a { color: var(--accent); }
p a:hover, li a:hover { text-decoration: underline; }

code, pre, .mono { font-family: var(--font-mono); font-size: 0.9em; }
pre { overflow-x: auto; }

.muted { color: var(--muted); }
.small { font-size: var(--text-small); }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-3);
  transition: border-color 0.15s ease, transform 0.15s ease;
}
a.card:hover { border-color: var(--accent); transform: translateY(-2px); }

.pill {
  display: inline-flex; align-items: center; gap: 0.4em;
  border-radius: 999px; padding: 0.2em 0.85em;
  font-size: var(--text-small); font-weight: 560;
  border: 1px solid var(--border); background: var(--surface);
}

.site-header {
  position: sticky; top: 0; z-index: 10;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.site-header .container { display: flex; align-items: center; gap: var(--space-3); padding-block: 0.9rem; }
.site-header nav { display: flex; gap: var(--space-2); margin-left: auto; align-items: center; }
.site-header nav a { color: var(--muted); font-weight: 560; font-size: var(--text-small); }
.site-header nav a:hover, .site-header nav a[aria-current='page'] { color: var(--text); }
.wordmark { font-weight: 700; letter-spacing: -0.02em; }

#theme-toggle {
  border: 1px solid var(--border); background: var(--surface); color: var(--text);
  border-radius: 999px; width: 2.1rem; height: 2.1rem; cursor: pointer; font-size: 0.95rem;
}

.site-footer { border-top: 1px solid var(--border); margin-top: var(--space-5); padding-block: var(--space-4); }

@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

- [ ] **Step 2: Write the Layout**

`site/src/layouts/Layout.astro`:
```astro
---
import { ClientRouter } from 'astro:transitions';
import { BRANDING } from '../../../src/branding';
import { dataset } from '../lib/data';
import '../styles/global.css';

interface Props { title: string; description?: string }
const { title, description = 'The open, categorized directory of verified good bots — user agents, IP ranges, and how to verify them.' } = Astro.props;
const path = Astro.url.pathname;
const nav = [
  { href: '/', label: 'Directory' },
  { href: '/practices', label: 'Practices' },
  { href: '/data-docs', label: 'Data' },
  { href: '/submit', label: 'Submit a bot' },
];
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <title>{title === BRANDING.projectName ? title : `${title} — ${BRANDING.projectName}`}</title>
    <script is:inline>
      const saved = localStorage.getItem('theme');
      document.documentElement.dataset.theme =
        saved ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    </script>
    <ClientRouter />
  </head>
  <body>
    <header class="site-header">
      <div class="container">
        <a href="/" class="wordmark">{BRANDING.projectName}</a>
        <nav>
          {nav.map((n) => (
            <a href={n.href} aria-current={path === n.href || (n.href !== '/' && path.startsWith(n.href)) ? 'page' : undefined}>{n.label}</a>
          ))}
          <button id="theme-toggle" aria-label="Toggle theme">◐</button>
        </nav>
      </div>
    </header>
    <main class="container">
      <slot />
    </main>
    <footer class="site-footer">
      <div class="container small muted">
        <p><strong>{BRANDING.projectName}</strong> {BRANDING.byline}. Data generated {dataset.generated_at.slice(0, 10)}. <a href="https://github.com/mayankguptadotcom/verifiedbots">GitHub</a></p>
        <p>{BRANDING.nonAffiliation}</p>
      </div>
    </footer>
    <script>
      // Delegated, ClientRouter-safe: attach once per full load, survives view transitions.
      document.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('#theme-toggle');
        if (!btn) return;
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        localStorage.setItem('theme', next);
      });
      // Re-apply theme after each view transition (new document head runs is:inline again, but keep for safety).
      document.addEventListener('astro:after-swap', () => {
        const saved = localStorage.getItem('theme');
        if (saved) document.documentElement.dataset.theme = saved;
      });
    </script>
  </body>
</html>
```

- [ ] **Step 3: Point the placeholder index at the Layout to prove it renders**

Replace `site/src/pages/index.astro` with:
```astro
---
import Layout from '../layouts/Layout.astro';
import { BRANDING } from '../../../src/branding';
import { stats } from '../lib/data';
const s = stats();
---
<Layout title={BRANDING.projectName}>
  <h1 class="display">{s.bots} good bots, verified.</h1>
</Layout>
```

- [ ] **Step 4: Build to verify**

Run: `cd site && npm run build`
Expected: builds clean; `site/dist/index.html` contains `data-theme` bootstrap script, the header nav, footer non-affiliation text, and the display headline.

- [ ] **Step 5: Commit**

```bash
git add site/src/styles/global.css site/src/layouts/Layout.astro site/src/pages/index.astro
git commit -m "feat(site): design system — tokens, fonts, dark/light theme, app shell layout"
```

---

### Task 3: Scorecard + verify-command helpers (TDD)

**Files:**
- Create: `site/src/lib/scorecard.ts`, `site/src/lib/verify-commands.ts`, `site/tests/scorecard.test.ts`, `site/tests/verify-commands.test.ts`, `site/vitest.config.ts`

**Interfaces:**
- Consumes: `BotArtifact` from `site/src/lib/data.ts` (Task 1).
- Produces:
  - `scorecard(bot: BotArtifact): PracticeCheck[]` where `PracticeCheck = { key: string; label: string; status: 'pass' | 'gap' | 'na' | 'info'; detail: string }` — exactly 5 entries, keys `identify`, `verifiable`, `robots`, `behave`, `reachable`, in that order.
  - `verifyCommands(bot: BotArtifact): Array<{ title: string; command: string }>` — one entry per verification recipe that has a runnable check.

- [ ] **Step 1: Create vitest config**

`site/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
```

- [ ] **Step 2: Write the failing tests**

`site/tests/scorecard.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scorecard } from '../src/lib/scorecard';
import type { BotArtifact } from '../src/lib/data';

const base: BotArtifact = {
  id: 'testbot', name: 'TestBot',
  operator: { name: 'Test', url: 'https://example.com' },
  description: 'x', docs: ['https://example.com/docs'], category: 'search-engine',
  user_agents: { patterns: ['TestBot/\\d'], instances: ['TestBot/1.0'] },
  behavior: { respects_robots_txt: true, robots_token: 'TestBot' },
  verification: [{ type: 'rdns', masks: ['*.example.com'] }],
  tier: 2, tier_label: 'Verifiable', resolved_cidrs: [],
};

describe('scorecard', () => {
  it('returns the five practices in order for a conformant bot', () => {
    const s = scorecard(base);
    expect(s.map((c) => c.key)).toEqual(['identify', 'verifiable', 'robots', 'behave', 'reachable']);
    expect(s.map((c) => c.status)).toEqual(['pass', 'pass', 'pass', 'info', 'pass']);
  });
  it('marks verifiable as gap for tier 3', () => {
    const s = scorecard({ ...base, verification: [], tier: 3, tier_label: 'Listed only' });
    expect(s.find((c) => c.key === 'verifiable')).toMatchObject({ status: 'gap' });
  });
  it('marks robots as na for service categories (webhook, monitoring)', () => {
    for (const category of ['webhook', 'monitoring']) {
      const s = scorecard({ ...base, category, behavior: { respects_robots_txt: false } });
      expect(s.find((c) => c.key === 'robots')).toMatchObject({ status: 'na' });
    }
  });
  it('marks robots as gap for a crawler that ignores robots.txt', () => {
    const s = scorecard({ ...base, behavior: { respects_robots_txt: false } });
    expect(s.find((c) => c.key === 'robots')).toMatchObject({ status: 'gap' });
  });
});
```

`site/tests/verify-commands.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { verifyCommands } from '../src/lib/verify-commands';
import type { BotArtifact } from '../src/lib/data';

const bot = (verification: BotArtifact['verification']): BotArtifact => ({
  id: 'b', name: 'B', operator: { name: 'O', url: 'https://o.example' },
  description: 'x', docs: [], category: 'search-engine',
  user_agents: { patterns: [], instances: [] },
  behavior: { respects_robots_txt: true },
  verification, tier: 1, tier_label: 'Fully verifiable', resolved_cidrs: [],
});

describe('verifyCommands', () => {
  it('builds a curl for cidr_feed', () => {
    const c = verifyCommands(bot([{ type: 'cidr_feed', url: 'https://x.example/f.json', format: 'prefixes' }]));
    expect(c).toEqual([{ title: 'Fetch the official IP range feed', command: 'curl -s https://x.example/f.json' }]);
  });
  it('builds a dig for rdns with the first mask in a comment', () => {
    const c = verifyCommands(bot([{ type: 'rdns', masks: ['*.googlebot.com', '*.geo.googlebot.com'] }]));
    expect(c[0].command).toBe('dig -x <client-ip> +short   # expect a hostname matching *.googlebot.com');
  });
  it('builds a whois for asn', () => {
    const c = verifyCommands(bot([{ type: 'asn', numbers: [32934] }]));
    expect(c[0].command).toBe("whois -h whois.radb.net -- '-i origin AS32934' | grep route");
  });
  it('builds a curl for web_bot_auth and skips static_cidrs', () => {
    const c = verifyCommands(bot([
      { type: 'static_cidrs', cidrs: ['5.255.96.0/20'] },
      { type: 'web_bot_auth', signature_agent_url: 'https://x.example/.well-known/http-message-signatures-directory' },
    ]));
    expect(c).toHaveLength(1);
    expect(c[0].command).toBe('curl -s https://x.example/.well-known/http-message-signatures-directory');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd site && npx vitest run`
Expected: FAIL — cannot find `../src/lib/scorecard` / `../src/lib/verify-commands`.

- [ ] **Step 4: Implement**

`site/src/lib/scorecard.ts`:
```ts
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
      key: 'identify', label: 'Identifies honestly',
      status: identifies ? 'pass' : 'gap',
      detail: identifies ? `Stable UA token documented (${bot.user_agents.patterns.length} pattern${bot.user_agents.patterns.length === 1 ? '' : 's'})` : 'No documented user-agent token',
    },
    {
      key: 'verifiable', label: 'Verifiable',
      status: verifiable ? 'pass' : 'gap',
      detail: verifiable ? bot.tier_label : 'Operator publishes no verification path',
    },
    {
      key: 'robots', label: 'Respects robots.txt',
      status: service ? 'na' : bot.behavior.respects_robots_txt ? 'pass' : 'gap',
      detail: service
        ? 'Service traffic you configured — robots.txt does not apply'
        : bot.behavior.respects_robots_txt
          ? `Honors robots.txt${bot.behavior.robots_token ? ` (token: ${bot.behavior.robots_token})` : ''}`
          : 'Does not honor robots.txt',
    },
    {
      key: 'behave', label: 'Behaves',
      status: 'info',
      detail: 'Crawl-rate behavior is operator-declared; not machine-verifiable from this dataset',
    },
    {
      key: 'reachable', label: 'Reachable operator',
      status: bot.operator.url && bot.docs.length > 0 ? 'pass' : 'gap',
      detail: bot.docs.length > 0 ? 'Operator and documentation published' : 'No public documentation',
    },
  ];
}
```

`site/src/lib/verify-commands.ts`:
```ts
import type { BotArtifact } from './data';

export function verifyCommands(bot: BotArtifact): Array<{ title: string; command: string }> {
  const out: Array<{ title: string; command: string }> = [];
  for (const v of bot.verification) {
    switch (v.type) {
      case 'cidr_feed':
        out.push({ title: 'Fetch the official IP range feed', command: `curl -s ${v.url as string}` });
        break;
      case 'rdns':
        out.push({
          title: 'Reverse-DNS check a client IP',
          command: `dig -x <client-ip> +short   # expect a hostname matching ${(v.masks as string[])[0]}`,
        });
        break;
      case 'asn':
        out.push({
          title: 'Look up the announced ranges by ASN',
          command: `whois -h whois.radb.net -- '-i origin AS${(v.numbers as number[])[0]}' | grep route`,
        });
        break;
      case 'web_bot_auth':
        out.push({ title: 'Fetch the Web Bot Auth key directory', command: `curl -s ${v.signature_agent_url as string}` });
        break;
      // static_cidrs: the ranges themselves are displayed; no runnable command.
    }
  }
  return out;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd site && npx vitest run`
Expected: PASS (8 tests, 2 files).

- [ ] **Step 6: Commit**

```bash
git add site/vitest.config.ts site/src/lib/scorecard.ts site/src/lib/verify-commands.ts site/tests/
git commit -m "feat(site): practices scorecard and verify-command helpers (TDD)"
```

---

### Task 4: Components — TierBadge, BotCard, CopyBlock, Scorecard

**Files:**
- Create: `site/src/components/TierBadge.astro`, `site/src/components/BotCard.astro`, `site/src/components/CopyBlock.astro`, `site/src/components/Scorecard.astro`

**Interfaces:**
- Consumes: `BotArtifact`, `CATEGORY_LABELS` (Task 1); `PracticeCheck` (Task 3); CSS tokens (Task 2).
- Produces (props):
  - `TierBadge { tier: 1|2|3, label: string }` — pill with a tier-colored dot.
  - `BotCard { bot: BotArtifact }` — `<a class="card" href={/bots/${id}} data-bot="...">` with `transition:name={`bot-name-${bot.id}`}` on the name; `data-bot` = lowercased `id name operator category` (home-page filter hook).
  - `CopyBlock { command: string, title?: string }` — mono block + copy button (delegated clipboard handler, ClientRouter-safe).
  - `Scorecard { checks: PracticeCheck[] }` — 5-row list with status glyphs: pass ✓ (tier1 color), gap ✗ (tier2 color), na —, info ○.

- [ ] **Step 1: Write the components**

`site/src/components/TierBadge.astro`:
```astro
---
interface Props { tier: 1 | 2 | 3; label: string }
const { tier, label } = Astro.props;
---
<span class={`pill tier-${tier}`}><span class="dot"></span>{label}</span>
<style>
  .dot { width: 0.55em; height: 0.55em; border-radius: 999px; display: inline-block; }
  .tier-1 .dot { background: var(--tier1); }
  .tier-2 .dot { background: var(--tier2); }
  .tier-3 .dot { background: var(--tier3); }
  .tier-3 { color: var(--muted); }
</style>
```

`site/src/components/BotCard.astro`:
```astro
---
import type { BotArtifact } from '../lib/data';
import { CATEGORY_LABELS } from '../lib/data';
import TierBadge from './TierBadge.astro';

interface Props { bot: BotArtifact }
const { bot } = Astro.props;
const haystack = `${bot.id} ${bot.name} ${bot.operator.name} ${bot.category} ${CATEGORY_LABELS[bot.category] ?? ''}`.toLowerCase();
---
<a class="card bot-card" href={`/bots/${bot.id}`} data-bot={haystack}>
  <div class="top">
    <h3 transition:name={`bot-name-${bot.id}`}>{bot.name}</h3>
    <TierBadge tier={bot.tier} label={bot.tier_label} />
  </div>
  <p class="muted small">{bot.operator.name} · {CATEGORY_LABELS[bot.category] ?? bot.category}</p>
  <p class="desc">{bot.description}</p>
</a>
<style>
  .bot-card { display: block; }
  .top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
  h3 { margin: 0; font-size: 1.25rem; }
  .desc { margin: 0.6rem 0 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
```

`site/src/components/CopyBlock.astro`:
```astro
---
interface Props { command: string; title?: string }
const { command, title } = Astro.props;
---
<div class="copyblock">
  {title && <p class="small muted">{title}</p>}
  <div class="row">
    <pre><code>{command}</code></pre>
    <button class="copy-btn" data-copy={command}>Copy</button>
  </div>
</div>
<script>
  // One delegated handler for all CopyBlocks; guarded so ClientRouter swaps don't double-bind.
  if (!(window as any).__copyBound) {
    (window as any).__copyBound = true;
    document.addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.copy-btn');
      if (!btn) return;
      await navigator.clipboard.writeText(btn.dataset.copy ?? '');
      const prev = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => (btn.textContent = prev), 1200);
    });
  }
</script>
<style>
  .copyblock { margin-block: var(--space-2); }
  .copyblock p { margin: 0 0 0.35rem; }
  .row { display: flex; align-items: stretch; gap: 0.5rem; }
  pre { flex: 1; margin: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 0.7rem 0.9rem; }
  .copy-btn { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 10px; padding: 0 0.9rem; cursor: pointer; font: inherit; font-size: var(--text-small); }
  .copy-btn:hover { border-color: var(--accent); }
</style>
```

`site/src/components/Scorecard.astro`:
```astro
---
import type { PracticeCheck } from '../lib/scorecard';
interface Props { checks: PracticeCheck[] }
const { checks } = Astro.props;
const glyph = { pass: '✓', gap: '✗', na: '—', info: '○' } as const;
---
<ul class="scorecard">
  {checks.map((c) => (
    <li class={c.status}>
      <span class="glyph" aria-hidden="true">{glyph[c.status]}</span>
      <div>
        <strong>{c.label}</strong>
        <p class="small muted">{c.detail}</p>
      </div>
    </li>
  ))}
</ul>
<style>
  .scorecard { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-1); }
  li { display: flex; gap: 0.8rem; align-items: baseline; padding: 0.65rem 0.2rem; border-bottom: 1px solid var(--border); }
  li:last-child { border-bottom: none; }
  .glyph { font-weight: 700; width: 1.2em; text-align: center; }
  .pass .glyph { color: var(--tier1); }
  .gap .glyph { color: var(--tier2); }
  .na .glyph, .info .glyph { color: var(--muted); }
  p { margin: 0.1rem 0 0; }
</style>
```

- [ ] **Step 2: Build to verify components compile**

The components aren't referenced by a page yet; Astro only type-checks referenced files at build. Reference-check them instead:
Run: `cd site && npx astro check 2>&1 | tail -5`
Expected: 0 errors (astro check compiles all `.astro` files). If `astro check` requires the optional `@astrojs/check` package, install it as a devDependency: `npm i -D @astrojs/check typescript` and re-run.

- [ ] **Step 3: Commit**

```bash
git add site/src/components/ site/package.json site/package-lock.json
git commit -m "feat(site): TierBadge, BotCard, CopyBlock, Scorecard components"
```

---

### Task 5: Home page — hero, stats, category grid, instant filter

**Files:**
- Modify: `site/src/pages/index.astro` (full replacement)

**Interfaces:**
- Consumes: `Layout` (Task 2), `BotCard` (Task 4), `dataset`, `stats`, `botsByCategory`, `CATEGORY_LABELS` (Task 1), `BRANDING`.
- Produces: `/` with `#bot-filter` input; typing filters `[data-bot]` cards instantly and hides emptied `[data-category-section]` sections; `#no-results` message when nothing matches.

- [ ] **Step 1: Write the page**

`site/src/pages/index.astro`:
```astro
---
import Layout from '../layouts/Layout.astro';
import BotCard from '../components/BotCard.astro';
import { BRANDING } from '../../../src/branding';
import { stats, botsByCategory, CATEGORY_LABELS } from '../lib/data';
const s = stats();
const groups = botsByCategory();
---
<Layout title={BRANDING.projectName}>
  <section class="hero">
    <h1 class="display">The good bots,<br />verified.</h1>
    <p class="lede">
      The open, categorized directory of legitimate bots — their user agents, published IP ranges,
      and exactly how to verify them.
    </p>
    <div class="stats mono small">
      <span><strong>{s.bots}</strong> bots</span>
      <span><strong>{s.verifiable}</strong> verifiable</span>
      <span><strong>{s.categories}</strong> categories</span>
      <span><strong>{s.ranges}</strong> IP ranges</span>
    </div>
    <input id="bot-filter" type="search" placeholder="Filter bots — name, operator, category… ( / )" autocomplete="off" />
  </section>

  {[...groups.entries()].map(([key, bots]) => (
    <section class="category" data-category-section>
      <h2 id={key}><a href={`/category/${key}`}>{CATEGORY_LABELS[key]}</a> <span class="muted small">{bots.length}</span></h2>
      <div class="grid">
        {bots.map((bot) => <BotCard bot={bot} />)}
      </div>
    </section>
  ))}
  <p id="no-results" class="muted" hidden>No bots match that filter.</p>

  <script>
    function initFilter() {
      const input = document.getElementById('bot-filter') as HTMLInputElement | null;
      if (!input) return;
      const cards = [...document.querySelectorAll<HTMLElement>('[data-bot]')];
      const sections = [...document.querySelectorAll<HTMLElement>('[data-category-section]')];
      const empty = document.getElementById('no-results')!;
      const apply = () => {
        const q = input.value.trim().toLowerCase();
        let shown = 0;
        for (const card of cards) {
          const hit = !q || (card.dataset.bot ?? '').includes(q);
          card.hidden = !hit;
          if (hit) shown++;
        }
        for (const s of sections) s.hidden = ![...s.querySelectorAll<HTMLElement>('[data-bot]')].some((c) => !c.hidden);
        empty.hidden = shown > 0;
      };
      input.addEventListener('input', apply);
      document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
      });
    }
    initFilter();
    document.addEventListener('astro:page-load', initFilter);
  </script>

  <style>
    .hero { padding-block: var(--space-5) var(--space-4); max-width: 52rem; }
    .lede { font-size: 1.35rem; color: var(--muted); line-height: 1.5; margin: var(--space-2) 0 var(--space-3); }
    .stats { display: flex; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-3); color: var(--muted); }
    .stats strong { color: var(--text); font-size: 1.15em; }
    #bot-filter {
      width: 100%; max-width: 34rem; font: inherit; color: var(--text);
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 0.85rem 1.1rem;
    }
    #bot-filter:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: transparent; }
    .category { margin-block: var(--space-4); }
    .category h2 a:hover { color: var(--accent); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr)); gap: var(--space-2); }
  </style>
</Layout>
```

- [ ] **Step 2: Build and verify**

Run: `cd site && npm run build && grep -o 'data-bot=' dist/index.html | wc -l`
Expected: build clean; count is `6` (one card attribute per seed bot; the `=` suffix excludes the filter script's selector strings). `dist/index.html` contains `id="bot-filter"` and the four stat numbers.

- [ ] **Step 3: Commit**

```bash
git add site/src/pages/index.astro
git commit -m "feat(site): home — hero, live stats, category grid, instant filter"
```

---

### Task 6: Bot detail pages + category pages

**Files:**
- Create: `site/src/pages/bots/[id].astro`, `site/src/pages/category/[category].astro`

**Interfaces:**
- Consumes: everything from Tasks 1–4 (`dataset`, `CATEGORY_LABELS`, `TierBadge`, `CopyBlock`, `Scorecard`, `scorecard()`, `verifyCommands()`).
- Produces: `/bots/<id>` for every bot; `/category/<key>` for every non-empty category.

- [ ] **Step 1: Write the bot detail page**

`site/src/pages/bots/[id].astro`:
```astro
---
import Layout from '../../layouts/Layout.astro';
import TierBadge from '../../components/TierBadge.astro';
import CopyBlock from '../../components/CopyBlock.astro';
import Scorecard from '../../components/Scorecard.astro';
import { dataset, CATEGORY_LABELS } from '../../lib/data';
import { scorecard } from '../../lib/scorecard';
import { verifyCommands } from '../../lib/verify-commands';

export function getStaticPaths() {
  return dataset.bots.map((bot) => ({ params: { id: bot.id }, props: { bot } }));
}
const { bot } = Astro.props;
const checks = scorecard(bot);
const commands = verifyCommands(bot);
const staticCidrs = bot.verification.filter((v) => v.type === 'static_cidrs');
const rdns = bot.verification.filter((v) => v.type === 'rdns');
---
<Layout title={bot.name} description={bot.description}>
  <article>
    <header class="bot-head">
      <p class="small muted crumbs"><a href="/">Directory</a> / <a href={`/category/${bot.category}`}>{CATEGORY_LABELS[bot.category] ?? bot.category}</a></p>
      <div class="title-row">
        <h1 transition:name={`bot-name-${bot.id}`}>{bot.name}</h1>
        <TierBadge tier={bot.tier} label={bot.tier_label} />
      </div>
      <p class="lede">{bot.description}</p>
      <p class="small muted">
        Operated by <a href={bot.operator.url}>{bot.operator.name}</a>
        {bot.docs.length > 0 && <> · <a href={bot.docs[0]}>Official documentation</a></>}
      </p>
    </header>

    {bot.tier === 3 && (
      <aside class="card tier3-note">
        <strong>This bot cannot currently be verified.</strong>
        <p>Its operator publishes no IP ranges, rDNS, or Web Bot Auth keys — sites must trust the user-agent string alone.
        Operator: <a href="/practices">here's how to fix that →</a></p>
      </aside>
    )}

    <section>
      <h2>User agents</h2>
      <p class="small muted">Patterns this directory matches, with real observed strings.</p>
      <ul class="mono small ua-list">
        {bot.user_agents.patterns.map((p) => <li class="pattern">{p}</li>)}
        {bot.user_agents.instances.map((i) => <li class="instance muted">{i}</li>)}
      </ul>
    </section>

    <section>
      <h2>How to verify</h2>
      {commands.map((c) => <CopyBlock title={c.title} command={c.command} />)}
      {rdns.map((v) => (
        <p class="small muted">Reverse-DNS suffixes: <span class="mono">{(v.masks as string[]).join(', ')}</span></p>
      ))}
      {staticCidrs.map((v) => (
        <p class="small muted">Documented static ranges: <span class="mono">{(v.cidrs as string[]).join(', ')}</span></p>
      ))}
      {commands.length === 0 && staticCidrs.length === 0 && rdns.length === 0 && (
        <p class="muted">No verification recipe published by the operator.</p>
      )}
    </section>

    {bot.resolved_cidrs.length > 0 && (
      <section>
        <h2>IP ranges <span class="muted small">({bot.resolved_cidrs.length})</span></h2>
        <p class="small muted">Refreshed daily from the operator's feed. Also available as <a href={`/data/ips/${bot.id}.ips`} class="mono">/data/ips/{bot.id}.ips</a> and <a href={`/data/bots/${bot.id}.json`} class="mono">/data/bots/{bot.id}.json</a>.</p>
        <pre class="ranges mono small">{bot.resolved_cidrs.join('\n')}</pre>
      </section>
    )}

    <section>
      <h2>Good Bot Practices scorecard</h2>
      <Scorecard checks={checks} />
      <p class="small muted">Measured against the <a href="/practices">Good Bot Practices</a>.</p>
    </section>
  </article>

  <style>
    .bot-head { padding-block: var(--space-4) var(--space-2); }
    .crumbs { margin-bottom: var(--space-2); }
    .title-row { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
    .title-row h1 { margin: 0; }
    .lede { font-size: 1.25rem; color: var(--muted); max-width: 46rem; }
    section { margin-block: var(--space-4); }
    .tier3-note { border-color: var(--tier2); }
    .tier3-note p { margin: 0.4rem 0 0; }
    .ua-list { list-style: none; padding: 0; display: grid; gap: 0.4rem; }
    .ua-list li { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0.45rem 0.7rem; overflow-x: auto; white-space: nowrap; }
    .ua-list .pattern { border-left: 3px solid var(--accent); }
    .ranges { max-height: 22rem; overflow: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: var(--space-2); }
  </style>
</Layout>
```

- [ ] **Step 2: Write the category page**

`site/src/pages/category/[category].astro`:
```astro
---
import Layout from '../../layouts/Layout.astro';
import BotCard from '../../components/BotCard.astro';
import { botsByCategory, CATEGORY_LABELS } from '../../lib/data';

export function getStaticPaths() {
  return [...botsByCategory().entries()].map(([category, bots]) => ({ params: { category }, props: { bots } }));
}
const { category } = Astro.params;
const { bots } = Astro.props;
const label = CATEGORY_LABELS[category!] ?? category;
---
<Layout title={label}>
  <header class="cat-head">
    <p class="small muted"><a href="/">Directory</a> / {label}</p>
    <h1>{label} <span class="muted">{bots.length}</span></h1>
  </header>
  <div class="grid">
    {bots.map((bot) => <BotCard bot={bot} />)}
  </div>
  <style>
    .cat-head { padding-block: var(--space-4) var(--space-2); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr)); gap: var(--space-2); }
  </style>
</Layout>
```

- [ ] **Step 3: Build and verify**

Run: `cd site && npm run build && ls dist/bots dist/category`
Expected: build clean; `dist/bots/` has 6 dirs (claudebot, googlebot, gptbot, meta-externalagent, stripe-webhooks, uptimerobot); `dist/category/` has 4 dirs (search-engine, ai-crawler, monitoring, webhook). `dist/bots/claudebot/index.html` contains "cannot currently be verified"; `dist/bots/googlebot/index.html` contains "How to verify" and a `curl -s https://developers.google.com/static/crawling/ipranges/common-crawlers.json` copy block.

- [ ] **Step 4: Commit**

```bash
git add site/src/pages/bots/ site/src/pages/category/
git commit -m "feat(site): bot detail pages (verify recipes, ranges, scorecard) + category pages"
```

---

### Task 7: Practices, Submit, Data docs, 404 pages

**Files:**
- Create: `site/src/pages/practices.astro`, `site/src/pages/submit.astro`, `site/src/pages/data-docs.astro`, `site/src/pages/404.astro`

**Interfaces:**
- Consumes: `Layout`, `CopyBlock`, `dataset`, `BRANDING`.
- Produces: `/practices`, `/submit`, `/data-docs`, `/404`. Content mirrors the repo's PRACTICES.md and CONTRIBUTING.md (site-native layout, same substance).

- [ ] **Step 1: Write the practices page**

`site/src/pages/practices.astro`:
```astro
---
import Layout from '../layouts/Layout.astro';
const practices = [
  { n: 1, title: 'Identify honestly', body: 'Send a stable User-Agent token: product name, version, and an info URL. Example: ExampleBot/2.1 (+https://example.com/bot).', field: 'user_agents' },
  { n: 2, title: 'Be verifiable', body: 'Publish machine-readable IP ranges at a stable HTTPS URL (the Google/OpenAI prefixes JSON shape is the de-facto standard), support forward/reverse DNS on a domain you control, or implement Web Bot Auth (IETF HTTP Message Signatures) and host a key directory at /.well-known/http-message-signatures-directory. Implement with Cloudflare’s open-source libraries (github.com/cloudflare/web-bot-auth); self-test free at fingerprint.com/web-bot-auth/test/.', field: 'verification' },
  { n: 3, title: 'Respect robots.txt', body: 'Honor robots.txt and document your token. Service traffic that is not a crawler (webhooks, monitors the site owner configured) is exempt by nature.', field: 'behavior.respects_robots_txt' },
  { n: 4, title: 'Behave', body: 'Sane request rates. Back off on 429 and 503. Honor cache headers.', field: 'behavior' },
  { n: 5, title: 'Be reachable', body: 'Publish operator identity, documentation, and a contact channel for site owners.', field: 'operator, docs' },
];
---
<Layout title="Good Bot Practices">
  <header class="head">
    <h1 class="display">Good Bot<br />Practices</h1>
    <p class="lede">The standard this directory measures every bot against. Each practice maps to a field in the
    bot schema, so every directory entry doubles as a conformance scorecard.</p>
  </header>
  <ol class="practices">
    {practices.map((p) => (
      <li class="card">
        <span class="n mono">{String(p.n).padStart(2, '0')}</span>
        <div>
          <h2>{p.title}</h2>
          <p>{p.body}</p>
          <p class="small muted mono">schema: {p.field}</p>
        </div>
      </li>
    ))}
  </ol>
  <p>Ready to be listed? <a href="/submit">Submit your bot →</a></p>
  <style>
    .head { padding-block: var(--space-5) var(--space-3); max-width: 52rem; }
    .lede { font-size: 1.35rem; color: var(--muted); line-height: 1.5; }
    .practices { list-style: none; margin: 0 0 var(--space-4); padding: 0; display: grid; gap: var(--space-2); }
    .practices li { display: flex; gap: var(--space-3); }
    .n { color: var(--accent); font-size: 1.5rem; font-weight: 700; }
    .practices h2 { font-size: 1.35rem; margin-bottom: 0.4rem; }
    .practices p { margin: 0 0 0.4rem; }
  </style>
</Layout>
```

- [ ] **Step 2: Write submit + data docs + 404**

`site/src/pages/submit.astro`:
```astro
---
import Layout from '../layouts/Layout.astro';
import CopyBlock from '../components/CopyBlock.astro';
const repo = 'https://github.com/mayankguptadotcom/verifiedbots';
---
<Layout title="Submit a bot">
  <header class="head">
    <h1 class="display">Submit a bot</h1>
    <p class="lede">Every entry is a reviewed pull request. Automated checks validate your data —
    a maintainer reviews legitimacy before anything is published.</p>
  </header>
  <section class="card">
    <h2>1 — The PR route (preferred)</h2>
    <p>Add one YAML file describing your bot and open a pull request. CI validates the schema,
    live-fetches any IP feed you claim, checks your UA patterns against real instances, and posts a report.</p>
    <CopyBlock title="Start from an existing bot file" command={`git clone ${repo} && cp bots/googlebot.yaml bots/<your-bot-id>.yaml`} />
    <p class="small muted">Read <a href={`${repo}/blob/main/CONTRIBUTING.md`}>CONTRIBUTING.md</a> for the field-by-field guide.</p>
  </section>
  <section class="card">
    <h2>2 — The form route</h2>
    <p>Not comfortable with YAML? Open a <a href={`${repo}/issues/new?template=submit-bot.yml`}>"Submit a bot" issue</a> —
    maintainers convert accepted submissions into PRs.</p>
  </section>
  <section class="card">
    <h2>Before you submit</h2>
    <p>Check your bot against the <a href="/practices">Good Bot Practices</a>. Bots without any verification
    path are listed as Tier 3 — visible, but flagged as unverifiable.</p>
  </section>
  <style>
    .head { padding-block: var(--space-5) var(--space-3); max-width: 52rem; }
    .lede { font-size: 1.35rem; color: var(--muted); line-height: 1.5; }
    section { margin-block: var(--space-2); }
    section h2 { font-size: 1.25rem; }
  </style>
</Layout>
```

`site/src/pages/data-docs.astro`:
```astro
---
import Layout from '../layouts/Layout.astro';
import CopyBlock from '../components/CopyBlock.astro';
import { dataset } from '../lib/data';
const endpoints = [
  { path: '/data/all.json', desc: 'The full catalogue: every bot with identity, UA patterns, verification recipes, tier, and resolved IP ranges.' },
  { path: '/data/by-category/<category>.json', desc: 'The same shape, filtered to one category (e.g. ai-crawler.json).' },
  { path: '/data/bots/<id>.json', desc: 'A single bot artifact.' },
  { path: '/data/ips/<id>.ips', desc: 'Plain-text CIDR list for one bot, one range per line (GoodBots-compatible).' },
  { path: '/data/ips/all.ips', desc: 'Union of all verified ranges in the directory.' },
  { path: '/data/ua-patterns.json', desc: 'Just the UA regex patterns, per bot, with categories.' },
];
---
<Layout title="Data & API">
  <header class="head">
    <h1 class="display">Use the data</h1>
    <p class="lede">Everything on this site is also machine-readable — static JSON and plain-text files,
    rebuilt daily from first-party operator feeds, no auth, no rate limits. CC-BY-4.0: use it anywhere, credit this project.</p>
  </header>
  <CopyBlock title="Try it" command="curl -s https://<this-domain>/data/all.json | head -40" />
  <table class="endpoints">
    <thead><tr><th>Path</th><th>What it is</th></tr></thead>
    <tbody>
      {endpoints.map((e) => (
        <tr><td class="mono small">{e.path}</td><td class="small">{e.desc}</td></tr>
      ))}
    </tbody>
  </table>
  <p class="small muted">Dataset generated {dataset.generated_at}. Guardrails: every range passes CIDR sanity checks,
  and a feed that changes suspiciously is held on last-known-good data pending human review.</p>
  <style>
    .head { padding-block: var(--space-5) var(--space-3); max-width: 52rem; }
    .lede { font-size: 1.35rem; color: var(--muted); line-height: 1.5; }
    .endpoints { width: 100%; border-collapse: collapse; margin-block: var(--space-3); }
    .endpoints th { text-align: left; font-size: var(--text-small); color: var(--muted); padding: 0.5rem 0.7rem; }
    .endpoints td { border-top: 1px solid var(--border); padding: 0.7rem; vertical-align: top; }
  </style>
</Layout>
```

`site/src/pages/404.astro`:
```astro
---
import Layout from '../layouts/Layout.astro';
---
<Layout title="Not found">
  <div class="nf">
    <h1 class="display">404</h1>
    <p class="lede">No bot here — verified or otherwise.</p>
    <p><a href="/">Back to the directory →</a></p>
  </div>
  <style>
    .nf { padding-block: var(--space-5); }
    .lede { font-size: 1.35rem; color: var(--muted); }
  </style>
</Layout>
```

- [ ] **Step 3: Build and verify**

Run: `cd site && npm run build && ls dist`
Expected: build clean; `dist/` contains `practices/`, `submit/`, `data-docs/`, `404.html`, plus everything from earlier tasks.

- [ ] **Step 4: Commit**

```bash
git add site/src/pages/practices.astro site/src/pages/submit.astro site/src/pages/data-docs.astro site/src/pages/404.astro
git commit -m "feat(site): practices, submit, data docs, 404 pages"
```

---

### Task 8: Smoke test, CI integration, deploy docs, PR

**Files:**
- Create: `site/scripts/smoke.mjs`
- Modify: `site/package.json` (add `smoke` script), `.github/workflows/verify.yml` (add site job), `README.md` (site + deploy section)

**Interfaces:**
- Consumes: built `site/dist/` (Tasks 1–7); root pipeline scripts.
- Produces: `npm run smoke` inside `site/` (exits 1 with a named missing marker on failure); CI builds the site on every PR; README documents Cloudflare Pages settings.

- [ ] **Step 1: Write the smoke script**

`site/scripts/smoke.mjs`:
```js
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
```

Add to `site/package.json` scripts: `"smoke": "node scripts/smoke.mjs"`.

- [ ] **Step 2: Run the smoke test**

Run: `cd site && npm run build && npm run smoke`
Expected: `smoke: OK`

- [ ] **Step 3: Add the site job to CI**

In `.github/workflows/verify.yml`, add a second job after `verify`:
```yaml
  site:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - name: Build artifacts (exit 2 = LKG-published, fine for the site)
        run: npm run build:artifacts || [ $? -eq 2 ]
      - run: npm --prefix site ci
      - run: npm --prefix site test
      - run: npm --prefix site run build
      - run: npm --prefix site run smoke
```

- [ ] **Step 4: Document deployment in README.md**

Append to `README.md`:
```markdown
## Website

`site/` is an Astro static site rendering this dataset; it also serves the raw
artifacts under `/data/`.

- Local: `npm run build:artifacts` (repo root), then `cd site && npm install && npm run dev`
- Full build: `npm run build:site` (requires `dist/` to exist)

### Deploy (Cloudflare Pages, git integration)

| Setting | Value |
|---|---|
| Build command | `npm ci && (npm run build:artifacts \|\| [ $? -eq 2 ]) && npm --prefix site ci && npm --prefix site run build` |
| Build output directory | `site/dist` |
| Environment variable | `NODE_VERSION=22` |

The daily `build` workflow commits refreshed `dist/` data to main; the Pages
git integration rebuilds the site on that push, so the site republishes daily
without extra config.
```

- [ ] **Step 5: Full verification, push, PR**

```bash
cd /Users/mayank/Documents/projects/verifiedbots
npm --prefix site test && npm --prefix site run build && npm --prefix site run smoke
git add site/scripts/smoke.mjs site/package.json .github/workflows/verify.yml README.md
git commit -m "feat(site): smoke test, CI site job, Cloudflare Pages deploy docs"
git push -u origin site
gh pr create --repo mayankguptadotcom/verifiedbots --base data-platform --title "Directory site: Astro app-shell, bot pages, practices, data docs" --body "Implements Plan 2 (docs/plans/2026-07-08-directory-site.md): Astro 5 site with View Transitions, typography-led design system, dark/light themes, instant filter, per-bot verify recipes + scorecards, /data/ artifact serving, smoke-tested in CI. Based on data-platform (PR #2); retarget to main after #2 merges."
gh pr checks --repo mayankguptadotcom/verifiedbots --watch
```
Expected: both `verify` and `site` jobs green. Do NOT merge — maintainer's call.

---

## Follow-up (not in this plan)

- **Plan 3 — full curation to ~100–150 bots** (+ `web_bot_auth` CI check).
- Cloudflare Pages project creation is a dashboard action only the maintainer can do (connect repo, paste the settings table above, set the custom domain once registered).
- Domain: `BRANDING.domain` stays `null` until registered; when set, add `site: 'https://<domain>'` to `astro.config.mjs` for canonical URLs and update the data-docs curl example.
