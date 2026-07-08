# Good Bot Practices

The standard this directory measures every bot against. Each practice maps to
a field in the bot schema, so every directory entry doubles as a conformance
scorecard.

## 1. Identify honestly (`user_agents`)
Send a stable User-Agent token: product name, version, and an info URL.
Example: `ExampleBot/2.1 (+https://example.com/bot)`.

## 2. Be verifiable (`verification`) — at least one of:
- **Machine-readable IP ranges** at a stable HTTPS URL (JSON preferred; the
  Google/OpenAI `{"prefixes":[{"ipv4Prefix":...}]}` shape is the de-facto
  standard) → `cidr_feed`
- **Forward/reverse DNS** on a domain you control → `rdns`
- **Web Bot Auth** (IETF HTTP Message Signatures): sign requests and host a
  key directory at `/.well-known/http-message-signatures-directory` →
  `web_bot_auth`. Implement with Cloudflare's Apache-2.0 libraries
  (github.com/cloudflare/web-bot-auth); self-test at Fingerprint's free
  endpoint (fingerprint.com/web-bot-auth/test/) before submitting.

## 3. Respect robots.txt (`behavior.respects_robots_txt`)
Honor robots.txt and document your token (`behavior.robots_token`).
Service traffic that isn't a crawler (webhooks, monitors you configured)
is exempt by nature — declared as `respects_robots_txt: false` with a
category that explains why.

## 4. Behave (`behavior`)
Sane request rates. Back off on 429/503. Honor cache headers.

## 5. Be reachable (`operator`, `docs`)
Publish operator identity, documentation, and a contact channel for site
owners.
