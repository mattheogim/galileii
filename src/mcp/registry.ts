import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Tool, ToolContext, ZodShape } from "./types.js";
import { log } from "../lib/log.js";

import { readProfile } from "../tools/readProfile.js";
import { updateProfileProposal } from "../tools/updateProfileProposal.js";
import { commitProfileUpdate } from "../tools/commitProfileUpdate.js";
import { readWants } from "../tools/readWants.js";
import { addWantProposal } from "../tools/addWantProposal.js";
import { commitAddWant } from "../tools/commitAddWant.js";
import { findEmptyTime } from "../tools/findEmptyTime.js";
import { proposeActivityForGap } from "../tools/proposeActivityForGap.js";
import { listEvents } from "../tools/listEvents.js";
import { proposeEvent } from "../tools/proposeEvent.js";
import { commitEvent } from "../tools/commitEvent.js";
import { proposeCancel, commitCancel } from "../tools/cancelEvent.js";
import { proposeReschedule, commitReschedule } from "../tools/rescheduleEvent.js";
import { logDecision } from "../tools/logDecision.js";
import { dailyBriefing } from "../tools/dailyBriefing.js";
import { eveningReview } from "../tools/eveningReview.js";

const ALL_TOOLS: Tool<ZodShape>[] = [
  readProfile as unknown as Tool<ZodShape>,
  updateProfileProposal as unknown as Tool<ZodShape>,
  commitProfileUpdate as unknown as Tool<ZodShape>,
  readWants as unknown as Tool<ZodShape>,
  addWantProposal as unknown as Tool<ZodShape>,
  commitAddWant as unknown as Tool<ZodShape>,
  listEvents as unknown as Tool<ZodShape>,
  findEmptyTime as unknown as Tool<ZodShape>,
  proposeActivityForGap as unknown as Tool<ZodShape>,
  proposeEvent as unknown as Tool<ZodShape>,
  commitEvent as unknown as Tool<ZodShape>,
  proposeCancel as unknown as Tool<ZodShape>,
  commitCancel as unknown as Tool<ZodShape>,
  proposeReschedule as unknown as Tool<ZodShape>,
  commitReschedule as unknown as Tool<ZodShape>,
  logDecision as unknown as Tool<ZodShape>,
  dailyBriefing as unknown as Tool<ZodShape>,
  eveningReview as unknown as Tool<ZodShape>,
];

export function registerAll(server: McpServer): void {
  const ctx: ToolContext = { now: () => new Date() };

  for (const tool of ALL_TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: tool.isReadOnly,
          destructiveHint: tool.isDestructive,
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (args: any) => {
        try {
          const data = await tool.call(args, ctx);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify(data, null, 2) },
            ],
          };
        } catch (errCaught) {
          const message =
            errCaught instanceof Error ? errCaught.message : String(errCaught);
          log.error("tool failed", { tool: tool.name, err: message });
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  ok: false,
                  error: { code: "TOOL_ERROR", message },
                }),
              },
            ],
          };
        }
      },
    );
  }
}
