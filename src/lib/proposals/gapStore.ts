import type { Gap } from "../gap-finder/index.js";

const TTL_MS = 10 * 60 * 1000;

interface Entry {
  gap: Gap;
  cachedAt: number;
}

const map = new Map<string, Entry>();

export function rememberGap(gap: Gap): void {
  reap();
  map.set(gap.gap_id, { gap, cachedAt: Date.now() });
}

export function recallGap(id: string): Gap | null {
  reap();
  return map.get(id)?.gap ?? null;
}

function reap(): void {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, e] of map) {
    if (e.cachedAt < cutoff) map.delete(id);
  }
}
