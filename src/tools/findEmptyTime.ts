import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok } from "../mcp/types.js";
import { findGaps, type Gap } from "../lib/gap-finder/index.js";
import { getCalendarBackend } from "../lib/calendar/index.js";
import { rememberGap } from "../lib/proposals/gapStore.js";

const inputSchema = {
  range_start: z
    .string()
    .describe("ISO-8601 start of the search window (with timezone offset)."),
  range_end: z
    .string()
    .describe("ISO-8601 end of the search window (with timezone offset)."),
  min_duration_minutes: z.number().int().min(5).default(30),
  max_gaps: z.number().int().min(1).max(20).default(5),
  exclude_before: z.string().default("08:00:00"),
  exclude_after: z.string().default("22:00:00"),
  buffer_minutes: z.number().int().min(0).default(15),
  calendar_id: z.string().optional(),
} as const;

export const findEmptyTime: Tool<typeof inputSchema> = {
  name: "find_empty_time",
  description:
    "Find usable empty-time gaps in the user's calendar over a date range. Returns gaps with surrounding-event context, suitable for activity-matching with propose_activity_for_gap. Read-only.",
  isReadOnly: true,
  isConcurrencySafe: true,
  inputSchema,
  async call(args) {
    const backend = getCalendarBackend();
    const events = await backend.listEvents({
      calendarId: args.calendar_id,
      range: { start: args.range_start, end: args.range_end },
    });
    const gaps: Gap[] = findGaps({
      events,
      range: { start: args.range_start, end: args.range_end },
      min_duration_minutes: args.min_duration_minutes,
      max_gaps: args.max_gaps,
      exclude_before: args.exclude_before,
      exclude_after: args.exclude_after,
      buffer_minutes: args.buffer_minutes,
    });
    for (const g of gaps) rememberGap(g);
    const summary =
      gaps.length === 0
        ? "No usable gaps in that range."
        : `${gaps.length} gap(s): ${gaps
            .slice(0, 3)
            .map((g) => `${g.duration_minutes}m`)
            .join(", ")}.`;
    return ok({ summary, gaps });
  },
};
