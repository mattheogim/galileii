import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok, err } from "../mcp/types.js";
import { getCalendarBackend } from "../lib/calendar/index.js";
import { proposalStore } from "../lib/proposals/ProposalStore.js";
import { recordDecision } from "../lib/store/decisions.js";

const inputSchema = {
  proposal_id: z.string().describe("ID returned from propose_event."),
} as const;

interface CreateEventPayload {
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  calendarId?: string;
  recurrence?: unknown;
  linked_want_id?: string;
  linked_gap_id?: string;
}

export const commitEvent: Tool<typeof inputSchema> = {
  name: "commit_event",
  description:
    "Apply a propose_event proposal to the calendar. Requires user confirmation before calling.",
  isDestructive: true,
  inputSchema,
  async call(args) {
    const consumed = proposalStore.consume<CreateEventPayload>(args.proposal_id);
    if ("ok" in consumed && consumed.ok === false) {
      return err(consumed.error.code, consumed.error.message);
    }
    const proposal = consumed as Exclude<typeof consumed, { ok: false }>;
    const backend = getCalendarBackend();
    const event = await backend.createEvent({
      title: proposal.payload.title,
      start: proposal.payload.start,
      end: proposal.payload.end,
      location: proposal.payload.location,
      description: proposal.payload.description,
      calendarId: proposal.payload.calendarId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recurrence: proposal.payload.recurrence as any,
    });
    const decision = await recordDecision({
      kind: "event_created",
      summary: proposal.summary,
      refs: {
        event_id: event.id,
        want_id: proposal.payload.linked_want_id,
        gap_id: proposal.payload.linked_gap_id,
      },
    });
    return ok({
      summary: `Created "${event.title}".`,
      event_id: event.id,
      html_link: event.html_link,
      decision_id: decision.decision_id,
    });
  },
};
