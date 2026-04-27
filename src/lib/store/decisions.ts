import { ulid } from "ulid";
import { decisionsPath } from "./paths.js";
import { appendText } from "./markdown.js";

export type DecisionKind =
  | "note"
  | "event_created"
  | "event_cancelled"
  | "event_rescheduled"
  | "profile_updated"
  | "want_added"
  | "want_completed";

export interface Decision {
  decision_id: string;
  kind: DecisionKind;
  summary: string;
  refs?: Record<string, unknown>;
  written_at: string;
}

export async function recordDecision(input: {
  kind: DecisionKind;
  summary: string;
  refs?: Record<string, unknown>;
}): Promise<Decision> {
  const decision: Decision = {
    decision_id: `dec_${ulid().slice(-10).toLowerCase()}`,
    kind: input.kind,
    summary: input.summary,
    refs: input.refs,
    written_at: new Date().toISOString(),
  };
  const block = render(decision);
  await appendText(decisionsPath(), block);
  return decision;
}

function render(d: Decision): string {
  const refsBlock = d.refs ? `\n\nrefs: ${JSON.stringify(d.refs)}` : "";
  return `\n## ${d.written_at} — ${d.kind} (decision_id: ${d.decision_id})\n\n${d.summary}${refsBlock}\n`;
}
