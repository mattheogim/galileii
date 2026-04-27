import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok, err } from "../mcp/types.js";
import { readAllWants } from "../lib/store/wants.js";
import { proposalStore } from "../lib/proposals/ProposalStore.js";
import { isCompanionAvailable } from "../lib/companion/client.js";

const inputSchema = {
  want_id: z.string(),
  duration_minutes: z
    .number()
    .int()
    .min(5)
    .describe("How long to block distracting apps."),
  bundle_ids: z
    .array(z.string())
    .optional()
    .describe(
      "macOS bundle IDs to block. Defaults to YouTube + TikTok + Instagram + X if omitted.",
    ),
} as const;

const DEFAULT_BLOCKED_APPS = [
  "com.google.ios.youtube",
  "com.zhiliaoapp.musically", // TikTok
  "com.burbn.instagram",
  "com.atebits.Tweetie2", // Twitter/X
];

export const offerHardMode: Tool<typeof inputSchema> = {
  name: "offer_hard_mode",
  description:
    "Tier 3 → Tier 4 bridge — propose a Screen Time block of distracting apps for N minutes via the Galileii Companion. Returns a proposal_id; commit by calling commit_event for the activity AND a separate companion call (auto-handled when proposal is committed). REQUIRES the macOS Companion app to be installed and running.",
  isReadOnly: false,
  inputSchema,
  async call(args) {
    const wants = await readAllWants();
    const want = wants.find((w) => w.id === args.want_id);
    if (!want) return err("WANT_NOT_FOUND", `No want ${args.want_id}.`);
    if (!want.hard_mode_eligible) {
      return err(
        "NOT_HARD_MODE_ELIGIBLE",
        `Want "${want.text}" is not hard-mode eligible. Ask the user to opt in via update_want first.`,
      );
    }

    const companionUp = await isCompanionAvailable();
    if (!companionUp) {
      return err(
        "COMPANION_UNAVAILABLE",
        "Galileii Companion is not running. Install via `brew install --cask galileii-companion` (V0 stub: not yet released — currently soft-fails so the rest of the flow can be tested).",
        "Tell the user that hard-mode requires the desktop companion, and they can proceed with minimum-viable only.",
      );
    }

    const bundleIds = args.bundle_ids ?? DEFAULT_BLOCKED_APPS;
    const summary =
      `Will block ${bundleIds.length} distracting app(s) for ${args.duration_minutes} min while you do "${want.text}". ` +
      `You can release early if needed.`;
    const proposal = proposalStore.create({
      kind: "activity_suggestion",
      summary,
      payload: {
        kind: "hard_mode",
        want_id: want.id,
        bundle_ids: bundleIds,
        duration_minutes: args.duration_minutes,
      },
      refs: { wantId: want.id },
    });
    return ok({
      proposal_id: proposal.id,
      summary,
      will_block: bundleIds,
      duration_minutes: args.duration_minutes,
      next_step:
        "Show summary in chat. On user 'yes', call commit_hard_mode with this proposal_id. On 'no', back off and proceed without block.",
      expires_at: proposal.expiresAt,
    });
  },
};
