export const DIFF_MIN_ABSOLUTE = 20;
export const DIFF_MAX_RATIO = 0.3;

export interface DiffResult {
  added: number;
  removed: number;
  changeRatio: number;
  suspicious: boolean;
}

export function diffRanges(previous: string[], next: string[]): DiffResult {
  const prev = new Set(previous);
  const nxt = new Set(next);
  let added = 0;
  let removed = 0;
  for (const r of nxt) if (!prev.has(r)) added++;
  for (const r of prev) if (!nxt.has(r)) removed++;
  const changes = added + removed;
  const changeRatio = previous.length === 0 ? 0 : changes / previous.length;
  const suspicious = previous.length > 0 && changes > DIFF_MIN_ABSOLUTE && changeRatio > DIFF_MAX_RATIO;
  return { added, removed, changeRatio, suspicious };
}
