import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok, err } from "../mcp/types.js";
import { readProfileFile, writeProfileFile, type Profile } from "../lib/store/profile.js";
import { proposalStore } from "../lib/proposals/ProposalStore.js";
import { recordDecision } from "../lib/store/decisions.js";
import { profilePath } from "../lib/store/paths.js";

const inputSchema = {
  proposal_id: z.string().describe("ID returned from update_profile_proposal."),
} as const;

interface ProfileUpdatePayload {
  next: Profile;
  diff: Array<{ path: string; before: unknown; after: unknown }>;
  rationale: string;
}

export const commitProfileUpdate: Tool<typeof inputSchema> = {
  name: "commit_profile_update",
  description:
    "Apply a profile proposal (from update_profile_proposal) to ~/.galileii/profile.md. Requires user confirmation before calling.",
  isDestructive: true,
  inputSchema,
  async call(args) {
    const consumed = proposalStore.consume<ProfileUpdatePayload>(args.proposal_id);
    if ("ok" in consumed && consumed.ok === false) {
      return err(consumed.error.code, consumed.error.message);
    }
    const proposal = consumed as Exclude<typeof consumed, { ok: false }>;
    const { body } = await readProfileFile();
    await writeProfileFile(proposal.payload.next, body);
    const decision = await recordDecision({
      kind: "profile_updated",
      summary: proposal.summary,
      refs: { rationale: proposal.payload.rationale, diff: proposal.payload.diff },
    });
    return ok({
      summary: `Wrote profile (${proposal.payload.diff.length} change(s)).`,
      wrote_path: profilePath(),
      decision_id: decision.decision_id,
    });
  },
};
