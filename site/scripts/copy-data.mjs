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
