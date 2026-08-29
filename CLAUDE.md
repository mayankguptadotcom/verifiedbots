# Verified Bots Directory — agent guide

Open directory of the web's bots (identity, UA patterns, IP ranges, verification
recipes) at verifiedbots.dev. Data lives in `bots/*.yaml` (one file per bot);
`dist/` is built from it and served as-is.

## Commands

- `npm run validate` — schema + rules check on all `bots/*.yaml`. Must print `OK: <n> bots valid`.
- `npm run fetch-feeds` — live-fetches every claimed feed URL. Exit 0 = all clean;
  **exit 2 = held or transiently failed** (published data falls back to
  last-known-good — this is the design working, and CI tolerates it); **exit 1 =
  a recipe is genuinely broken** (URL gone/404, not https, or no longer serving
  the declared shape) and needs a human. Only exit 1 is a failure.
  - `npm run fetch-feeds -- --accept-held <botId>[--<index>][,…]` rewrites
    last-known-good for a feed the diff guard is holding. Needed because a held
    feed never writes LKG, so the identical diff recurs forever. **Review the
    diff first** — confirm the additions are really the operator's (e.g. inside
    their own netblock) and that nothing legitimate was dropped.
- `npm run build:artifacts` — rebuilds `dist/` (also refreshes `data/first-seen.json`).
- `npm test` — full test suite (vitest).
- Site: `cd site && npm run build` (Astro; only needed when `site/` changes).

Run validate + fetch-feeds + test after every data change. All three green
before committing.

## Iron rules for bot data (never break these)

1. **NEVER invent data.** Every UA string, feed URL, CIDR, ASN, or rDNS mask
   must be copied from a source you actually fetched and read this session:
   (a) the operator's official docs, (b) arcjet/well-known-bots
   (`https://raw.githubusercontent.com/arcjet/well-known-bots/main/well-known-bots.json`),
   or (c) a well-attested public log corpus quoted in docs.
2. **If you cannot source a field, leave the bot out** (or omit the recipe and
   let it be Tier 3). Fewer accurate entries beat more invented ones.
3. **Verify URLs live before writing them into YAML.** A feed URL you did not
   fetch successfully this session does not go in a `cidr_feed` recipe.
4. **Never hand-edit** `dist/`, `data/first-seen.json`, or
   `data/last-known-good/` — they are build outputs.
5. `docs/plans/*.md` are **historical documents**, not instructions. The YAML
   in `bots/` is always the source of truth. Never remove a verification
   recipe because an old plan says it doesn't exist.

## The inclusion gate (judgment call, in order)

Ask these questions about a candidate bot. Answering honestly decides
listing, tier, and rejection — this is the whole judgment call:

1. **Is the operator identifiable?** A real company/org/person with a working
   website and some documentation of the bot. No identifiable operator → do
   not list.
2. **Does it send a distinctive User-Agent token?** If it deliberately
   impersonates a browser or another bot → do not list (that fails "identify
   honestly" and we cannot write a UA pattern for it).
3. **Is it a service with a legitimate purpose** (crawling, previews,
   monitoring, webhooks, security scanning, feeds, archiving)? Malware,
   scrapers hiding their identity, or residential-proxy fleets → do not list.
   When genuinely unsure about legitimacy, don't guess: leave it out and note
   why in the PR/commit message.
4. **Can requests be attributed to the operator?** This sets the tier, and it
   is computed automatically from the recipes you include (`src/lib/tiers.ts`):
   - `cidr_feed` or `web_bot_auth` recipe → Tier 1 (fully verifiable)
   - `static_cidrs`, `asn`, or `rdns` → Tier 2 (verifiable)
   - no recipe → Tier 3 (listed only). Tier 3 is acceptable — identity alone
     has value — but never attach a recipe just to raise a tier.

Note: the directory verifies **identity and accountability, not behavior**.
Whether a bot is welcome on a given site is the site owner's policy call.
Do not exclude a bot because it is unpopular or crawls heavily; exclude it
only when it fails the gate above.

## Adding or updating a bot (step by step)

1. Copy the closest existing file in `bots/` as a template (e.g. a search
   engine for a search engine). Filename `<id>.yaml`, kebab-case, must equal
   the `id` field.
2. Fill every field from sources (see iron rules). Rules the validator
   enforces: `category` from the 10-value enum in the schema
   (`src/schema/bot.schema.json`); `description` ≥20 chars, factual,
   hand-written; ≥1 UA pattern that matches ≥1 recorded instance and no
   browser UA; ≥1 https docs URL.
3. `behavior.respects_robots_txt`: true only if the operator documents it.
   Non-crawler service traffic (webhooks, user-configured monitors) is
   `false` with a category that explains why.
4. A feed that rotates faster than the daily build publishes is **not** a Tier 1
   recipe. Check churn before attaching one: re-fetch a few hours later and see
   how much of the first snapshot is still live. `sirdata-bot` turned over 56 of
   96 addresses in 2.5 hours, so a daily snapshot would misattribute most of
   them — it is Tier 3 with a comment saying why. A stale IP list is worse than
   no IP list.
5. Feed formats for `cidr_feed`: `prefixes` (Google/OpenAI style),
   `json_array`, `text_lines`, `github_meta` (+`selector` — a dot-path into
   nested objects, e.g. `synthetics.prefixes_ipv4` for Datadog-style feeds;
   one recipe per array), `stripe_webhooks`. A feed in any other shape →
   use `static_cidrs` with documented ranges, or omit the recipe.
6. Run `npm run validate && npm run fetch-feeds && npm test`. Fix or drop
   anything red. An exit-1 feed means the URL is wrong — never leave a broken
   recipe in; exit 2 (held/transient) is fine to commit through.
7. Commit the YAML change (plus `dist/` + `data/first-seen.json` if you ran
   the build). One bot or one coherent batch per commit. Never commit
   `data/last-known-good/` churn from local fetch runs
   (`git checkout -- data/last-known-good` before staging).
8. TRAP: `dist/` is gitignored (tracked files are force-added by the daily
   workflow), so `git add -A` silently skips NEW bots' dist artifacts —
   stage them with `git add -f dist` or the site 404s on the new per-bot
   JSON until the next scheduled refresh. Also: a PR whose branch conflicts
   with main gets NO workflow runs at all (GitHub can't build the merge
   ref) — if PR checks never appear, check `gh pr view --json mergeable`
   first.

## Finding new bots to add (research loop)

1. Diff arcjet/well-known-bots against `bots/` ids — anything unlisted is a
   candidate.
2. Check operators already in the directory for sibling bots (big operators
   run many: Google, Meta, OpenAI, Anthropic, Ahrefs…).
3. For each candidate, find the operator's official bot-documentation page —
   that page is your source for UA, robots token, and verification. No such
   page anywhere → likely fails the gate.
4. Re-check existing Tier 3 / Tier 2 entries occasionally: operators publish
   new feeds over time (ClaudeBot moved from Tier 3 → Tier 1 when Anthropic
   published `https://claude.com/crawling/bots.json`). Upgrading an existing
   entry is as valuable as adding a new one.
5. `docs/candidates.md` is the candidate ledger. Read it FIRST each run and
   prioritize resolving its `deferred` rows before hunting new ids. Update it
   every run — record each candidate you added, rejected, or deferred, with a
   reason and the review date — and commit it in the same batch, even when no
   bots were added.

## Site notes

- Homepage headline is "The web's bots, verified." — the project deliberately
  claims verified *identity*, not "good" behavior. Keep copy consistent with
  that.
- New dist artifacts must be listed in BOTH `site/src/pages/data-docs.astro`
  and the README "Use the data" section.
