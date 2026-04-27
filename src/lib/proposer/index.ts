import type { Want } from "../store/wants.js";
import type { Gap } from "../gap-finder/index.js";
import { scoreWantForGap, type ScoringContext } from "./scoring.js";

export interface RankedWant {
  want: Want;
  score: number;
}

export function rankWantsForGap(
  wants: Want[],
  gap: Gap,
  ctx: ScoringContext,
): RankedWant[] {
  return wants
    .map((w) => ({ want: w, score: scoreWantForGap(w, gap, ctx) }))
    .sort((a, b) => b.score - a.score);
}

export function pickBestWant(
  wants: Want[],
  gap: Gap,
  ctx: ScoringContext,
): Want | null {
  const ranked = rankWantsForGap(wants, gap, ctx);
  const best = ranked[0];
  return best && best.score > 0 ? best.want : null;
}

export function buildProposedEvent(
  want: Want,
  gap: Gap,
): {
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
} {
  const startMs = Date.parse(gap.start);
  const durMin = want.duration_min ?? Math.min(60, gap.duration_minutes);
  const endMs = startMs + durMin * 60_000;
  const cap = Date.parse(gap.end);
  const safeEnd = Math.min(endMs, cap);
  return {
    title: want.text,
    start: new Date(startMs).toISOString(),
    end: new Date(safeEnd).toISOString(),
    description: `Auto-suggested from gap ${gap.start}–${gap.end} (want ${want.id}).`,
  };
}
