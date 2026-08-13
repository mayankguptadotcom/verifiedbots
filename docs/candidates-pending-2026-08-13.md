# Pending ledger fragment — 2026-08-13 (blocked run)

**Merge these rows into `docs/candidates.md`, then delete this file.**

This exists only because the 2026-08-13 research session could not write to
`docs/candidates.md` on the remote. Git push and the GitHub REST API were both
refused in that environment ("GitHub access is not enabled for this session. An
org admin must connect the Claude GitHub App for this organization."), and the
one available write path — the GitHub MCP server — requires whole-file content,
which the 138 KB ledger exceeds. Pushing it would have risked a truncated,
corrupted ledger, so the run pushed this fragment instead. The same edits were
committed locally as `docs(candidates): record egress-blocked run; screen
arcjet id diff`; that commit was lost with the container.

## Why the run found nothing

**The environment was the blocker, not the sources.** Per the network
precondition, egress was tested before any research:
`raw.githubusercontent.com` served arcjet's `well-known-bots.json` fine (200,
351 KB), but every other host was refused by the agent proxy *before* TLS —
`www.semrush.com`, `www.cloudflare.com`, `developers.google.com`, `ahrefs.com`,
`platform.openai.com` and even `example.com` all returned `connect_rejected`,
"gateway answered 403 to CONNECT". `npm run fetch-feeds` confirmed the same
blanket block: 60 of 63 recipes held on HTTP 403, only the github.com- and
datadoghq-hosted ones resolved.

So **no bots were added and no tier re-check was possible** — no operator
documentation page was reachable, and the iron rules forbid filling fields from
memory or third-party directories. Existing data was confirmed healthy offline:
`npm run validate` → `OK: 227 bots valid`, `npm test` → 61/61 green,
`build:artifacts` rebuilt clean off last-known-good (timestamp-only diff, no
range lost).

**No recipe was changed or removed**, since a proxy-level 403 is not evidence
about the origin. In particular the `site24x7` flaky-origin note in "Tier
upgrade re-checks" could not be advanced — its 403 this run says nothing about
whether the zero-byte body recovered.

Also worth recording: **this repo has no `CLAUDE.md`, and never has** (no such
path in git history), though the scheduled prompt instructs the session to read
it first. The run followed `PRACTICES.md`, `CONTRIBUTING.md` and the ledger's
own rules instead. Either add a `CLAUDE.md` or drop the reference from the
scheduled prompt.

## Rows to add to the `## Ledger` table

| Candidate (arcjet id) | Operator | Status | Tier | Reason / notes | Last reviewed |
|---|---|---|---|---|---|
| datanyze-crawler / seozoom-crawler / coccoc-crawler / itinfluentials-crawler / seewithkids-crawler / whatsapp-crawler | Datanyze; SEOZoom; Cốc Cốc; IT Influentials; SeeWithKids; WhatsApp (Meta) | deferred | — | Fresh from an arcjet id diff run against this ledger and `bots/` (arcjet was the one reachable host on 2026-08-13). These are the ids never previously considered here whose arcjet `url` is a **dedicated bot page** rather than an operator homepage, so they are the best-value targets for the next unblocked run: `datanyze.com/dnyzbot/`, `suite.seozoom.it/bot.html`, `search.it-influentials.com/bot.htm`, `seewithkids.com/bot`, `help.coccoc.vn/` (Cốc Cốc is Vietnam's own search engine — a real operator). Not sourced this run: every one of those hosts is behind the egress block, and arcjet alone cannot supply purpose, robots policy or verification data. Two carry a UA caveat to weigh at the gate — Datanyze's recorded instance is a plain Chrome 65 string with only `Datanyze` in the platform field, and `whatsapp-crawler`'s is the bare token `WhatsApp` with no info URL. arcjet publishes no verification block for any of the six, so expect Tier 3 at best. | 2026-08-13 |
| python-httpx / python-aiohttp / php-simplepie / ttrss-feedfetcher / freshrss-feedfetcher | — (software, not a service operator) | rejected | — | Same durable gate failure already recorded for `zgrab`: these are HTTP client libraries and self-hosted feed readers, whose UA identifies the *software* (`python-httpx/0.16.1`, `Python/3.9 aiohttp/3.7.3`, `SimplePie/1.3-dev`, `Tiny Tiny RSS/1.15.3`, `FreshRSS/1.11.2 … like Googlebot`) and not any operator who could be held to a robots policy or publish verification data. Every deployment is run by a different end user, so there is nobody to attribute the traffic to — gate 1 and gate 4 both fail regardless of what the docs say. Screened from arcjet metadata alone, which is sufficient for this class; no live fetch needed or possible this run. | 2026-08-13 |

## Row to add to the `## Tier upgrade re-checks` table

| Bot | Result | Notes | Last reviewed |
|---|---|---|---|
| *(all)* | none possible this run | 2026-08-13: no tier re-check was attempted. Every operator documentation host is refused by this environment's egress proxy, so there was nothing to re-read. No recipe was changed or removed on the strength of a proxy-level 403, per the fetch-feeds judgment rule. | 2026-08-13 |

## Section to add after the ledger intro

```markdown
## Blocked / degraded runs

Runs that could not do research because the environment, not the sources, was
the blocker. Recorded so a future run does not read a thin ledger update as
"nothing was out there".

| Date | What happened |
|---|---|
| 2026-08-13 | **Egress-allowlisted environment — research abandoned per the network precondition.** See `docs/candidates-pending-2026-08-13.md` for the full account: only `raw.githubusercontent.com` was reachable; 60 of 63 feed recipes held on proxy 403s; validate (227 bots) and tests (61/61) green offline; no bots added, no tier re-check possible. |
```

## Arcjet diff, for the record

The diff was run in full since arcjet was reachable: 635 arcjet ids, 229 not
mentioned anywhere in the ledger. Almost all of those 229 are naming variants
of bots already in `bots/` (`google-crawler`, `openai-crawler`,
`perplexity-crawler`, `apple-crawler`, `bing-crawler`, …). After excluding ids
whose operator domain already appears in `bots/`, and ids with no docs URL or
only a GitHub/StackOverflow link, 36 remained; of those, the six with a
dedicated bot page are the deferred row above and the five software UAs are the
rejected row. The rest cite only an operator homepage and are not worth a row
until someone finds a bot page for them.
