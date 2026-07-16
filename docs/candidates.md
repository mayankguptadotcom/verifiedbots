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
| algolia-crawler | Algolia | added (`algolia-crawler`) | 2 | UA `Algolia Crawler/x.x.x`; static egress IP `34.66.202.43`. Respects robots.txt. | 2026-07-13 |
| bnf-crawler | — | added (`bnf-crawler`) | 3 | Bibliothèque nationale de France legal-deposit web archiver; live official docs, distinctive bnf.fr_bot UA, legally disregards robots.txt. Tier 3, no  | 2026-07-14 |
| cloudflare-ssl-detector | — | added (`cloudflare-ssl-detector`) | 3 | Cloudflare officially documents the Cloudflare-SSLDetector UA (SSL/TLS Recommender) on its site-crawling reference; it fetches origins over HTTP/HTTPS | 2026-07-14 |
| cloudflare-traffic-manager | — | added (`cloudflare-traffic-manager`) | 3 | Cloudflare officially documents the Cloudflare-Traffic-Manager/1.0 UA (load-balancing monitor) on its site-crawling reference. Like existing cloudflar | 2026-07-14 |
| cookiehub-scan | — | added (`cookiehub-scan`) | 1 | CookieHub identifiable; docs (cookie-scanner + FAQ) document the compliance scanner and an official live scanner-IP endpoint. UA CookieHubScan sourced | 2026-07-14 |
| deadlinkchecker | — | added (`deadlinkchecker`) | 2 | Hosted broken-link scanning service by DLC Websites; operator FAQ documents a distinctive UA token (www.deadlinkchecker.com), robots.txt support (disa | 2026-07-14 |
| geedo-crawler-products | — | added (`geedo-crawler-products`) | 1 | Geedo product-search engine, identifiable operator, official docs with UA + IP feed + rDNS. cidr_feed live-verified 200. Docs current UA is GeedoShopP | 2026-07-14 |
| google-crawler-store | — | added (`google-crawler-store`) | 1 | Distinct Google UA token (Storebot-Google) documented; common-crawlers IP feed live (200, prefixes shape). Tier 1. | 2026-07-14 |
| google-feedfetcher | — | added (`google-feedfetcher`) | 1 | Distinct Google UA token (Feedfetcher-Google) documented by Google; user-triggered-fetchers IP feed live (200, prefixes shape). Tier 1. | 2026-07-14 |
| google-inspection-tool | Google | added (`google-inspection-tool`) | 1 | UA `Google-InspectionTool/1.0`; cidr_feed common-crawlers.json + rdns. | 2026-07-14 |
| google-push-notifications | — | added (`google-push-notifications`) | 1 | Distinct Google UA token (APIs-Google) documented for push-notification delivery; special-crawlers IP feed live (200, prefixes shape). Tier 1. | 2026-07-14 |
| haosou-crawler | — | added (`haosou-crawler`) | 3 | Official 360 Search help page (so.com) is live and documents 360Spider + robots.txt support; legitimate search engine, honest 360Spider token in UA. T | 2026-07-14 |
| hydrozen-monitor | — | added (`hydrozen-monitor`) | 1 | Hydrozen.io uptime/monitoring service with official UA and IP-list docs; cidr_feed live-verified 200 in prefixes shape. Tier 1. | 2026-07-14 |
| linkdex-crawler | — | added (`linkdex-crawler`) | 3 | Linkdex (now operated by Authoritas/Analytics SEO Ltd) is an identifiable active operator documenting linkdexbot and robots.txt compliance at a live b | 2026-07-14 |
| livelap-crawler | — | added (`livelap-crawler`) | 3 | Operator Livelap is identifiable with a live docs page (site.livelap.com/crawler) describing LivelapBot, a distinctive-UA content-discovery/preview cr | 2026-07-14 |
| megaindex-crawler | — | added (`megaindex-crawler`) | 3 | Real SEO operator (MegaIndex) with a live bot-documentation page at megaindex.com/crawler, distinctive UA token MegaIndex.ru, documents robots.txt sup | 2026-07-14 |
| microsoft-preview | — | added (`microsoft-preview`) | 1 | MicrosoftPreview is a Microsoft link-preview fetcher documented on Bing's crawlers page (aka.ms/MicrosoftPreview redirects there); distinct from bingb | 2026-07-14 |
| openindex-crawler | — | added (`openindex-crawler`) | 3 | Openindex operates a documented search-R&D crawler; live 'About our spider' page gives the OpenindexSpider UA, robots.txt support and token. No publis | 2026-07-14 |
| proximic-crawler | — | added (`proximic-crawler`) | 3 | Comscore's Proximic contextual crawler is fully documented at proximic.com/info/spider.php (identifies itself, honors robots.txt, token 'proximic'). D | 2026-07-14 |
| quantcast-crawler | — | added (`quantcast-crawler`) | 2 | Operator Quantcast identifiable with a bot doc page (quantcast.com/bot) documenting UA Quantcastbot and 7 fixed IPs; legitimate advertising content cr | 2026-07-14 |
| semanticscholar-crawler | — | added (`semanticscholar-crawler`) | 3 | Operated by Allen Institute for AI (Ai2) with a live crawler-documentation page and distinctive SemanticScholarBot UA; respects robots.txt. Distinct b | 2026-07-14 |
| sogou-crawler | — | added (`sogou-crawler`) | 3 | Sogou (major Chinese search engine, Tencent) is identifiable with a live webmaster docs page that documents robots.txt support; distinctive UA token.  | 2026-07-14 |
| stripe-crawler | Stripe | added (`stripe-crawler`) | 2 | UA `Stripebot/1.0`; rdns `*.crawl.stripe.com`. Distinct from stripe-webhooks. | 2026-07-14 |
| turnitin-crawler | — | added (`turnitin-crawler`) | 3 | Turnitin is an active, identifiable operator with a documented crawler (crawlerinfo.html) that respects robots.txt; no verification feed, so Tier 3. | 2026-07-14 |
| xovibot-crawler | — | added (`xovibot-crawler`) | 3 | XOVI GmbH SEO analytics crawler with a live bot-documentation page (xovibot.net) that explicitly documents robots.txt support and a XoviBot token; dis | 2026-07-14 |
| yahoo-crawler | — | added (`yahoo-crawler`) | 3 | Yahoo Slurp is Yahoo Search's crawler with live official docs (help.yahoo.com/kb/SLN22600.html), robots token 'Slurp', obeys robots.txt; no published  | 2026-07-14 |
| yandex-crawler-javascript | — | added (`yandex-crawler-javascript`) | 2 | Distinct documented Yandex robot (loads JS/CSS resources for rendering); yandexbot exists but this is a separate bot. Verified via Yandex rDNS to yand | 2026-07-14 |
| adagio-crawler | — | deferred | — | Operator (Onfocus SAS / Adagio) is real, but the candidate docs URL 404s and no live official Adagiobot doc page found (adagio.io/bot is a soft-404 SP | 2026-07-14 |
| avira-crawler | — | deferred | — | Avira is a legitimate, active operator and SafeSearch (search.avira.com) is live with a distinctive 'SafeSearch microdata crawler' UA, but the only bo | 2026-07-14 |
| cloudflare-prefetch | — | deferred | — | Legitimate and documented (CloudFlare-Prefetch/0.1 on Cloudflare's site-crawling reference), but no category in the enum fits an edge prefetch/perform | 2026-07-14 |
| facebook-catalog | — | deferred | — | Meta's official web-crawlers doc lists facebookexternalhit/meta-externalagent/etc. but NOT facebookcatalog; UA comes only from arcjet, no operator doc | 2026-07-14 |
| goo-crawler | — | deferred | — | Legit NTT Docomo/goo 'ichiro' search crawler with distinctive UA, but help.goo.ne.jp is DNS-unreachable from this environment so I could not confirm t | 2026-07-14 |
| google-ads-conversions | — | deferred | — | Google-Ads-Conversions is not documented in any official Google crawler page (overview-google-crawlers, common-crawlers, or special-case-crawlers); th | 2026-07-14 |
| linguee-crawler | — | deferred | — | Operator identifiable (Linguee, owned by DeepL) but official bot page linguee.com/bot now 404s; only third-party aggregators document it, so no live s | 2026-07-14 |
| ltx71-crawler | — | deferred | — | Site loads but discloses no identifiable operator/company; self-described 'security research' internet scanner with opaque ownership — legitimacy genu | 2026-07-14 |
| similartech-crawler | — | deferred | — | Legitimate operator (SimilarTech/Similarweb) and distinctive SMTBot UA, but documented docs page similartech.com/smtbot now 404s (www is NXDOMAIN) and | 2026-07-14 |
| tiscali-crawler | — | deferred | — | IstellaBot is a real Tiscali/Istella search crawler with a distinctive UA, but no official bot-documentation page could be sourced (arcjet URL is only | 2026-07-14 |
| yahoo-crawler-japan | — | deferred | — | Operator (Yahoo! JAPAN / LY Corp) is identifiable but the provided docs URL 404s and the current Yahoo Japan user-agent articles are login-gated / JS- | 2026-07-14 |
| yamanalab-crawler | — | deferred | — | Waseda Yamana Lab crawler is plausibly a legitimate academic crawler, but both EN and JP doc pages are image-only (no readable text to source UA/purpo | 2026-07-14 |
| a6corp-crawler | — | rejected | — | a6corp.com web-scraping-policy page is dead (domain now an unrelated health/vitamins site); operator no longer identifiable. | 2026-07-14 |
| aboundex-crawler | — | rejected | — | Site dead: aboundex.com/crawler/ connection refused on 443; only appears in historical UA-parser archives, no current operator or docs. Fails gate #1. | 2026-07-14 |
| acoon-crawler | — | rejected | — | acoon.de/robot.asp returns 404 (no live bot documentation) and arcjet records no UA instance to source; leave out. | 2026-07-14 |
| addthis-crawler | — | rejected | — | AddThis was discontinued by Oracle; addthis.com redirects to oracle.com and returns 403, with no operator bot documentation available. Defunct service | 2026-07-14 |
| admantx-crawler | — | rejected | — | admantx.com redirects to integralads.com (IAS) with no dedicated live bot-documentation page; also known counterfeit UA variants. | 2026-07-14 |
| advbot-crawler | — | rejected | — | Operator site is dead — advbot.net DNS does not resolve; no reachable documentation, operator no longer identifiable. | 2026-07-14 |
| anthropic-crawler | — | rejected | — | already listed as claudebot (same operator Anthropic, same ClaudeBot crawler already in directory) | 2026-07-14 |
| arocom-crawler | — | rejected | — | arocom GmbH is a real German Drupal agency and the site is live, but www.arocom.de/drupact now serves a generic marketing page (title 'arocom — Drupal | 2026-07-14 |
| ask-crawler | — | rejected | — | Ask/Teoma crawler is defunct; Ask.com no longer runs its own index and the official webmaster docs URL returns no response (dead). No current official | 2026-07-14 |
| backlinktest-crawler | — | rejected | — | backlinktest.com/crawler.html returns 404 (no live bot documentation) and arcjet records no UA instance; cannot source fields. | 2026-07-14 |
| betterstack-monitor | — | rejected | — | Already listed as betterstack-uptime (same operator Better Stack uptime bot). | 2026-07-14 |
| capsulink-crawler | — | rejected | — | capsulink.com is a live URL-shortener but publishes no crawler/bot documentation; CapsuleChecker (a link validator) has no docs page or sourceable UA/ | 2026-07-14 |
| careerx-crawler | — | rejected | — | Docs domain www.career-x.de does not resolve (ENOTFOUND); no recorded UA instances; operator defunct and nothing sourceable. | 2026-07-14 |
| changedetection-crawler | — | rejected | — | changedetection.com/bot.html 301-redirects to the Visualping marketing homepage; no official bot documentation exists and the recorded UA impersonates | 2026-07-14 |
| cliqz-crawler | — | rejected | — | cliqz.com states 'the Cliqz Search Engine is no longer in operation'; bot doc page /company/cliqzbot returns 403. Operator/bot defunct (fails gate 1). | 2026-07-14 |
| cloudflare-security-center | — | rejected | — | UA is a full Chrome browser string with only a '+https://developers.cloudflare.com/security-center/' comment (no distinctive bot token; impersonates a | 2026-07-14 |
| convera-crawler | — | rejected | — | Convera search was discontinued around 2007; the docs site ews.converasearch.com is dead (no response) and there is no working operator site or docume | 2026-07-14 |
| creativecommons-crawler | — | rejected | — | Creative Commons' own wiki page states the Metadata Scraper was decommissioned on 8 January 2018; the bot no longer operates. | 2026-07-14 |
| crystalsemantics-crawler | — | rejected | — | Operator domain www.crystalsemantics.com does not resolve (defunct) and the candidate has zero recorded UA instances to match the pattern. | 2026-07-14 |
| cxense-crawler | — | rejected | — | cxense.com/bot.html returns 404; Cxense folded into Piano with no live bot-documentation page. | 2026-07-14 |
| cyberpatrol-crawler | — | rejected | — | Product discontinued (now part of SafeToNet, described in past tense); crawlerinfo page redirects to homepage with no bot documentation — nothing to s | 2026-07-14 |
| datadog-monitor-synthetics | — | rejected | — | already listed as datadog-synthetics (same Datadog Synthetics bot and synthetics.json feed already in directory) | 2026-07-14 |
| deusu-crawler | — | rejected | — | DeuSu robot docs page (deusu.de/robot.html) returns 404 and deusu.de now serves only a placeholder; search service appears inactive with no live offic | 2026-07-14 |
| discoveryengine-crawler | — | rejected | — | Operator defunct: discoveryengine.com/discobot.html 302-redirects to hugedomains.com (parked/for-sale); no working site or bot docs, fails inclusion g | 2026-07-14 |
| domainreanimator-crawler | — | rejected | — | domainreanimator.com homepage is a near-empty placeholder with no bot documentation page to source a UA or verification from; expired-domain harvestin | 2026-07-14 |
| dotnetdotcom-crawler | — | rejected | — | No identifiable operator: the only 'docs' link is a phpBB forum post and the contact is a gmail address (ezooms.bot@gmail.com); fails the operator/doc | 2026-07-14 |
| facebook-crawler | — | rejected | — | Meta's docs no longer document a FacebookBot/Facebot UA token (superseded by Meta-ExternalAgent, already listed); geofeed is a licensed CSV, not a sup | 2026-07-14 |
| findthatfile-crawler | — | rejected | — | No recorded UA instance (empty instances, cannot satisfy >=1 matching instance rule); findthatfile.com returns HTTP 403; operator/legitimacy unverifia | 2026-07-14 |
| g00g1e-crawler | — | rejected | — | Domain g00g1e.net does not resolve, no recorded instances, and it is a Google-typosquat with no identifiable legitimate operator. | 2026-07-14 |
| gigablast-crawler | — | rejected | — | www.gigablast.com does not resolve (DNS dead); Gigablast search engine is defunct — no working site or bot documentation to source. | 2026-07-14 |
| gigablast-crawler-oss | — | rejected | — | GigablastOpenSource is self-hosted open-source search-engine software run by end-users, not a single identifiable operator's service — fails inclusion | 2026-07-14 |
| glutenfreepleasure-crawler | — | rejected | — | Operator domain glutenfreepleasure.com does not resolve (dead site) and there is no bot documentation anywhere; hobby crawler fails inclusion gate #1  | 2026-07-14 |
| grapeshot-crawler | — | rejected | — | Oracle Contextual Intelligence (Grapeshot) deprecated Sept 2024; crawler.php redirects to a generic Oracle acquisitions page, no live bot documentatio | 2026-07-14 |
| infegy-crawler | — | rejected | — | Only recorded UA is a standard 'Mozilla/5.0 (compatible) ... Chrome/47 Safari/537.36 collection@infegy.com' browser string with a contact email append | 2026-07-14 |
| integromedb-crawler | — | rejected | — | www.integromedb.org/Crawler is an infinite 301 redirect loop to itself, serving no content; bot documentation is inaccessible and the only 'instance'  | 2026-07-14 |
| internetarchive-crawler-oss | — | rejected | — | Heritrix is open-source crawler software run by many independent archives (recorded instances are webarchiv.cz and netarkivet.dk, not one operator); ' | 2026-07-14 |
| java-crawler4j | — | rejected | — | crawler4j is an open-source Java crawler library (github.com/yasserg/crawler4j) run by end-users, not an operated bot/service; fails gate #3 (generic  | 2026-07-14 |
| law-unimi-crawler | — | rejected | — | BUbiNG is an open-source crawler framework (LAW, Univ. of Milan) run by arbitrary end-users, not a single operated bot/service; fails inclusion gate # | 2026-07-14 |
| lipperhey-crawler | — | rejected | — | lipperhey.com does not resolve (DNS gone); SEO service defunct with no working site or docs. Fails gate #1. | 2026-07-14 |
| lssbot | — | rejected | — | lssbot.com is a mobile-game farming automation bot (plays games on user accounts), not a legitimate web crawler/preview/monitoring service; no documen | 2026-07-14 |
| metauri-crawler | — | rejected | — | Only cited 'docs' is the third-party useragentstring.com catalog; metauri.com has no bot documentation (self-signed cert, empty page). No official ope | 2026-07-14 |
| mignify-crawler | — | rejected | — | Operator site is dead — mignify.com DNS does not resolve; bot doc page unreachable, operator no longer identifiable. | 2026-07-14 |
| msn-crawler | — | rejected | — | msnbot was retired in 2010 and replaced by bingbot (already listed as bingbot); the arcjet UA instances shown are actually adidxbot, which is already  | 2026-07-14 |
| naver-crawler | — | rejected | — | already listed as naver-yeti (same Naver 'Yeti' search crawler) | 2026-07-14 |
| nerdbynature-crawler | — | rejected | — | No working documentation: nerdbynature.net/bot serves a mismatched TLS cert for an unrelated host; operator unclear and public reports describe an agg | 2026-07-14 |
| nerdybot-crawler | — | rejected | — | nerdybot.com now redirects to a GoDaddy parked/for-sale page; operator gone and no documentation, not identifiable. | 2026-07-14 |
| netestate-crawler | — | rejected | — | The crawler's documented site website-datenbank.de is dead (no response) and netestate.de does not document the 'netEstate NE Crawler' UA; the referen | 2026-07-14 |
| openhose-crawler | — | rejected | — | openhose.org no longer resolves (DNS failure); the operator site and bot documentation are gone, nothing sourceable. Defunct. | 2026-07-14 |
| page-to-rss | — | rejected | — | No identifiable operator (no company name) and no bot-documentation page; Page2RSS service is defunct though a static landing page still loads. | 2026-07-14 |
| php-phpcrawl | — | rejected | — | phpcrawl is an open-source PHP crawler library run by end-users, not a service with an identifiable operator; generic programmatic tool fails inclusio | 2026-07-14 |
| picsearch-crawler | — | rejected | — | Official docs URL picsearch.com/bot.html returns HTTP 404; no live documentation page to source UA/robots/verification from. | 2026-07-14 |
| pingdom-crawler | — | rejected | — | Already listed as pingdom (same operator SolarWinds Pingdom uptime bot). | 2026-07-14 |
| postrank-crawler | — | rejected | — | Service defunct: PostRank was acquired by Google in 2011 and shut down; www.postrank.com now redirects to Google Analytics marketing platform. No oper | 2026-07-14 |
| privacore-crawler | — | rejected | — | Findx (Privacore) search engine shut down ~2018; findxbot.com returns HTTP 444 with no working site or bot documentation. Fails gate #1 (no identifiab | 2026-07-14 |
| profound-crawler | — | rejected | — | profound.net/urlappendbot.html returns 404 and no operator documentation of the bot's purpose exists anywhere. | 2026-07-14 |
| scan-interfax-crawler | — | rejected | — | Candidate has no recorded UA instance to match the InterfaxScanBot pattern and no verifiable official bot documentation; cannot source required fields | 2026-07-14 |
| screamingfrog-crawler | — | rejected | — | Screaming Frog SEO Spider is a generic desktop tool run by end-users (each operator supplies their own crawl), which the inclusion gate explicitly exc | 2026-07-14 |
| scribd-crawler | — | rejected | — | No recorded UA instance in arcjet (instances: []) and no official Scribd bot-documentation page; cannot source a UA instance, so per iron rules leave  | 2026-07-14 |
| seekbot-crawler | — | rejected | — | Doc page seekbot.net/bot.html 404s; root domain is now a generic 'Reviews, tips and insights' WordPress blog — original crawler operator defunct, no s | 2026-07-14 |
| semrush-crawler | — | rejected | — | already listed as semrushbot (generic SemrushBot pattern for the same operator+bot is already covered). | 2026-07-14 |
| sentry-crawler | Sentry | rejected | — | Generic `sentry/` UA token — fails distinctive-UA gate. Distinct from added sentry-uptime. | 2026-07-13 |
| sentry-uptime-monitor | — | rejected | — | already listed as sentry-uptime (same Sentry uptime bot, SentryUptimeBot UA, same uptime-ips feed) | 2026-07-14 |
| seoprofiler-crawler | — | rejected | — | seoprofiler.com/bot redirects to a repurposed 'Directory of SEO Tools' homepage; no live official bot-documentation page and no verification recipe to | 2026-07-14 |
| sistrix-crawler | — | rejected | — | already listed as sistrix (same operator SISTRIX). | 2026-07-14 |
| sitebot-crawler | — | rejected | — | sitebot.org returns HTTP 436 with empty body and the only arcjet instance ('Whoiswebsitebot...') does not match the 'sitebot' pattern; no valid UA ins | 2026-07-14 |
| summify-crawler | — | rejected | — | Original Summify was acquired by Twitter and shut down (2011); summify.com is now an unrelated portfolio site with no crawler docs. Operator defunct,  | 2026-07-14 |
| sysomos-crawler | — | rejected | — | sysomos.com 308-redirects to meltwater.com; the Sysomos brand is defunct/absorbed and no operator bot documentation remains, so the bot cannot be sour | 2026-07-14 |
| trove-crawler | — | rejected | — | Arcjet has zero recorded UA instances and the pattern 'Trove' is a generic English word; cannot satisfy the >=1 sourced instance requirement or write  | 2026-07-14 |
| tweetmemebot | — | rejected | — | Operator DataSift was absorbed by Meltwater; datasift.com/bot.html now redirects to meltwater.com and no bot documentation page exists. Fails gate #1  | 2026-07-14 |
| twenga-crawler | — | rejected | — | Doc page twenga.com/bot.html 404s and there are zero recorded UA instances, so the pattern cannot be matched to any real instance (schema requires >=1 | 2026-07-14 |
| warebay-crawler | — | rejected | — | warebay.com/bot.html returns HTTP 404; no recorded UA instance and operator/legitimacy unverifiable. Fails inclusion gate. | 2026-07-14 |
| wocodi-crawler | — | rejected | — | wocodi.com and /crawler both return HTTP 520 (origin down); no recorded UA instances in arcjet and no working operator/docs page to source. Cannot mee | 2026-07-14 |
| wotbox-crawler | — | rejected | — | Docs domain www.wotbox.com does not resolve (ENOTFOUND); operator defunct, no live documentation to source. | 2026-07-14 |
| yandex-crawler | — | rejected | — | Already listed as yandexbot (same operator YandexBot crawler). | 2026-07-14 |
| yooz-crawler | — | rejected | — | yooz.ir does not resolve (DNS gone); operator site/docs defunct. Fails gate #1 (no working operator site). | 2026-07-14 |

## Already listed (for reference)

Many arcjet "verifiable" entries are already in `bots/`: censys, pingdom,
checkly, betterstack-uptime, oncrawl, statuscake, site24x7, hetrixtools,
updown-io, uptimerobot, datadog-synthetics, grafana-synthetic-monitoring,
cloudflare-healthchecks, amazon (amazonbot), apple (applebot), the Google and
Bing crawler families, the OpenAI/Anthropic/Perplexity/Meta families, and the
Stripe/Adyen/PayPal/Svix/Twilio webhook senders. Check `bots/` before treating
an arcjet id as new.
