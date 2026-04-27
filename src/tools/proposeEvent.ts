import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok } from "../mcp/types.js";
import { getCalendarBackend, type CalendarEvent } from "../lib/calendar/index.js";
import { proposalStore } from "../lib/proposals/ProposalStore.js";

const recurrenceSchema = z.object({
  freq: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional(),
  by_day: z.array(z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"])).optional(),
  until: z.string().optional(),
  count: z.number().int().optional(),
});

const inputSchema = {
  title: z.string().min(1),
  start: z.string().describe("ISO-8601 start with timezone offset."),
  end: z.string().describe("ISO-8601 end with timezone offset."),
  location: z.string().optional(),
  description: z.string().optional(),
  calendar_id: z.string().optional(),
  recurrence: recurrenceSchema.optional(),
  linked_want_id: z.string().optional(),
  linked_gap_id: z.string().optional(),
} as const;

interface CreateEventPayload {
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  calendarId?: string;
  recurrence?: z.infer<typeof recurrenceSchema>;
  linked_want_id?: string;
  linked_gap_id?: string;
}

export const proposeEvent: Tool<typeof inputSchema> = {
  name: "propose_event",
  description:
    "Stage a new calendar event without committing. Returns proposal_id, summary, and any conflicts. Commit with commit_event after the user confirms in chat.",
  isReadOnly: false,
  inputSchema,
  async call(args) {
    const backend = getCalendarBackend();
    const conflicts = await detectConflicts(backend, args.start, args.end, args.calendar_id);
    const summary = `Will create "${args.title}" ${formatTime(args.start)}–${formatTime(
      args.end,
    )}${args.location ? ` @ ${args.location}` : ""}${
      conflicts.length ? ` (conflicts: ${conflicts.length})` : ""
    }.`;
    const payload: CreateEventPayload = {
      title: args.title,
      start: args.start,
      end: args.end,
      location: args.location,
      description: args.description,
      calendarId: args.calendar_id,
      recurrence: args.recurrence,
      linked_want_id: args.linked_want_id,
      linked_gap_id: args.linked_gap_id,
    };
    const proposal = proposalStore.create({
      kind: "create_event",
      summary,
      payload,
      refs: { wantId: args.linked_want_id, gapId: args.linked_gap_id },
    });
    return ok({
      proposal_id: proposal.id,
      summary,
      preview: payload,
      conflicts,
      expires_at: proposal.expiresAt,
    });
  },
};

async function detectConflicts(
  backend: ReturnType<typeof getCalendarBackend>,
  start: string,
  end: string,
  calendarId?: string,
): Promise<Array<{ id: string; title: string; start: string; end: string }>> {
  const events = await backend.listEvents({
    calendarId,
    range: { start, end },
  });
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  return events
    .filter((e: CalendarEvent) => Date.parse(e.end) > startMs && Date.parse(e.start) < endMs)
    .map((e: CalendarEvent) => ({ id: e.id, title: e.title, start: e.start, end: e.end }));
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
