import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok, err } from "../mcp/types.js";
import { readAllWants } from "../lib/store/wants.js";
import { proposalStore } from "../lib/proposals/ProposalStore.js";

const inputSchema = {
  rejected_want_id: z
    .string()
    .describe("The want_id the user just rejected at Tier 1."),
  rejected_gap_id: z
    .string()
    .optional()
    .describe("The gap_id of the rejected proposal, if applicable."),
  user_message: z
    .string()
    .optional()
    .describe("Verbatim phrase the user said when rejecting (e.g. 'nah, too tired')."),
} as const;

export const proposeDiagnostic: Tool<typeof inputSchema> = {
  name: "propose_diagnostic",
  description:
    "Tier 2 — when the user rejects a Tier 1 activity proposal, call this to ASK the blocker (timing / energy / want / not now) with 괜찮아 (no judgment) framing. Returns a proposal that the LLM presents to the user; the user's answer informs the next adjusted proposal. Use after EVERY rejection at Tier 1 — never just give up at Tier 1.",
  isReadOnly: false,
  inputSchema,
  async call(args) {
    const wants = await readAllWants();
    const rejected = wants.find((w) => w.id === args.rejected_want_id);
    if (!rejected) {
      return err(
        "WANT_NOT_FOUND",
        `No want ${args.rejected_want_id}. Re-read wants and pick a real id.`,
      );
    }

    const summary = `괜찮아. What was the blocker for "${rejected.text}"?\n  (a) timing — wrong slot, can shift\n  (b) tired / low energy right now\n  (c) don't feel like THIS want today (something else)\n  (d) just not now — back off`;

    const proposal = proposalStore.create({
      kind: "activity_suggestion",
      summary,
      payload: {
        kind: "diagnostic",
        rejected_want_id: rejected.id,
        rejected_gap_id: args.rejected_gap_id,
        user_message: args.user_message,
        prompt_text: summary,
        options: ["timing", "energy", "want", "not_now"],
      },
      refs: {
        wantId: rejected.id,
        gapId: args.rejected_gap_id,
      },
    });

    return ok({
      diagnostic_id: proposal.id,
      summary,
      options: [
        { code: "timing", label: "Timing wrong — try a different slot" },
        { code: "energy", label: "Tired — swap to something low-energy" },
        { code: "want", label: "Different want today — pick another" },
        { code: "not_now", label: "Just not now — check in tomorrow" },
      ],
      next_step:
        "Show summary in chat. Wait for user's letter (a/b/c/d) or natural-language equivalent. Then call propose_minimum_viable (if 'want'/'energy') or re-call propose_activity_for_gap with adjusted constraints (if 'timing'). If 'not_now', log_decision and back off until tomorrow.",
      expires_at: proposal.expiresAt,
    });
  },
};
