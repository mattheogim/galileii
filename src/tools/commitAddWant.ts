import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok, err } from "../mcp/types.js";
import { appendWant, type Want } from "../lib/store/wants.js";
import { proposalStore } from "../lib/proposals/ProposalStore.js";
import { recordDecision } from "../lib/store/decisions.js";

const inputSchema = {
  proposal_id: z.string().describe("ID returned from add_want_proposal."),
} as const;

export const commitAddWant: Tool<typeof inputSchema> = {
  name: "commit_add_want",
  description:
    "Append a staged want to ~/.galileii/wants.md. Requires user confirmation before calling.",
  isDestructive: true,
  inputSchema,
  async call(args) {
    const consumed = proposalStore.consume<{ want: Want; source_quote?: string }>(
      args.proposal_id,
    );
    if ("ok" in consumed && consumed.ok === false) {
      return err(consumed.error.code, consumed.error.message);
    }
    const proposal = consumed as Exclude<typeof consumed, { ok: false }>;
    await appendWant(proposal.payload.want);
    const decision = await recordDecision({
      kind: "want_added",
      summary: proposal.summary,
      refs: {
        want_id: proposal.payload.want.id,
        source_quote: proposal.payload.source_quote,
      },
    });
    return ok({
      summary: `Added want "${proposal.payload.want.text}".`,
      want_id: proposal.payload.want.id,
      decision_id: decision.decision_id,
    });
  },
};
