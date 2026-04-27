import { z } from "zod";
import type { Tool } from "../mcp/types.js";
import { ok } from "../mcp/types.js";
import { readAllWants } from "../lib/store/wants.js";

const inputSchema = {
  horizon: z
    .enum(["this_week", "this_month", "someday", "all"])
    .default("all")
    .describe("Filter by horizon."),
  tag: z.string().optional().describe("Optional tag filter."),
} as const;

export const readWants: Tool<typeof inputSchema> = {
  name: "read_wants",
  description:
    "Return the user's wants list, optionally filtered by horizon or tag. Read-only. Call this before suggesting empty-time activities.",
  isReadOnly: true,
  isConcurrencySafe: true,
  inputSchema,
  async call(args) {
    const all = await readAllWants();
    let wants = all;
    if (args.horizon && args.horizon !== "all") {
      wants = wants.filter((w) => w.horizon === args.horizon);
    }
    if (args.tag) {
      wants = wants.filter((w) => w.tags?.includes(args.tag as string));
    }
    const summary = wants.length
      ? `${wants.length} want(s)${args.horizon !== "all" ? ` (${args.horizon})` : ""}: ${wants
          .slice(0, 3)
          .map((w) => w.text)
          .join("; ")}${wants.length > 3 ? "…" : ""}`
      : "No wants in this filter. Ask the user what they want to be doing more of.";
    return ok({ summary, wants });
  },
};
