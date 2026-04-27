import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok, err } from "../mcp/types.js";
import { getCalendarBackend, type CalendarEvent } from "../lib/calendar/index.js";
import { proposalStore } from "../lib/proposals/ProposalStore.js";
import { recordDecision } from "../lib/store/decisions.js";

const proposeInputSchema = {
  event_id: z.string(),
  calendar_id: z.string().optional(),
  reason: z.string().optional(),
} as const;

interface CancelPayload {
  event_id: string;
  calendar_id?: string;
  reason?: string;
  snapshot: { title: string; start: string; end: string };
}

export const proposeCancel: Tool<typeof proposeInputSchema> = {
  name: "propose_cancel",
  description:
    "Stage a cancellation. Returns proposal_id + a snapshot of the event being cancelled. Commit with commit_cancel after user confirms.",
  isReadOnly: false,
  inputSchema: proposeInputSchema,
  async call(args) {
    const backend = getCalendarBackend();
    const events = await backend.listEvents({
      calendarId: args.calendar_id,
      range: { start: "1970-01-01T00:00:00Z", end: "2099-12-31T00:00:00Z" },
    });
    const event = events.find((e: CalendarEvent) => e.id === args.event_id);
    if (!event)
      return err("EVENT_NOT_FOUND", `No event ${args.event_id}.`);
    const summary = `Will cancel "${event.title}" ${event.start}–${event.end}${
      args.reason ? ` (reason: ${args.reason})` : ""
    }.`;
    const payload: CancelPayload = {
      event_id: event.id,
      calendar_id: args.calendar_id,
      reason: args.reason,
      snapshot: { title: event.title, start: event.start, end: event.end },
    };
    const proposal = proposalStore.create({
      kind: "cancel_event",
      summary,
      payload,
      refs: { eventId: event.id },
    });
    return ok({
      proposal_id: proposal.id,
      summary,
      event_snapshot: payload.snapshot,
      expires_at: proposal.expiresAt,
    });
  },
};

const commitInputSchema = {
  proposal_id: z.string(),
} as const;

export const commitCancel: Tool<typeof commitInputSchema> = {
  name: "commit_cancel",
  description: "Cancel an event via a propose_cancel proposal. Requires user confirmation.",
  isDestructive: true,
  inputSchema: commitInputSchema,
  async call(args) {
    const consumed = proposalStore.consume<CancelPayload>(args.proposal_id);
    if ("ok" in consumed && consumed.ok === false) {
      return err(consumed.error.code, consumed.error.message);
    }
    const proposal = consumed as Exclude<typeof consumed, { ok: false }>;
    const backend = getCalendarBackend();
    await backend.cancelEvent(proposal.payload.event_id, {
      calendarId: proposal.payload.calendar_id,
    });
    const decision = await recordDecision({
      kind: "event_cancelled",
      summary: proposal.summary,
      refs: { event_id: proposal.payload.event_id, reason: proposal.payload.reason },
    });
    return ok({
      summary: `Cancelled "${proposal.payload.snapshot.title}".`,
      decision_id: decision.decision_id,
    });
  },
};
