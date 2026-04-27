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
  stated_reason: z
    .string()
    .optional()
    .describe(
      "User's OWN reason for adding this want, in their own words. Captured at creation; anchors the Tier 3 pre-commit prompt later. Ask the user explicitly: 'Why do you want this?'",
    ),
  minimum_viable: z
    .string()
    .optional()
    .describe(
      "User's OWN minimum-viable version of this want — the 5-minute thing that still counts. e.g. 'put on running shoes and walk to the corner'. Ask the user: 'What's the smallest version that still counts?'",
    ),
  hard_mode_eligible: z
    .boolean()
    .optional()
    .describe(
      "Whether the user opts in to Tier 4 (Screen Time block) for this want. Ask: 'If you keep blowing this off, can I block YouTube/TikTok during it?' — never default to true.",
    ),
  hard_mode_min_duration: z
    .number()
    .int()
    .min(5)
    .optional()
    .describe("If hard_mode_eligible, default duration of the Screen Time block in minutes."),
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
      stated_reason: args.stated_reason,
      minimum_viable: args.minimum_viable,
      hard_mode_eligible: args.hard_mode_eligible,
      hard_mode_min_duration: args.hard_mode_min_duration,
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
