export type FirstSeen = Record<string, string>;

// Append-only: ids never present get generatedAt; existing dates are kept even if
// the bot was removed, so a re-added bot retains its original first-seen date.
export function updateFirstSeen(ids: string[], existing: FirstSeen, generatedAt: string): FirstSeen {
  const next: FirstSeen = { ...existing };
  for (const id of ids) if (!(id in next)) next[id] = generatedAt;
  return next;
}
