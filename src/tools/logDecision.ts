import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok } from "../mcp/types.js";
import { recordDecision, type DecisionKind } from "../lib/store/decisions.js";

const inputSchema = {
  kind: z.enum([
    "note",
    "event_created",
    "event_cancelled",
    "event_rescheduled",
    "profile_updated",
    "want_added",
    "want_completed",
  ]),
  summary: z.string().min(1),
  refs: z.record(z.string(), z.unknown()).optional(),
} as const;

export const logDecision: Tool<typeof inputSchema> = {
  name: "log_decision",
  description:
    "Append a free-form decision/note to ~/.galileii/decisions.md. Most decisions are logged automatically by commit_* tools. Use this only for context that doesn't fit another tool (e.g. \"user mentioned switching to night shift\").",
  inputSchema,
  async call(args) {
    const decision = await recordDecision({
      kind: args.kind as DecisionKind,
      summary: args.summary,
      refs: args.refs,
    });
    return ok({
      decision_id: decision.decision_id,
      written_at: decision.written_at,
    });
  },
};
