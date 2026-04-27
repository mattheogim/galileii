import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok } from "../mcp/types.js";
import { getCalendarBackend } from "../lib/calendar/index.js";
import { findGaps } from "../lib/gap-finder/index.js";
import { readAllWants } from "../lib/store/wants.js";
import { rankWantsForGap } from "../lib/proposer/index.js";
import { rememberGap } from "../lib/proposals/gapStore.js";

const inputSchema = {
  date: z
    .string()
    .optional()
    .describe('ISO date "YYYY-MM-DD". Defaults to today.'),
  timezone_offset_hours: z
    .number()
    .default(-7)
    .describe("UTC offset in hours. Default -7 (PDT)."),
} as const;

export const dailyBriefing: Tool<typeof inputSchema> = {
  name: "daily_briefing",
  description:
    "One-call morning summary: today's events + usable gaps + the top suggested activity for each gap. Use on first message of the day or when the user says 'good morning' / 'what's today'.",
  isReadOnly: true,
  inputSchema,
  async call(args) {
    const offsetHours = args.timezone_offset_hours ?? -7;
    const date = args.date ?? new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${date}T00:00:00Z`).getTime() - offsetHours * 3600_000;
    const dayEnd = dayStart + 24 * 3600_000;

    const backend = getCalendarBackend();
    const events = await backend.listEvents({
      range: { start: new Date(dayStart).toISOString(), end: new Date(dayEnd).toISOString() },
    });
    const gaps = findGaps({
      events,
      range: { start: new Date(dayStart).toISOString(), end: new Date(dayEnd).toISOString() },
      min_duration_minutes: 30,
    });
    for (const g of gaps) rememberGap(g);

    const wants = await readAllWants();
    const ctx = {
      now: new Date(),
      recentSuggestions: new Map<string, string>(),
      recentRejections: new Map<string, string>(),
      weeklyCompletions: new Map<string, number>(),
    };
    const suggestions = gaps.map((g) => {
      const ranked = rankWantsForGap(wants, g, ctx);
      const best = ranked.find((r) => r.score > 0)?.want ?? ranked[0]?.want;
      if (!best) {
        return {
          gap_id: g.gap_id,
          headline: `No want fits the ${g.duration_minutes}-min gap.`,
        };
      }
      return {
        gap_id: g.gap_id,
        headline: `${g.duration_minutes}-min gap → "${best.text}"`,
        want_id: best.id,
      };
    });

    const needsAttention = detectConflicts(events);
    const summary = `${events.length} event(s) today, ${gaps.length} usable gap(s)${
      suggestions[0]?.headline ? `. Top: ${suggestions[0].headline}` : ""
    }.`;

    return ok({
      summary,
      events,
      gaps,
      suggested_gap_fills: suggestions,
      needs_attention: needsAttention,
    });
  },
};

function detectConflicts(
  events: Awaited<ReturnType<ReturnType<typeof getCalendarBackend>["listEvents"]>>,
): Array<{ kind: string; detail: string }> {
  const out: Array<{ kind: string; detail: string }> = [];
  const sorted = [...events].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (Date.parse(cur.start) < Date.parse(prev.end)) {
      out.push({
        kind: "conflict",
        detail: `${prev.title} and ${cur.title} overlap.`,
      });
    }
  }
  return out;
}
