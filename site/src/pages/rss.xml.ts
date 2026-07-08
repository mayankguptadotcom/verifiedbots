import type { APIRoute } from 'astro';
import { BRANDING } from '../../../src/branding';
import { dataset, CATEGORY_LABELS } from '../lib/data';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = () => {
  const site = `https://${BRANDING.domain}`;
  const items = [...dataset.bots]
    .sort((a, b) => b.first_seen.localeCompare(a.first_seen) || a.id.localeCompare(b.id))
    .slice(0, 50)
    .map((bot) => {
      const category = CATEGORY_LABELS[bot.category] ?? bot.category;
      return `    <item>
      <title>${esc(`${bot.name} — ${category}, ${bot.tier_label.toLowerCase()}`)}</title>
      <link>${site}/bots/${bot.id}</link>
      <guid isPermaLink="true">${site}/bots/${bot.id}</guid>
      <pubDate>${new Date(bot.first_seen).toUTCString()}</pubDate>
      <description>${esc(`${bot.description} Operated by ${bot.operator.name}.`)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(BRANDING.projectName)} — new bots</title>
    <link>${site}</link>
    <atom:link href="${site}/rss.xml" rel="self" type="application/rss+xml" />
    <description>Bots newly added to the directory, with identity, category, and verification tier.</description>
    <language>en</language>
    <lastBuildDate>${new Date(dataset.generated_at).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
