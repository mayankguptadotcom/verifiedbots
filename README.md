# Verified Bots Directory

The open, categorized directory of good bots — identities, user agents,
IP ranges, and machine-actionable verification recipes.

> Status: pre-launch, private. Data + pipeline are being built; site follows.
> An independent open project. Not affiliated with Cloudflare or its
> Verified Bots program.

## What's here
- `bots/*.yaml` — one curated file per bot (schema: `src/schema/bot.schema.json`)
- `dist/` — built artifacts: `all.json`, `by-category/*.json`, `bots/*.json`,
  `ips/*.ips` (GoodBots-compatible), `ua-patterns.json`
- `PRACTICES.md` — the Good Bot Practices standard
- Verification tiers: 1 = fully verifiable (IP feed / Web Bot Auth),
  2 = verifiable (rDNS / ASN / static ranges), 3 = listed only

## Commands
- `npm test` — unit tests
- `npm run validate` — validate all bot files
- `npm run fetch-feeds` — refresh IP ranges from first-party feeds (guarded:
  poisoned or wildly-changed feeds fall back to last-known-good)
- `npm run build:artifacts` — build `dist/`

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

## Licensing
Code: MIT (`LICENSE`). Data (`bots/`, `dist/`): CC-BY-4.0 (`LICENSE-DATA.md`).
