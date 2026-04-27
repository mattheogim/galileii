import type { Want } from "../store/wants.js";
import type { Gap } from "../gap-finder/index.js";

export interface ScoringContext {
  now: Date;
  recentSuggestions: Map<string, string>; // wantId -> ISO timestamp of last_proposed_at
  recentRejections: Map<string, string>; // wantId -> ISO of last reject
  weeklyCompletions: Map<string, number>; // wantId -> count this week
}

export function scoreWantForGap(
  want: Want,
  gap: Gap,
  ctx: ScoringContext,
): number {
  let score = 0;

  // 1. Frequency deficit: target − completed this week
  const target = parseFrequencyTarget(want.frequency);
  const done = ctx.weeklyCompletions.get(want.id) ?? 0;
  if (target > 0) score += Math.max(0, target - done) * 0.7;

  // 2. Duration fit
  if (want.duration_min) {
    const diff = Math.abs(gap.duration_minutes - want.duration_min);
    score += Math.max(0, 1 - diff / Math.max(want.duration_min, 30));
  } else {
    score += 0.3; // mild boost for "any duration"
  }

  // 3. Time-of-day match
  const gapHour = new Date(gap.start).getUTCHours();
  const tod = bucketOfHour(gapHour);
  if (want.time_of_day && want.time_of_day !== "any") {
    if (want.time_of_day === tod) score += 0.8;
    else score -= 0.2;
  }

  // 4. Recency penalties
  const lastProposed = ctx.recentSuggestions.get(want.id);
  if (lastProposed && hoursSince(lastProposed, ctx.now) < 24) score -= 1.5;
  const lastReject = ctx.recentRejections.get(want.id);
  if (lastReject && hoursSince(lastReject, ctx.now) < 24) score -= 3.0;

  return score;
}

function parseFrequencyTarget(freq?: string): number {
  if (!freq) return 0;
  const m = freq.match(/(\d+)\s*x\s*\/?\s*week/i);
  if (m) return Number(m[1]);
  if (/daily/i.test(freq)) return 7;
  if (/weekly/i.test(freq)) return 1;
  if (/monthly/i.test(freq)) return 0.25;
  return 0;
}

function bucketOfHour(h: number): "morning" | "afternoon" | "evening" {
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function hoursSince(iso: string, now: Date): number {
  return (now.getTime() - Date.parse(iso)) / (60 * 60 * 1000);
}
