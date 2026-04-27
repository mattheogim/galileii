import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok } from "../mcp/types.js";
import { newWantId, type Horizon, type Want } from "../lib/store/wants.js";
import { proposalStore } from "../lib/proposals/ProposalStore.js";

const inputSchema = {
  text: z.string().min(1).describe("The want, in the user's own words."),
  horizon: z
    .enum(["this_week", "this_month", "someday"])
    .default("someday")
    .describe("Time horizon for this want."),
  tags: z.array(z.string()).optional(),
  duration_min: z.number().int().min(5).optional(),
  frequency: z
    .string()
    .optional()
    .describe('Free-form, e.g. "3x/week", "daily", "once".'),
  energy: z.enum(["low", "med", "high"]).optional(),
  time_of_day: z.enum(["any", "morning", "afternoon", "evening"]).optional(),
  source_quote: z
    .string()
    .optional()
    .describe("Verbatim user phrase that triggered this."),
} as const;

export const addWantProposal: Tool<typeof inputSchema> = {
  name: "add_want_proposal",
  description:
    "Stage a new want without writing. Returns a proposal_id; commit with commit_add_want after the user confirms.",
  isReadOnly: false,
  inputSchema,
  async call(args) {
    const want: Want = {
      id: newWantId(),
      text: args.text,
      horizon: args.horizon as Horizon,
      duration_min: args.duration_min,
      frequency: args.frequency,
      energy: args.energy,
      time_of_day: args.time_of_day,
      tags: args.tags,
      created_at: new Date().toISOString(),
    };
    const summary = `Add want: "${want.text}" (${want.horizon}${
      want.tags?.length ? `, ${want.tags.join("/")}` : ""
    }).`;
    const proposal = proposalStore.create({
      kind: "add_want",
      summary,
      payload: { want, source_quote: args.source_quote },
    });
    return ok({ proposal_id: proposal.id, summary, expires_at: proposal.expiresAt });
  },
};
