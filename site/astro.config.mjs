import { defineConfig } from 'astro/config';

export default defineConfig({
  // data.ts imports ../dist/all.json and ../src/branding.ts from the repo root
  vite: { server: { fs: { allow: ['..'] } } },
});
