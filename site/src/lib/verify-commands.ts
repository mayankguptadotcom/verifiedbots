import type { BotArtifact } from './data';

export function verifyCommands(bot: BotArtifact): Array<{ title: string; command: string }> {
  const out: Array<{ title: string; command: string }> = [];
  for (const v of bot.verification) {
    switch (v.type) {
      case 'cidr_feed':
        out.push({ title: 'Fetch the official IP range feed', command: `curl -s ${v.url as string}` });
        break;
      case 'rdns':
        out.push({
          title: 'Reverse-DNS check a client IP',
          command: `dig -x <client-ip> +short   # expect a hostname matching ${(v.masks as string[])[0]}`,
        });
        break;
      case 'asn':
        out.push({
          title: 'Look up the announced ranges by ASN',
          command: `whois -h whois.radb.net -- '-i origin AS${(v.numbers as number[])[0]}' | grep route`,
        });
        break;
      case 'web_bot_auth':
        out.push({
          title: 'Fetch the Web Bot Auth key directory',
          command: `curl -s ${v.signature_agent_url as string}`,
        });
        break;
      // static_cidrs: the ranges themselves are displayed; no runnable command.
    }
  }
  return out;
}
