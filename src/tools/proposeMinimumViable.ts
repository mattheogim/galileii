import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok, err } from "../mcp/types.js";
import { readAllWants } from "../lib/store/wants.js";
import { proposalStore } from "../lib/proposals/ProposalStore.js";

const inputSchema = {
  want_id: z.string().describe("The want to anchor to."),
  gap_id: z.string().optional().describe("Gap to fit the minimum-viable version into."),
  trigger_reason: z
    .string()
    .optional()
    .describe(
      "Why this is firing — usually 'tier_2_failed' (user rejected the diagnostic adjustment) or 'direct_tier_3' (user explicitly asked for the smallest version).",
    ),
} as const;

export const proposeMinimumViable: Tool<typeof inputSchema> = {
  name: "propose_minimum_viable",
  description:
    "Tier 3 — anchor to the user's OWN stated reason for the want, then offer (a) the minimum-viable version (5-min thing) and optionally (b) a hard-mode Screen Time block for the duration. Use AFTER Tier 2 diagnostic adjustment was also rejected. The minimum-viable framing is: 'When you added this you wrote {stated_reason}. Smallest version that still counts: {minimum_viable}.'",
  isReadOnly: false,
  inputSchema,
  async call(args) {
    const wants = await readAllWants();
    const want = wants.find((w) => w.id === args.want_id);
    if (!want) return err("WANT_NOT_FOUND", `No want ${args.want_id}.`);

    const reason = want.stated_reason ?? want.text;
    const mvp = want.minimum_viable ?? `5-minute version of: ${want.text}`;

    const summary =
      `When you added this, you said: "${reason}".\n` +
      `Smallest version that still counts: "${mvp}".\n` +
      (want.hard_mode_eligible
        ? `If it helps, I can block YouTube/TikTok for ${want.hard_mode_min_duration ?? 30} min while you do it.\n`
        : "") +
      `\nWhich is it: minimum-only / minimum + block / nope?`;

    const proposal = proposalStore.create({
      kind: "activity_suggestion",
      summary,
      payload: {
        kind: "minimum_viable",
        want_id: want.id,
        gap_id: args.gap_id,
        stated_reason: reason,
        minimum_viable_text: mvp,
        hard_mode_eligible: !!want.hard_mode_eligible,
        hard_mode_min_duration: want.hard_mode_min_duration ?? 30,
      },
      refs: { wantId: want.id, gapId: args.gap_id },
    });

    return ok({
      proposal_id: proposal.id,
      summary,
      stated_reason: reason,
      minimum_viable_text: mvp,
      hard_mode_offer: want.hard_mode_eligible
        ? {
            available: true,
            duration_minutes: want.hard_mode_min_duration ?? 30,
            note: "Calling offer_hard_mode requires the Galileii Companion to be installed.",
          }
        : { available: false, reason: "Want is not hard_mode_eligible." },
      next_step:
        "Show summary in chat. If user picks 'minimum-only' → propose_event for a short event with the minimum_viable_text as title. If 'minimum + block' AND companion available → also call offer_hard_mode then commit. If 'nope' → log_decision, back off.",
      expires_at: proposal.expiresAt,
    });
  },
};
