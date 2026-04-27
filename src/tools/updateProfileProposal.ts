import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok } from "../mcp/types.js";
import { applyProfilePatch, readProfileFile, type Profile } from "../lib/store/profile.js";
import { proposalStore } from "../lib/proposals/ProposalStore.js";

const inputSchema = {
  patch: z
    .record(z.string(), z.unknown())
    .describe(
      "Partial profile object. Fields not present are left untouched. Pass null to clear a field.",
    ),
  rationale: z
    .string()
    .min(1)
    .describe("One sentence: why this update, drawn from the conversation."),
} as const;

export const updateProfileProposal: Tool<typeof inputSchema> = {
  name: "update_profile_proposal",
  description:
    "Stage a profile patch without writing to disk. Returns a proposal_id; commit with commit_profile_update after the user confirms in chat.",
  isReadOnly: false,
  inputSchema,
  async call(args) {
    const { profile: current } = await readProfileFile();
    const { next, diff } = applyProfilePatch(current, args.patch as Partial<Profile>);
    const summary = renderSummary(diff);
    const proposal = proposalStore.create({
      kind: "update_profile",
      summary,
      payload: { next, diff, rationale: args.rationale },
    });
    return ok({
      proposal_id: proposal.id,
      summary,
      diff,
      expires_at: proposal.expiresAt,
    });
  },
};

function renderSummary(
  diff: Array<{ path: string; before: unknown; after: unknown }>,
): string {
  if (diff.length === 0) return "Profile unchanged.";
  const parts = diff.map((d) =>
    d.after === null ? `clear ${d.path}` : `set ${d.path}=${JSON.stringify(d.after)}`,
  );
  return `Profile change: ${parts.join("; ")}.`;
}
