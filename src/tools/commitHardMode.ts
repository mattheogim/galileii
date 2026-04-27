import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok, err } from "../mcp/types.js";
import { proposalStore } from "../lib/proposals/ProposalStore.js";
import { blockApps, CompanionUnavailableError } from "../lib/companion/client.js";
import { recordDecision } from "../lib/store/decisions.js";

const inputSchema = {
  proposal_id: z.string().describe("ID returned from offer_hard_mode."),
} as const;

interface HardModePayload {
  want_id: string;
  bundle_ids: string[];
  duration_minutes: number;
}

export const commitHardMode: Tool<typeof inputSchema> = {
  name: "commit_hard_mode",
  description:
    "Apply a Tier 4 Screen Time block via the Galileii Companion. Requires user confirmation (Tier 3 invariant). On success, the user's distracting apps are blocked for the duration; release with the released block_id via the companion's UI or by re-calling once duration elapses.",
  isDestructive: true,
  inputSchema,
  async call(args) {
    const consumed = proposalStore.consume<HardModePayload>(args.proposal_id);
    if ("ok" in consumed && consumed.ok === false) {
      return err(consumed.error.code, consumed.error.message);
    }
    const proposal = consumed as Exclude<typeof consumed, { ok: false }>;
    try {
      const result = await blockApps({
        bundle_ids: proposal.payload.bundle_ids,
        duration_minutes: proposal.payload.duration_minutes,
        reason: `Galileii Tier 4: want=${proposal.payload.want_id}`,
      });
      const decision = await recordDecision({
        kind: "note",
        summary: `Tier 4 hard-mode block fired: ${proposal.payload.bundle_ids.length} apps for ${proposal.payload.duration_minutes} min.`,
        refs: {
          want_id: proposal.payload.want_id,
          block_id: result.block_id,
          bundle_ids: proposal.payload.bundle_ids,
        },
      });
      return ok({
        summary: `Blocked ${proposal.payload.bundle_ids.length} apps until ${result.expires_at}.`,
        block_id: result.block_id,
        expires_at: result.expires_at,
        decision_id: decision.decision_id,
      });
    } catch (caught) {
      if (caught instanceof CompanionUnavailableError) {
        return err("COMPANION_UNAVAILABLE", caught.message, caught.hint);
      }
      return err(
        "COMPANION_FAILED",
        (caught as Error).message,
        "Verify the Galileii Companion is running (menubar icon visible).",
      );
    }
  },
};
