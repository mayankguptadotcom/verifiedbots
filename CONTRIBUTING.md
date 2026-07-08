# Contributing

## Adding a bot
1. Copy an existing file in `bots/` as a template; name it `<id>.yaml`
   (lowercase, hyphens; must equal the `id` field).
2. Fill every field. At least one `verification` recipe is strongly
   preferred — bots without one are listed as Tier 3.
3. `npm run validate` must pass locally.
4. Open a PR. CI re-validates and live-fetches any claimed feed URLs, then
   posts results. A maintainer reviews for legitimacy (CI proves the data is
   valid, not that you operate the bot) and merges.

Non-technical submissions: open a "Submit a bot" issue instead.
