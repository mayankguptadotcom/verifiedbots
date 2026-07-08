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

## Licensing
Code: MIT (`LICENSE`). Data (`bots/`, `dist/`): CC-BY-4.0 (`LICENSE-DATA.md`).
