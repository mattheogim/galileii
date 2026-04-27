import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok, err } from "../mcp/types.js";
import { recallGap } from "../lib/proposals/gapStore.js";
import { readAllWants } from "../lib/store/wants.js";
import { rankWantsForGap, buildProposedEvent } from "../lib/proposer/index.js";
import { proposalStore } from "../lib/proposals/ProposalStore.js";

const inputSchema = {
  gap_id: z.string().describe("ID returned from find_empty_time."),
  want_id: z
    .string()
    .optional()
    .describe(
      "Optional — force a specific want. If omitted, server picks the highest-scoring want.",
    ),
  constraints: z
    .object({
      must_be_outdoor: z.boolean().optional(),
      max_travel_minutes: z.number().int().optional(),
      preferred_intensity: z.enum(["low", "medium", "high"]).optional(),
    })
    .optional(),
} as const;

export const proposeActivityForGap: Tool<typeof inputSchema> = {
  name: "propose_activity_for_gap",
  description:
    "Given a gap (and optionally a want), propose an activity with reasoning. Returns a suggestion (no calendar mutation). The LLM should chain into propose_event after the user accepts the suggestion direction.",
  isReadOnly: false,
  inputSchema,
  async call(args) {
    const gap = recallGap(args.gap_id);
    if (!gap) {
      return err(
        "GAP_NOT_FOUND",
        `No gap with id ${args.gap_id}. Re-run find_empty_time and use a fresh gap_id.`,
      );
    }
    const wants = await readAllWants();
    if (wants.length === 0) {
      return err(
        "NO_WANTS",
        "User has no wants yet. Ask them what they want to be doing more of, then add via add_want_proposal.",
      );
    }

    let chosen = args.want_id ? wants.find((w) => w.id === args.want_id) : null;
    let alternatives: Array<{ want_id: string; title: string; reason: string }> = [];

    if (!chosen) {
      const ranked = rankWantsForGap(wants, gap, {
        now: new Date(),
        recentSuggestions: new Map(),
        recentRejections: new Map(),
        weeklyCompletions: new Map(),
      });
      const filtered = ranked.filter((r) => r.score > 0);
      chosen = filtered[0]?.want ?? ranked[0]?.want;
      alternatives = filtered.slice(1, 3).map((r) => ({
        want_id: r.want.id,
        title: r.want.text,
        reason: `score ${r.score.toFixed(2)}`,
      }));
    }

    if (!chosen) {
      return err(
        "NO_WANT_MATCH",
        "No want scored above zero for this gap. Suggest the user add a new want or relax constraints.",
      );
    }

    const event = buildProposedEvent(chosen, gap);
    const summary = `Suggest "${event.title}" ${formatTime(event.start)}–${formatTime(
      event.end,
    )} in your ${gap.duration_minutes}-min gap.`;
    const reasoning = buildReasoning(chosen, gap);

    const proposal = proposalStore.create({
      kind: "activity_suggestion",
      summary,
      payload: {
        want_id: chosen.id,
        gap_id: gap.gap_id,
        proposed_event: event,
        reasoning,
      },
      refs: { wantId: chosen.id, gapId: gap.gap_id },
    });

    return ok({
      summary,
      suggestion_id: proposal.id,
      matched_want: { id: chosen.id, text: chosen.text },
      proposed_event: event,
      reasoning,
      alternatives,
    });
  },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildReasoning(want: { text: string; frequency?: string }, gap: { duration_minutes: number; preceded_by?: { title: string }; followed_by?: { title: string } }): string {
  const parts: string[] = [];
  parts.push(`Gap is ${gap.duration_minutes} minutes`);
  if (gap.preceded_by) parts.push(`after ${gap.preceded_by.title}`);
  if (gap.followed_by) parts.push(`before ${gap.followed_by.title}`);
  if (want.frequency) parts.push(`(your target: ${want.frequency})`);
  return parts.join(" ") + ".";
}
