# Verified Bots Directory

The open, categorized directory of verified good bots — identities, user
agents, IP ranges, and machine-actionable verification recipes — at
[verifiedbots.dev](https://verifiedbots.dev).

## Why

No canonical open source project joins bot identity (who operates this
thing, what category is it) with both UA patterns *and* authoritative
verification data. Bot directories tend to withhold IP ranges; IP-range
lists tend to lack identity and category context. This repo is that join,
done in the open, refreshed daily, with the provenance to back it up.

## What's here

- `bots/*.yaml` — one curated entry per bot (schema:
  `src/schema/bot.schema.json`), covering identity, category, behavior, and
  verification recipes.
- `dist/` — built artifacts, also served live from verifiedbots.dev under
  `/data/` (see "Use the data" below).
- Verification tiers: **1 — fully verifiable** (machine-readable IP feed or
  Web Bot Auth), **2 — verifiable** (rDNS / ASN / static ranges), **3 —
  listed only** (identity known, no verification recipe published yet).
- `PRACTICES.md` — the Good Bot Practices standard every entry is measured
  against.
- Daily refresh pipeline with poisoned-feed guardrails: CIDR sanity checks,
  a diff alarm on large swings, and automatic fallback to the last-known-good
  feed if a source looks wrong.

## Use the data

All artifacts are served live and CC-BY-4.0 licensed:

- `https://verifiedbots.dev/data/all.json` — the full dataset
- `https://verifiedbots.dev/data/by-category/<category>.json` — one category
- `https://verifiedbots.dev/data/by-tier/tier-<n>.json` — one verification
  tier (1 fully verifiable, 2 verifiable, 3 listed only)
- `https://verifiedbots.dev/data/bots/<id>.json` — one bot
- `https://verifiedbots.dev/data/ips/<id>.ips` — one bot's IP ranges
- `https://verifiedbots.dev/data/ips/by-category/<category>.ips` — one
  category's verified IP ranges
- `https://verifiedbots.dev/data/ips/by-tier/tier-<n>.ips` — one tier's
  verified IP ranges
- `https://verifiedbots.dev/data/ips/all.ips` — every verified IP range
- `https://verifiedbots.dev/data/ua-patterns.json` — user-agent match
  patterns for every bot
- `https://verifiedbots.dev/rss.xml` — RSS feed of newly added bots

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add or update a bot entry,
and [PRACTICES.md](PRACTICES.md) for the standard entries are measured
against.

## Development

`npm test`, `npm run validate`, and `npm run build:artifacts` cover the data
pipeline; see [CONTRIBUTING.md](CONTRIBUTING.md) for the full local setup
(including the `site/` Astro app). Deploy/ops notes live in
`docs/DEPLOY.md`.

## Roadmap (rough)

- Grow the directory toward 100–150+ verified bots across all categories.
- Web Bot Auth verification checks for submitted key directories.
- Active verification: a challenge endpoint that proves bot ownership at
  submission time, rather than trusting a claimed feed alone.
- A lookup API — "is this UA + IP a verified bot?" — for site owners who
  don't want to embed the full dataset.
- An annual state-of-the-good-bots report.

## License

Code: MIT (`LICENSE`). Data (`bots/`, `dist/`): CC-BY-4.0 (`LICENSE-DATA.md`).
