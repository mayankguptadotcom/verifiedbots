# Candidate ledger

A running record of bot candidates we have **considered** — added, rejected, or
deferred — so that recurring research sessions don't re-investigate settled
cases from scratch. This is a working log, **not** a source of truth for bot
data (the YAML in `bots/` is that). CLAUDE.md's inclusion gate and iron rules
still decide every entry.

**How to use it (research sessions):**

1. Before researching arcjet candidates, read this file. Skip anything marked
   `rejected` unless its reason was "not sourced this session" *and* you intend
   to source it now, or enough time has passed that the operator may have
   published new docs.
2. `deferred` rows are the best place to spend a run — they were plausible but
   not fully sourced. Promote to `added` or `rejected` as you learn more.
3. When you add or reject a candidate, update its row here in the same commit.
4. `status` values: `added` (now in `bots/`), `rejected` (fails the gate for a
   durable reason), `deferred` (plausible; not yet sourced or vetted).
5. Keep `last-reviewed` as an absolute date (YYYY-MM-DD).

Candidate ids below follow arcjet/well-known-bots ids where applicable.

## Ledger

| Candidate (arcjet id) | Operator | Status | Tier | Reason / notes | Last reviewed |
|---|---|---|---|---|---|
| sentry-uptime-monitor | Sentry | added (`sentry-uptime`) | 1 | UA `SentryUptimeBot/1.0` + live IP feed `https://sentry.io/api/0/uptime-ips/` (text_lines). Sourced from Sentry docs + arcjet; feed verified live. | 2026-07-13 |
| algolia-crawler | Algolia | added (`algolia-crawler`) | 2 | UA `Algolia Crawler/x.x.x`; documented static egress IP `34.66.202.43`. Respects robots.txt (token `Algolia Crawler`). Sourced from arcjet + Algolia docs. | 2026-07-13 |
| cloudflare-prefetch | Cloudflare | deferred | — | arcjet marks `cidr`, but no Cloudflare doc found this session tying the UA `CloudFlare-Prefetch` to a published IP list. Not disproven — needs a Cloudflare source. | 2026-07-13 |
| cloudflare-ssl-detector | Cloudflare | deferred | — | Same as above for UA `Cloudflare-SSLDetector`. Cloudflare publishes its IP ranges (`https://www.cloudflare.com/ips-v4`) but not clearly scoped to this bot. | 2026-07-13 |
| cloudflare-traffic-manager | Cloudflare | deferred | — | Same as above for UA `Cloudflare-Traffic-Manager`. | 2026-07-13 |
| cloudflare-security-center | Cloudflare | deferred | — | arcjet pattern is a URL, not a clean UA token; needs a Cloudflare doc to source a real UA + IPs before listing. | 2026-07-13 |
| quantcast-crawler | Quantcast | deferred | — | UA `Quantcastbot/`; arcjet `ip` verification. Did not reach official Quantcast bot docs this session to source UA + IPs. | 2026-07-13 |
| adagio-crawler | Adagio | deferred | — | UA `Adagiobot/`; arcjet `ip`. No operator doc fetched this session. | 2026-07-13 |
| hydrozen-monitor | Hydrozen.io | deferred | — | UA `Hydrozen.io/`; arcjet `cidr`. Small operator; needs a docs page + live feed check before listing. | 2026-07-13 |
| cookiehub-scan | CookieHub | deferred | — | UA `CookieHubScan`; arcjet `ip`. Consent-scanner tool; needs operator doc for UA + IPs. | 2026-07-13 |
| geedo-crawler-products | Geedo | deferred | — | UA `GeedoProductSearch`; arcjet `cidr,dns`. Operator identity/legitimacy unverified this session. | 2026-07-13 |
| sentry-crawler | Sentry | rejected | — | Non-uptime `sentry/` UA token is generic/non-distinctive — fails the "distinctive User-Agent" gate. Distinct from the added `sentry-uptime`. | 2026-07-13 |

## Already listed (for reference)

Many arcjet "verifiable" entries are already in `bots/`: censys, pingdom,
checkly, betterstack-uptime, oncrawl, statuscake, site24x7, hetrixtools,
updown-io, uptimerobot, datadog-synthetics, grafana-synthetic-monitoring,
cloudflare-healthchecks, amazon (amazonbot), apple (applebot), the Google and
Bing crawler families, the OpenAI/Anthropic/Perplexity/Meta families, and the
Stripe/Adyen/PayPal/Svix/Twilio webhook senders. Check `bots/` before treating
an arcjet id as new.
