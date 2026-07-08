# Deploy notes (internal)

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
| Environment variable | `NODE_VERSION=24` |

Custom domain: verifiedbots.dev (set in the Pages dashboard → Custom domains).

The daily `build` workflow commits refreshed `dist/` data to main; the Pages
git integration rebuilds the site on that push, so the site republishes daily
without extra config.
