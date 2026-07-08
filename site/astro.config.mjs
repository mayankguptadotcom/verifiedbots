import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://verifiedbots.dev',
  integrations: [sitemap()],
  // data.ts imports ../dist/all.json and ../src/branding.ts from the repo root
  vite: { server: { fs: { allow: ['..'] } } },
});
