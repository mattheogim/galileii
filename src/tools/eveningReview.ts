import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok } from "../mcp/types.js";
import { getCalendarBackend } from "../lib/calendar/index.js";

const inputSchema = {
  date: z.string().optional().describe('ISO date "YYYY-MM-DD". Defaults to today.'),
  timezone_offset_hours: z.number().default(-7),
} as const;

export const eveningReview: Tool<typeof inputSchema> = {
  name: "evening_review",
  description:
    "End-of-day mirror to daily_briefing: today's events that happened, what's tomorrow. Use at the end of the day or when the user asks 'review my day'.",
  isReadOnly: true,
  inputSchema,
  async call(args) {
    const offsetHours = args.timezone_offset_hours ?? -7;
    const date = args.date ?? new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${date}T00:00:00Z`).getTime() - offsetHours * 3600_000;
    const dayEnd = dayStart + 24 * 3600_000;
    const tomorrowEnd = dayEnd + 24 * 3600_000;

    const backend = getCalendarBackend();
    const today = await backend.listEvents({
      range: { start: new Date(dayStart).toISOString(), end: new Date(dayEnd).toISOString() },
    });
    const tomorrow = await backend.listEvents({
      range: { start: new Date(dayEnd).toISOString(), end: new Date(tomorrowEnd).toISOString() },
    });

    const summary = `Today: ${today.length} event(s). Tomorrow: ${tomorrow.length} event(s).`;
    return ok({
      summary,
      completed: today,
      tomorrow_preview: tomorrow,
    });
  },
};
