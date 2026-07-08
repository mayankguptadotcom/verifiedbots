### Task 1: Repo scaffolding + branding constant

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/branding.ts`, `tests/branding.test.ts`

**Interfaces:**
- Produces: `BRANDING` const `{ projectName: string; domain: string | null; byline: string; nonAffiliation: string }` imported by later tasks (artifacts embed it; site consumes it in Plan 2).

- [ ] **Step 1: Create branch and scaffold config files**

```bash
cd /Users/mayank/Documents/projects/verifiedbots && git checkout -b data-platform
```

`package.json`:
```json
{
  "name": "verifiedbots-data",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "vitest run",
    "validate": "tsx src/cli/validate.ts",
    "fetch-feeds": "tsx src/cli/fetch-feeds.ts",
    "build:artifacts": "tsx src/cli/build.ts"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "ajv": "^8.17.0",
    "ajv-formats": "^3.0.1",
    "ipaddr.js": "^2.2.0",
    "yaml": "^2.6.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
```

`.gitignore`:
```
node_modules/
dist/
```

- [ ] **Step 2: Write the failing test**

`tests/branding.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { BRANDING } from '../src/branding.js';

describe('branding', () => {
  it('exposes a single branding constant with required fields', () => {
    expect(BRANDING.projectName.length).toBeGreaterThan(0);
    expect(BRANDING.byline).toContain('Cerberus');
    expect(BRANDING.nonAffiliation.toLowerCase()).toContain('cloudflare');
    expect(BRANDING.domain).toBeNull(); // undecided — set at launch
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm install && npx vitest run tests/branding.test.ts`
Expected: FAIL — `Cannot find module '../src/branding.js'`

- [ ] **Step 4: Write minimal implementation**

`src/branding.ts`:
```ts
/** The ONLY place project naming/branding lives. Domain is null until registered. */
export const BRANDING = {
  projectName: 'Verified Bots Directory',
  domain: null as string | null,
  byline: 'by Cerberus',
  nonAffiliation:
    'An independent open project. Not affiliated with Cloudflare or its Verified Bots program.',
} as const;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/branding.test.ts`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold TypeScript project with branding constant"
```

---

