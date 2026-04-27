import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok, err } from "../mcp/types.js";
import { getCalendarBackend, type CalendarEvent } from "../lib/calendar/index.js";
import { proposalStore } from "../lib/proposals/ProposalStore.js";
import { recordDecision } from "../lib/store/decisions.js";

const proposeInputSchema = {
  event_id: z.string(),
  new_start: z.string(),
  new_end: z.string(),
  calendar_id: z.string().optional(),
  reason: z.string().optional(),
} as const;

interface ReschedulePayload {
  event_id: string;
  calendar_id?: string;
  before: { title: string; start: string; end: string };
  after: { start: string; end: string };
  reason?: string;
}

export const proposeReschedule: Tool<typeof proposeInputSchema> = {
  name: "propose_reschedule",
  description:
    "Stage a reschedule. Returns proposal_id + before/after snapshots and conflict scan. Commit with commit_reschedule after user confirms.",
  isReadOnly: false,
  inputSchema: proposeInputSchema,
  async call(args) {
    const backend = getCalendarBackend();
    const all = await backend.listEvents({
      calendarId: args.calendar_id,
      range: { start: "1970-01-01T00:00:00Z", end: "2099-12-31T00:00:00Z" },
    });
    const event = all.find((e: CalendarEvent) => e.id === args.event_id);
    if (!event) return err("EVENT_NOT_FOUND", `No event ${args.event_id}.`);

    const conflicts = all.filter(
      (e: CalendarEvent) =>
        e.id !== event.id &&
        Date.parse(e.end) > Date.parse(args.new_start) &&
        Date.parse(e.start) < Date.parse(args.new_end),
    );
    const summary = `Will reschedule "${event.title}" ${event.start}–${event.end} -> ${args.new_start}–${args.new_end}${
      conflicts.length ? ` (conflicts: ${conflicts.length})` : ""
    }.`;
    const payload: ReschedulePayload = {
      event_id: event.id,
      calendar_id: args.calendar_id,
      before: { title: event.title, start: event.start, end: event.end },
      after: { start: args.new_start, end: args.new_end },
      reason: args.reason,
    };
    const proposal = proposalStore.create({
      kind: "reschedule_event",
      summary,
      payload,
      refs: { eventId: event.id },
    });
    return ok({
      proposal_id: proposal.id,
      summary,
      before: payload.before,
      after: payload.after,
      conflicts: conflicts.map((c) => ({
        id: c.id,
        title: c.title,
        start: c.start,
        end: c.end,
      })),
      expires_at: proposal.expiresAt,
    });
  },
};

const commitInputSchema = {
  proposal_id: z.string(),
} as const;

export const commitReschedule: Tool<typeof commitInputSchema> = {
  name: "commit_reschedule",
  description:
    "Apply a propose_reschedule proposal. Requires user confirmation before calling.",
  isDestructive: true,
  inputSchema: commitInputSchema,
  async call(args) {
    const consumed = proposalStore.consume<ReschedulePayload>(args.proposal_id);
    if ("ok" in consumed && consumed.ok === false) {
      return err(consumed.error.code, consumed.error.message);
    }
    const proposal = consumed as Exclude<typeof consumed, { ok: false }>;
    const backend = getCalendarBackend();
    const updated = await backend.updateEvent(
      proposal.payload.event_id,
      {
        start: proposal.payload.after.start,
        end: proposal.payload.after.end,
      },
      { calendarId: proposal.payload.calendar_id },
    );
    const decision = await recordDecision({
      kind: "event_rescheduled",
      summary: proposal.summary,
      refs: {
        event_id: updated.id,
        before: proposal.payload.before,
        after: proposal.payload.after,
        reason: proposal.payload.reason,
      },
    });
    return ok({
      summary: `Rescheduled "${updated.title}".`,
      event_id: updated.id,
      decision_id: decision.decision_id,
    });
  },
};
