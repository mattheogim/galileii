import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok } from "../mcp/types.js";
import { getCalendarBackend } from "../lib/calendar/index.js";

const inputSchema = {
  range_start: z
    .string()
    .describe("ISO-8601 start of the window (with timezone offset)."),
  range_end: z
    .string()
    .describe("ISO-8601 end of the window (with timezone offset)."),
  calendar_id: z.string().optional(),
} as const;

export const listEvents: Tool<typeof inputSchema> = {
  name: "list_events",
  description:
    "Read events from the user's calendar over a time range. Use whenever the user asks 'what's on my calendar' or before any scheduling decision. Read-only.",
  isReadOnly: true,
  isConcurrencySafe: true,
  inputSchema,
  async call(args) {
    const backend = getCalendarBackend();
    const events = await backend.listEvents({
      calendarId: args.calendar_id,
      range: { start: args.range_start, end: args.range_end },
    });
    const summary = events.length
      ? `${events.length} event(s): ${events
          .slice(0, 4)
          .map((e) => `${e.title} (${formatTime(e.start)}–${formatTime(e.end)})`)
          .join(", ")}${events.length > 4 ? ", …" : ""}`
      : "No events in that range.";
    return ok({ summary, events });
  },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
